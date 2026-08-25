import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { Buffer } from "buffer";
import { Platform } from "react-native";
import type TcpSocket from "react-native-tcp-socket/lib/types/Socket";

import {
  LAN_SYNC_NATIVE_PROTOCOL,
  LAN_SYNC_PORT,
  createLanSyncAddress,
  createRoomCode,
  createSyncCommand,
  normalizeSyncProjectKey,
  normalizeSyncRoomCode,
  normalizeLanSocketChunk,
  parseSyncMessage,
  type SyncCommand,
  type SyncCommandName,
  type SyncDevice,
  type SyncMessage,
  type SyncRecordingState,
} from "@/lib/lan-sync-protocol";

const HEARTBEAT_MS = 5_000;

type TcpServer = {
  once: (event: "listening" | "error", listener: (() => void) | ((error: Error) => void)) => TcpServer;
  on: (event: "error" | "close", listener: (() => void) | ((error: Error) => void)) => TcpServer;
  listen: (options: { port: number; host?: string; reuseAddress?: boolean }) => TcpServer;
  close: (callback?: (error?: Error) => void) => TcpServer;
  listening?: boolean;
};
type TcpFactory = {
  createServer: (options: { keepAlive?: boolean; noDelay?: boolean } | ((socket: TcpSocket) => void), listener?: (socket: TcpSocket) => void) => TcpServer;
  createConnection: (options: { connectTimeout?: number; host: string; interface?: "wifi"; port: number }, callback: () => void) => TcpSocket;
};
type SyncMode = "idle" | "host" | "client";
type Peer = { socket: TcpSocket; lineBuffer: string; protocolReady: boolean; deviceId?: string };
type ClientTransport = { socket: TcpSocket; lineBuffer: string; protocolReady: boolean };

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
export type LanSyncDiagnostic = { at: number; mode: SyncMode; event: string; detail?: string };

export type LanSyncJoinInput = { host: string; port: string | number; roomCode: string; projectId: string; deviceName: string; inviteVersion?: number };
export type LanSyncHostInput = { projectId: string; deviceName: string };
export type LanSyncStateUpdate = Pick<SyncDevice, "state" | "sentenceIndex"> & Pick<SyncDevice, "detail">;

let nativeTcp: TcpFactory | null = null;
let server: TcpServer | null = null;
let client: ClientTransport | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let session: LanSyncStatus = { mode: "idle", self: idleDevice(), devices: [] };
const peers = new Set<Peer>();
const subscribers = new Set<() => void>();
const commandSubscribers = new Set<(command: SyncCommand) => void>();
const diagnostics: LanSyncDiagnostic[] = [];

function idleDevice(): SyncDevice {
  const timestamp = Date.now();
  return { id: "", name: "", role: "client", state: "idle", sentenceIndex: 0, connectedAt: timestamp, updatedAt: timestamp };
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
function serverMessage(message: SyncMessage) { return JSON.stringify(message); }
function keyFingerprint(value?: string) {
  if (!value) return "none";
  let checksum = 0;
  for (let index = 0; index < value.length; index += 1) checksum = (checksum * 31 + value.charCodeAt(index)) >>> 0;
  return `key:${value.length}:${checksum.toString(16).padStart(8, "0")}`;
}
function maskedRoomCode(value?: string) { return value ? `***${value.slice(-2)}` : "none"; }
function logDiagnostic(event: string, detail?: string) {
  diagnostics.push({ at: now(), mode: session.mode, event, detail });
  if (diagnostics.length > 120) diagnostics.splice(0, diagnostics.length - 120);
}
function createDevice(deviceName: string, role: "host" | "client"): SyncDevice {
  const createdAt = now();
  return { id: Crypto.randomUUID(), name: deviceName.trim() || (role === "host" ? "主控设备" : "录音设备"), role, state: "idle", sentenceIndex: 0, connectedAt: createdAt, updatedAt: createdAt };
}
function replaceDevice(device: SyncDevice) {
  const others = session.devices.filter((item) => item.id !== device.id);
  session = {
    ...session,
    self: session.self.id === device.id ? device : session.self,
    devices: [...others, device].sort((left, right) => left.role === right.role ? left.name.localeCompare(right.name) : left.role === "host" ? -1 : 1),
  };
  emit();
}
function markDeviceOffline(deviceId: string) {
  const device = session.devices.find((item) => item.id === deviceId);
  if (!device) return;
  replaceDevice({ ...device, detail: "offline", state: "error", updatedAt: now() });
}

export function subscribeLanSync(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
export function subscribeLanSyncCommands(listener: (command: SyncCommand) => void) { commandSubscribers.add(listener); return () => { commandSubscribers.delete(listener); }; }
export function getLanSyncStatus() { return session; }
export function getLanSyncDiagnosticsText() {
  const head = ["采音脚本同步诊断", `协议=${LAN_SYNC_NATIVE_PROTOCOL}`, `生成时间=${new Date().toISOString()}`];
  const entries = diagnostics.map((entry) => `${new Date(entry.at).toISOString()} [${entry.mode}] ${entry.event}${entry.detail ? ` | ${entry.detail}` : ""}`);
  return [...head, ...entries].join("\n");
}

export async function startLanSyncHost(input: LanSyncHostInput): Promise<LanSyncStatus> {
  if (Platform.OS === "web") throw new Error("请在 Android 主控手机中创建同步房间。");
  const hostProjectKey = normalizeSyncProjectKey(input.projectId);
  if (!hostProjectKey) throw new Error("主控同步任务键无效。请返回任务详情后重试。");
  // Sync rooms are intentionally ephemeral: never carry diagnostics or bindings into a new room.
  diagnostics.splice(0, diagnostics.length);
  await forceResetLanSync("host-recreate");
  const ip = await Network.getIpAddressAsync();
  if (!ip || ip === "0.0.0.0") throw new Error("未能读取局域网地址。请连接同一 Wi-Fi 或开启热点后重试。");
  const self = createDevice(input.deviceName, "host");
  session = { mode: "host", roomCode: normalizeSyncRoomCode(createRoomCode()), address: `${ip}:${LAN_SYNC_PORT}`, projectId: hostProjectKey, self, devices: [self] };
  logDiagnostic("host-room-created", `address=${session.address}; invite=v2; room=${maskedRoomCode(session.roomCode)}; ${keyFingerprint(hostProjectKey)}`);
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
    logDiagnostic("host-listening", `port=${LAN_SYNC_PORT}; bind=0.0.0.0`);
    return session;
  } catch (error) {
    stopLanSync();
    throw error;
  }
}

async function forceResetLanSync(reason: string) {
  logDiagnostic("sync-force-reset", `reason=${reason}; previous=${session.mode}`);
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  if (client) { try { client.socket.destroy(); } catch { /* ignored */ } }
  client = null;
  for (const peer of peers) { try { peer.socket.destroy(); } catch { /* ignored */ } }
  peers.clear();
  const closingServer = server;
  server = null;
  session = { mode: "idle", self: idleDevice(), devices: [] };
  emit();
  if (!closingServer) return;
  await new Promise<void>((resolve) => {
    let completed = false;
    const done = () => { if (!completed) { completed = true; resolve(); } };
    try { closingServer.close(() => done()); } catch { done(); }
    setTimeout(done, 700);
  });
}

export function joinLanSyncRoom(input: LanSyncJoinInput): Promise<LanSyncStatus> {
  if (Platform.OS === "web") return Promise.reject(new Error("请在 Android 录音客户端中加入同步房间。"));
  let address: string;
  try { address = createLanSyncAddress(input.host, input.port); }
  catch (error) { return Promise.reject(error instanceof Error ? error : new Error("主控地址无效。")); }
  const endpoint = splitLanEndpoint(address);
  stopLanSync();
  const self = createDevice(input.deviceName, "client");
  const clientRoomCode = normalizeSyncRoomCode(input.roomCode);
  const clientProjectKey = normalizeSyncProjectKey(input.projectId);
  if (!clientRoomCode || !clientProjectKey) return Promise.reject(new Error("二维码中的房间口令或同步任务键无效。请让主控重新生成二维码。"));
  session = { mode: "idle", roomCode: clientRoomCode, address: `${endpoint.host}:${endpoint.port}`, projectId: clientProjectKey, self, devices: [], error: undefined };
  logDiagnostic("client-join-requested", `address=${session.address}; invite=v${input.inviteVersion ?? 0}; room=${maskedRoomCode(session.roomCode)}; ${keyFingerprint(clientProjectKey)}`);
  emit();

  return new Promise<LanSyncStatus>((resolve, reject) => {
    let settled = false;
    let transport: ClientTransport | null = null;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) {
        logDiagnostic("client-join-failed", error.message);
        if (client === transport) client = null;
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        session = { mode: "idle", self: idleDevice(), devices: [], error: error.message };
        emit();
        try { transport?.socket.destroy(); } catch { /* ignored */ }
        reject(error);
      } else resolve(session);
    };
    const tcp = getTcp();
    let socket!: TcpSocket;
    socket = tcp.createConnection({ connectTimeout: 7_000, host: endpoint.host, interface: "wifi", port: endpoint.port }, () => {
      transport = { socket, lineBuffer: "", protocolReady: false };
      client = transport;
      socket.setNoDelay(true);
      socket.setKeepAlive(true);
      socket.write(`${LAN_SYNC_NATIVE_PROTOCOL}\n`);
      logDiagnostic("client-protocol-sent", LAN_SYNC_NATIVE_PROTOCOL);
    });
    socket.setTimeout(8_000, () => finish(new Error("连接主控端超时，请检查主控 IP、端口和局域网连接。")));
    socket.on("data", (chunk) => {
      if (!transport) return;
      consumeLines(transport, Buffer.from(normalizeLanSocketChunk(chunk)), (line) => {
        if (!transport) return;
        if (!transport.protocolReady) {
          if (line !== LAN_SYNC_NATIVE_PROTOCOL) { finish(new Error(`主控同步协议不匹配：${line || "未收到协议确认"}`)); return; }
          transport.protocolReady = true;
          logDiagnostic("client-protocol-confirmed", line);
          sendClient({ type: "hello", roomCode: session.roomCode ?? "", projectId: session.projectId ?? "", deviceId: self.id, deviceName: self.name, sentAt: now() });
          return;
        }
        const message = parseSyncMessage(line);
        if (message) handleClientMessage(message, finish);
      });
    });
    socket.on("error", (error) => finish(new Error(`无法连接主控端：${error.message || "请确认主控已创建房间、IP 和端口正确，并处于同一局域网。"}`)));
    socket.on("close", () => {
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
      if (!settled) { finish(new Error("主控端在确认同步协议前关闭了连接。请确认两台设备都安装新版 APK。")); return; }
      if (session.mode === "client") {
        logDiagnostic("client-connection-closed", "session-reset-to-idle");
        client = null;
        session = { mode: "idle", self: idleDevice(), devices: [], error: "与主控端的连接已断开。" };
        emit();
      }
    });
  });
}

export function stopLanSync() {
  if (session.mode !== "idle") logDiagnostic("sync-stopped", `mode=${session.mode}`);
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  if (client) { try { client.socket.destroy(); } catch { /* ignored */ } }
  client = null;
  for (const peer of peers) { try { peer.socket.destroy(); } catch { /* ignored */ } }
  peers.clear();
  const closingServer = server;
  server = null;
  if (closingServer) { try { closingServer.close(); } catch { /* ignored */ } }
  session = { mode: "idle", self: idleDevice(), devices: [] };
  emit();
}

/** Releases a room only when it belongs to the task being removed or replaced. */
export function releaseLanSyncForProject(projectKey: string, reason: string) {
  const normalized = normalizeSyncProjectKey(projectKey);
  if (!normalized || session.mode === "idle" || normalizeSyncProjectKey(session.projectId ?? "") !== normalized) return false;
  logDiagnostic("sync-project-released", `reason=${reason}; ${keyFingerprint(normalized)}`);
  stopLanSync();
  return true;
}

/** Releases any active room that belongs to a different task before the user enters that task. */
export function releaseLanSyncForTaskSwitch(projectKey: string, reason: string) {
  const normalized = normalizeSyncProjectKey(projectKey);
  if (!normalized || session.mode === "idle" || normalizeSyncProjectKey(session.projectId ?? "") === normalized) return false;
  logDiagnostic("sync-task-switch-released", `reason=${reason}; from=${keyFingerprint(session.projectId)}; to=${keyFingerprint(normalized)}`);
  stopLanSync();
  return true;
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

function splitLanEndpoint(address: string) {
  const value = address.replace(/^ws:\/\//, "");
  const separator = value.lastIndexOf(":");
  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("主控 IP 或端口无效。");
  return { host, port };
}

function consumeLines(target: { lineBuffer: string }, incoming: Buffer, onLine: (line: string) => void) {
  target.lineBuffer += incoming.toString("utf8");
  let newline = target.lineBuffer.indexOf("\n");
  while (newline >= 0) {
    const line = target.lineBuffer.slice(0, newline).trim();
    target.lineBuffer = target.lineBuffer.slice(newline + 1);
    if (line) onLine(line);
    newline = target.lineBuffer.indexOf("\n");
  }
}

function handleHostConnection(socket: TcpSocket) {
  const peer: Peer = { socket, lineBuffer: "", protocolReady: false };
  logDiagnostic("host-client-transport-opened");
  socket.setNoDelay(true);
  socket.setKeepAlive(true);
  socket.setTimeout(15_000, () => socket.destroy());
  socket.on("data", (chunk) => {
    consumeLines(peer, Buffer.from(normalizeLanSocketChunk(chunk)), (line) => {
      if (!peer.protocolReady) {
        if (line !== LAN_SYNC_NATIVE_PROTOCOL) { logDiagnostic("host-protocol-rejected", `received=${line.slice(0, 48) || "empty"}`); socket.write(`ERR unsupported-protocol\n`); socket.end(); return; }
        peer.protocolReady = true;
        peers.add(peer);
        socket.setTimeout(0);
        socket.write(`${LAN_SYNC_NATIVE_PROTOCOL}\n`);
        logDiagnostic("host-protocol-confirmed", line);
        return;
      }
      const message = parseSyncMessage(line);
      if (message) handleHostMessage(peer, message);
    });
  });
  socket.on("close", () => { if (peer.deviceId) markDeviceOffline(peer.deviceId); peers.delete(peer); broadcastWelcome(); });
  socket.on("error", () => { /* device state is updated by close */ });
}

function handleClientMessage(message: SyncMessage, finish: (error?: Error) => void) {
  if (message.type === "welcome") {
    logDiagnostic("client-welcome-received", `room=${maskedRoomCode(message.roomCode)}; ${keyFingerprint(message.projectId)}; devices=${message.devices.length}`);
    session = { ...session, mode: "client", roomCode: message.roomCode, projectId: message.projectId, devices: message.devices, error: undefined };
    emit();
    if (!heartbeat) heartbeat = setInterval(() => sendClient({ type: "ping", sentAt: now() }), HEARTBEAT_MS);
    finish();
  } else if (message.type === "command") { logDiagnostic("client-command-received", `${message.command.name}; sentence=${message.command.sentenceIndex}`); receiveCommand(message.command); }
  else if (message.type === "pong") updateClientLatency(now() - message.sentAt);
  else if (message.type === "error") { logDiagnostic("host-error-received", message.message); finish(new Error(message.message)); }
}

function handleHostMessage(peer: Peer, message: SyncMessage) {
  if (message.type === "hello") {
    if (session.mode !== "host" || !session.roomCode || !session.projectId) { sendPeer(peer, { type: "error", message: "主控房间已关闭。" }); peer.socket.end(); return; }
    const hostRoomCode = session.roomCode;
    const hostProjectKey = session.projectId;
    const roomMatches = normalizeSyncRoomCode(message.roomCode) === normalizeSyncRoomCode(hostRoomCode);
    const taskMatches = normalizeSyncProjectKey(message.projectId) === normalizeSyncProjectKey(hostProjectKey);
    logDiagnostic("host-hello-received", `roomMatch=${roomMatches}; taskMatch=${taskMatches}; incoming=${keyFingerprint(message.projectId)}; host=${keyFingerprint(hostProjectKey)}`);
    if (!roomMatches) { logDiagnostic("host-hello-rejected", "reason=room-code-mismatch"); sendPeer(peer, { type: "error", message: "房间口令不匹配。请重新扫描主控二维码。" }); peer.socket.end(); return; }
    if (!taskMatches) { logDiagnostic("host-hello-rejected", "reason=sync-task-key-mismatch"); sendPeer(peer, { type: "error", message: "同步任务键不匹配。请使用主控重新生成的二维码扫码加入。" }); peer.socket.end(); return; }
    peer.deviceId = message.deviceId;
    logDiagnostic("host-client-accepted", `device=${message.deviceName}; id=${message.deviceId.slice(0, 8)}`);
    replaceDevice({ id: message.deviceId, name: message.deviceName, role: "client", state: "idle", sentenceIndex: 0, connectedAt: now(), updatedAt: now() });
    sendPeer(peer, { type: "welcome", roomCode: hostRoomCode, projectId: hostProjectKey, serverTime: now(), devices: session.devices });
    broadcastWelcome();
  } else if (message.type === "device-state" && peer.deviceId === message.device.id) {
    const current = session.devices.find((device) => device.id === peer.deviceId);
    if (!current) return;
    replaceDevice({ ...current, ...message.device, updatedAt: now() });
    broadcastWelcome();
  } else if (message.type === "ping") sendPeer(peer, { type: "pong", sentAt: message.sentAt });
}

function sendClient(message: SyncMessage) {
  if (client?.protocolReady && !client.socket.destroyed) client.socket.write(`${serverMessage(message)}\n`);
}
function sendPeer(peer: Peer, message: SyncMessage) {
  if (peer.protocolReady && !peer.socket.destroyed) peer.socket.write(`${serverMessage(message)}\n`);
}
function broadcast(message: SyncMessage) { for (const peer of peers) sendPeer(peer, message); }
function broadcastWelcome() {
  if (session.mode !== "host" || !session.roomCode || !session.projectId) return;
  broadcast({ type: "welcome", roomCode: session.roomCode, projectId: session.projectId, serverTime: now(), devices: session.devices });
}
function receiveCommand(command: SyncCommand) {
  logDiagnostic("command-dispatched", `${command.name}; sentence=${command.sentenceIndex}`);
  session = { ...session, lastCommand: command };
  emit();
  commandSubscribers.forEach((listener) => listener(command));
}
function updateClientLatency(latencyMs: number) {
  if (session.mode !== "client") return;
  replaceDevice({ ...session.self, latencyMs, updatedAt: now() });
}
