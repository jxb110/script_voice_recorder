import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { Buffer } from "buffer";
import { Platform } from "react-native";
import type TcpSocket from "react-native-tcp-socket/lib/types/Socket";

import { LAN_SYNC_PORT, createLanSyncAddress, createRoomCode, createSyncCommand, normalizeLanSocketChunk, parseSyncMessage, type SyncCommand, type SyncCommandName, type SyncDevice, type SyncMessage, type SyncRecordingState } from "@/lib/lan-sync-protocol";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const HEARTBEAT_MS = 5_000;

type TcpServer = {
  once: (event: "listening" | "error", listener: (() => void) | ((error: Error) => void)) => TcpServer;
  on: (event: "error", listener: (error: Error) => void) => TcpServer;
  listen: (options: { port: number; host?: string; reuseAddress?: boolean }) => TcpServer;
  close: () => TcpServer;
};
type TcpFactory = {
  createServer: (options: { keepAlive?: boolean; noDelay?: boolean } | ((socket: TcpSocket) => void), listener?: (socket: TcpSocket) => void) => TcpServer;
  createConnection: (options: { connectTimeout?: number; host: string; interface?: "wifi"; port: number }, callback: () => void) => TcpSocket;
};
type SyncMode = "idle" | "host" | "client";
type Peer = { socket: TcpSocket; buffer: Buffer; deviceId?: string };
type ClientTransport = { socket: TcpSocket; buffer: Buffer; handshake: Buffer; upgraded: boolean };

export type LanSyncStatus = {
  mode: SyncMode;
  roomCode?: string;
  address?: string;
  projectId?: string;
  self: SyncDevice;
  devices: SyncDevice[];
  error?: string;
  lastCommand?: SyncCommand;
};

export type LanSyncJoinInput = { host: string; port: string | number; roomCode: string; projectId: string; deviceName: string };
export type LanSyncHostInput = { projectId: string; deviceName: string };
export type LanSyncStateUpdate = Pick<SyncDevice, "state" | "sentenceIndex"> & Pick<SyncDevice, "detail">;

let nativeTcp: TcpFactory | null = null;
let server: TcpServer | null = null;
let client: ClientTransport | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let session: LanSyncStatus = { mode: "idle", self: idleDevice() , devices: [] };
const peers = new Set<Peer>();
const subscribers = new Set<() => void>();
const commandSubscribers = new Set<(command: SyncCommand) => void>();

function idleDevice(): SyncDevice {
  const now = Date.now();
  return { id: "", name: "", role: "client", state: "idle", sentenceIndex: 0, connectedAt: now, updatedAt: now };
}

function getTcp() {
  if (Platform.OS === "web") throw new Error("局域网同步录音需要使用重新构建后的 Android 应用。");
  if (!nativeTcp) {
    const module = require("react-native-tcp-socket") as TcpFactory & { default?: TcpFactory };
    nativeTcp = module.default ?? module;
  }
  return nativeTcp;
}

function emit() { subscribers.forEach((listener) => listener()); }
function now() { return Date.now(); }
function createDevice(deviceName: string, role: "host" | "client"): SyncDevice {
  const createdAt = now();
  return { id: Crypto.randomUUID(), name: deviceName.trim() || (role === "host" ? "主控设备" : "录音设备"), role, state: "idle", sentenceIndex: 0, connectedAt: createdAt, updatedAt: createdAt };
}
function replaceDevice(device: SyncDevice) {
  const others = session.devices.filter((item) => item.id !== device.id);
  session = { ...session, self: session.self.id === device.id ? device : session.self, devices: [...others, device].sort((left, right) => left.role === right.role ? left.name.localeCompare(right.name) : left.role === "host" ? -1 : 1) };
  emit();
}
function markDeviceOffline(deviceId: string) {
  const device = session.devices.find((item) => item.id === deviceId);
  if (!device) return;
  replaceDevice({ ...device, detail: "offline", state: "error", updatedAt: now() });
}
function serverMessage(message: SyncMessage) { return JSON.stringify(message); }
export function subscribeLanSync(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
export function subscribeLanSyncCommands(listener: (command: SyncCommand) => void) { commandSubscribers.add(listener); return () => { commandSubscribers.delete(listener); }; }
export function getLanSyncStatus() { return session; }

export async function startLanSyncHost(input: LanSyncHostInput): Promise<LanSyncStatus> {
  if (Platform.OS === "web") throw new Error("请在 Android 主控手机中创建同步房间。");
  if (session.mode === "host" && session.projectId === input.projectId) return session;
  stopLanSync();
  const ip = await Network.getIpAddressAsync();
  if (!ip || ip === "0.0.0.0") throw new Error("未能读取局域网地址。请连接同一 Wi-Fi 或开启热点后重试。");
  const self = createDevice(input.deviceName, "host");
  session = { mode: "host", roomCode: createRoomCode(), address: `${ip}:${LAN_SYNC_PORT}`, projectId: input.projectId, self, devices: [self] };
  emit();
  const tcp = getTcp();
  server = tcp.createServer({ keepAlive: true, noDelay: true }, handleHostConnection);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`端口 ${LAN_SYNC_PORT} 未在 4 秒内开始监听。`)), 4_000);
      server?.once("listening", () => { clearTimeout(timer); resolve(); });
      server?.once("error", (error: Error) => { clearTimeout(timer); reject(error); });
      server?.on("error", (error: Error) => { session = { ...session, error: error.message }; emit(); });
      server?.listen({ port: LAN_SYNC_PORT, host: "0.0.0.0", reuseAddress: true });
    });
    return session;
  } catch (error) {
    stopLanSync();
    throw error;
  }
}

export function joinLanSyncRoom(input: LanSyncJoinInput): Promise<LanSyncStatus> {
  if (Platform.OS === "web") return Promise.reject(new Error("请在 Android 录音客户端中加入同步房间。"));
  let address: string;
  try { address = createLanSyncAddress(input.host, input.port); }
  catch (error) { return Promise.reject(error instanceof Error ? error : new Error("主控地址无效。")); }
  const endpoint = splitLanEndpoint(address);
  stopLanSync();
  const self = createDevice(input.deviceName, "client");
  session = { mode: "idle", roomCode: input.roomCode.trim().toUpperCase(), address: `${endpoint.host}:${endpoint.port}`, projectId: input.projectId, self, devices: [], error: undefined };
  emit();
  return new Promise<LanSyncStatus>((resolve, reject) => {
    let settled = false;
    let transport: ClientTransport | null = null;
    const tcp = getTcp();
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) {
        if (client === transport) client = null;
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        session = { mode: "idle", self: idleDevice(), devices: [], error: error.message };
        emit();
        try { transport?.socket.destroy(); } catch { /* ignored */ }
        reject(error);
      } else resolve(session);
    };
    let socket!: TcpSocket;
    socket = tcp.createConnection({ connectTimeout: 7_000, host: endpoint.host, interface: "wifi", port: endpoint.port }, () => {
      transport = { socket, buffer: Buffer.alloc(0), handshake: Buffer.alloc(0), upgraded: false };
      client = transport;
      socket.setNoDelay(true);
      socket.setKeepAlive(true);
      const key = Buffer.from(Crypto.randomUUID(), "utf8").toString("base64");
      socket.write(`GET /sync HTTP/1.1\r\nHost: ${endpoint.host}:${endpoint.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    socket.setTimeout(8_000, () => finish(new Error("连接主控端超时，请检查主控 IP、端口和局域网连接。")));
    socket.on("data", (chunk) => {
      if (!transport) return;
      const incoming = Buffer.from(normalizeLanSocketChunk(chunk));
      if (!transport.upgraded) {
        transport.handshake = Buffer.concat([transport.handshake, incoming]);
        const marker = transport.handshake.indexOf("\r\n\r\n");
        if (marker < 0) return;
        const response = transport.handshake.subarray(0, marker).toString("utf8");
        if (!response.startsWith("HTTP/1.1 101")) { finish(new Error(`主控端拒绝连接：${response.split("\r\n")[0] || "握手失败"}`)); return; }
        transport.upgraded = true;
        sendClient({ type: "hello", roomCode: session.roomCode ?? "", projectId: session.projectId ?? "", deviceId: self.id, deviceName: self.name, sentAt: now() });
        const remainder = transport.handshake.subarray(marker + 4);
        transport.handshake = Buffer.alloc(0);
        if (remainder.length) consumeClientFrames(transport, remainder, (message) => handleClientMessage(message, finish));
        return;
      }
      consumeClientFrames(transport, incoming, (message) => handleClientMessage(message, finish));
    });
    socket.on("error", (error) => finish(new Error(`无法连接主控端：${error.message || "请确认主控已创建房间、IP 和端口正确，并处于同一局域网。"}`)));
    socket.on("close", () => {
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
      if (!settled) { finish(new Error("主控端在完成握手前关闭了连接。请检查 IP、端口和房间口令。")); return; }
      if (session.mode === "client") {
        const self = { ...session.self, detail: "offline", state: "error" as const, updatedAt: now() };
        replaceDevice(self);
        session = { ...session, error: "与主控端的连接已断开。" };
        emit();
      }
    });
  });
}

export function stopLanSync() {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  if (client) { try { client.socket.destroy(); } catch { /* ignored */ } }
  client = null;
  for (const peer of peers) { try { peer.socket.destroy(); } catch { /* ignored */ } }
  peers.clear();
  if (server) { try { server.close(); } catch { /* ignored */ } }
  server = null;
  session = { mode: "idle", self: idleDevice(), devices: [] };
  emit();
}

export function reportLanSyncState(update: LanSyncStateUpdate) {
  if (session.mode === "idle" || !session.self.id) return;
  const self = { ...session.self, ...update, updatedAt: now() };
  replaceDevice(self);
  if (session.mode === "host") broadcastWelcome();
  else sendClient({ type: "device-state", device: { id: self.id, name: self.name, state: self.state, sentenceIndex: self.sentenceIndex, updatedAt: self.updatedAt, detail: self.detail, latencyMs: self.latencyMs }, sentAt: now() });
}

export function sendLanSyncCommand(name: SyncCommandName, sentenceIndex: number) {
  if (session.mode !== "host" || !session.projectId) throw new Error("只有主控端可以发送同步录音指令。");
  const command = createSyncCommand({ name, projectId: session.projectId, sentenceIndex });
  session = { ...session, lastCommand: command };
  emit();
  broadcast({ type: "command", command });
  receiveCommand(command);
  return command;
}

function receiveCommand(command: SyncCommand) {
  session = { ...session, lastCommand: command };
  emit();
  commandSubscribers.forEach((listener) => listener(command));
}

function updateClientLatency(latencyMs: number) {
  if (session.mode !== "client") return;
  const self = { ...session.self, latencyMs, updatedAt: now() };
  replaceDevice(self);
}

function splitLanEndpoint(address: string) {
  const value = address.replace(/^ws:\/\//, "");
  const separator = value.lastIndexOf(":");
  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("主控 IP 或端口无效。");
  return { host, port };
}

type JoinFinish = (error?: Error) => void;

function handleClientMessage(message: SyncMessage, finish: JoinFinish) {
  if (message.type === "welcome") {
    session = { ...session, mode: "client", roomCode: message.roomCode, projectId: message.projectId, devices: message.devices, error: undefined };
    emit();
    if (!heartbeat) heartbeat = setInterval(() => sendClient({ type: "ping", sentAt: now() }), HEARTBEAT_MS);
    finish();
  } else if (message.type === "command") receiveCommand(message.command);
  else if (message.type === "pong") updateClientLatency(now() - message.sentAt);
  else if (message.type === "error") finish(new Error(message.message));
}

function consumeClientFrames(transport: ClientTransport, incoming: Buffer, onMessage: (message: SyncMessage) => void) {
  transport.buffer = Buffer.concat([transport.buffer, incoming]);
  while (transport.buffer.length >= 2) {
    const first = transport.buffer[0];
    const second = transport.buffer[1];
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) { if (transport.buffer.length < 4) return; length = transport.buffer.readUInt16BE(2); offset = 4; }
    const maskLength = masked ? 4 : 0;
    if (length > 16 * 1024 || transport.buffer.length < offset + maskLength + length) return;
    const mask = masked ? transport.buffer.subarray(offset, offset + 4) : null;
    const payload = Buffer.from(transport.buffer.subarray(offset + maskLength, offset + maskLength + length));
    transport.buffer = transport.buffer.subarray(offset + maskLength + length);
    if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    const opcode = first & 0x0f;
    if (opcode === 0x8) { transport.socket.end(); return; }
    if (opcode === 0x9) { sendFrame(transport.socket, payload, 0xA, true); continue; }
    if (opcode !== 0x1) continue;
    const message = parseSyncMessage(payload.toString("utf8"));
    if (message) onMessage(message);
  }
}

function sendClient(message: SyncMessage) {
  if (client?.upgraded && !client.socket.destroyed) sendFrame(client.socket, Buffer.from(serverMessage(message), "utf8"), 0x1, true);
}

function broadcast(message: SyncMessage) {
  for (const peer of peers) sendPeer(peer, message);
}
function broadcastWelcome() {
  if (session.mode !== "host" || !session.roomCode || !session.projectId) return;
  broadcast({ type: "welcome", roomCode: session.roomCode, projectId: session.projectId, serverTime: now(), devices: session.devices });
}

function handleHostConnection(socket: TcpSocket) {
  const peer: Peer = { socket, buffer: Buffer.alloc(0) };
  let handshake = Buffer.alloc(0);
  socket.setNoDelay(true);
  socket.setTimeout(15_000, () => socket.destroy());
  socket.on("data", (chunk) => {
    const bytes = Buffer.from(normalizeLanSocketChunk(chunk));
    if (!peers.has(peer)) {
      handshake = Buffer.concat([handshake, bytes]);
      const marker = handshake.indexOf("\r\n\r\n");
      if (marker < 0) return;
      const rest = handshake.subarray(marker + 4);
      const header = handshake.subarray(0, marker).toString("utf8");
      void completeHandshake(peer, header, rest);
      return;
    }
    consumeFrames(peer, bytes);
  });
  socket.on("close", () => { if (peer.deviceId) markDeviceOffline(peer.deviceId); peers.delete(peer); broadcastWelcome(); });
  socket.on("error", () => { /* individual device errors are surfaced as offline state */ });
}

async function completeHandshake(peer: Peer, header: string, remainder: Buffer) {
  const lines = header.split("\r\n");
  const first = lines.shift() ?? "";
  const headers = new Map(lines.map((line) => { const split = line.indexOf(":"); return [split < 0 ? "" : line.slice(0, split).trim().toLowerCase(), split < 0 ? "" : line.slice(split + 1).trim()]; }));
  const key = headers.get("sec-websocket-key");
  if (!first.startsWith("GET ") || !key) { peer.socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"); return; }
  try {
    const accept = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, `${key}${WS_GUID}`, { encoding: Crypto.CryptoEncoding.BASE64 });
    peer.socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    peer.socket.setTimeout(0);
    peers.add(peer);
    if (remainder.length) consumeFrames(peer, remainder);
  } catch { peer.socket.destroy(); }
}

function consumeFrames(peer: Peer, incoming: Buffer) {
  peer.buffer = Buffer.concat([peer.buffer, incoming]);
  while (peer.buffer.length >= 2) {
    const first = peer.buffer[0];
    const second = peer.buffer[1];
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) { if (peer.buffer.length < 4) return; length = peer.buffer.readUInt16BE(2); offset = 4; }
    if (!masked || length > 16 * 1024 || peer.buffer.length < offset + 4 + length) return;
    const mask = peer.buffer.subarray(offset, offset + 4);
    const payload = Buffer.from(peer.buffer.subarray(offset + 4, offset + 4 + length));
    peer.buffer = peer.buffer.subarray(offset + 4 + length);
    for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    const opcode = first & 0x0f;
    if (opcode === 0x8) { peer.socket.end(); return; }
    if (opcode === 0x9) { sendFrame(peer.socket, payload, 0xA); continue; }
    if (opcode !== 0x1) continue;
    const message = parseSyncMessage(payload.toString("utf8"));
    if (message) handleHostMessage(peer, message);
  }
}

function handleHostMessage(peer: Peer, message: SyncMessage) {
  if (message.type === "hello") {
    if (session.mode !== "host" || message.roomCode !== session.roomCode || message.projectId !== session.projectId) { sendPeer(peer, { type: "error", message: "房间口令或任务不匹配。" }); peer.socket.end(); return; }
    peer.deviceId = message.deviceId;
    replaceDevice({ id: message.deviceId, name: message.deviceName, role: "client", state: "idle", sentenceIndex: 0, connectedAt: now(), updatedAt: now() });
    sendPeer(peer, { type: "welcome", roomCode: session.roomCode, projectId: session.projectId, serverTime: now(), devices: session.devices });
    broadcastWelcome();
  } else if (message.type === "device-state" && peer.deviceId === message.device.id) {
    const current = session.devices.find((device) => device.id === peer.deviceId);
    if (!current) return;
    replaceDevice({ ...current, ...message.device, updatedAt: now() });
    broadcastWelcome();
  } else if (message.type === "ping") sendPeer(peer, { type: "pong", sentAt: message.sentAt });
}

function sendPeer(peer: Peer, message: SyncMessage) { sendFrame(peer.socket, Buffer.from(serverMessage(message), "utf8"), 0x1); }
function sendFrame(socket: TcpSocket, payload: Buffer, opcode: number, masked = false) {
  const length = payload.length;
  const lengthHead = length < 126 ? [length] : [126, (length >> 8) & 0xff, length & 0xff];
  const mask = masked ? Buffer.from([Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]) : null;
  const head = Buffer.from([0x80 | opcode, (masked ? 0x80 : 0) | lengthHead[0], ...lengthHead.slice(1)]);
  const body = Buffer.from(payload);
  if (mask) for (let index = 0; index < body.length; index += 1) body[index] ^= mask[index % 4];
  socket.write(mask ? Buffer.concat([head, mask, body]) : Buffer.concat([head, body]));
}
