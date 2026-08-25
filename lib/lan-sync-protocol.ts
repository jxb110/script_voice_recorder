export const LAN_SYNC_PORT = 35679;
export const LAN_SYNC_EXECUTION_LEAD_MS = 850;
export const LAN_SYNC_NATIVE_PROTOCOL = "SCRIPT-RECORDER-SYNC/1";
const SYNC_INVITE_TYPE = "script-recorder-sync";

export function createLanSyncAddress(hostInput: string, portInput: string | number = LAN_SYNC_PORT) {
  const rawHost = hostInput.trim().replace(/^wss?:\/\//i, "").replace(/\/.*$/, "");
  const matchedPort = rawHost.match(/:(\d+)$/)?.[1];
  const host = rawHost.replace(/:\d+$/, "").trim();
  const portText = String(portInput).trim() || matchedPort || String(LAN_SYNC_PORT);
  const port = Number(portText);
  if (!host) throw new Error("请输入主控设备的 IP 地址。");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("请输入 1 到 65535 之间的端口号。");
  return `ws://${host}:${port}`;
}

/** Normalizes native TCP payloads, including Android implementations that return bytes as "72,84,..." strings or Buffer-like objects. */
export function normalizeLanSocketChunk(chunk: unknown): Uint8Array {
  if (typeof chunk === "string") {
    const compact = chunk.trim().replace(/\s+/g, "");
    const list = compact.replace(/^\[/, "").replace(/\]$/, "");
    if (/^(?:\d{1,3},)*\d{1,3}$/.test(list)) {
      const values = list.split(",").map(Number);
      if (values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) return new Uint8Array(values);
    }
    return new TextEncoder().encode(chunk);
  }
  if (Array.isArray(chunk)) return new Uint8Array(chunk);
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  if (ArrayBuffer.isView(chunk)) return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if (chunk && typeof chunk === "object") {
    const bufferLike = chunk as { data?: unknown; type?: unknown; toString?: () => string };
    if (bufferLike.type === "Buffer" && Array.isArray(bufferLike.data)) return new Uint8Array(bufferLike.data);
    if (typeof bufferLike.data === "string" || Array.isArray(bufferLike.data) || bufferLike.data instanceof ArrayBuffer || ArrayBuffer.isView(bufferLike.data)) return normalizeLanSocketChunk(bufferLike.data);
    const text = bufferLike.toString?.();
    if (text && text !== "[object Object]") return normalizeLanSocketChunk(text);
    const indexedValues = Object.entries(chunk as Record<string, unknown>)
      .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "number")
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([, value]) => value as number);
    if (indexedValues.length && indexedValues.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) return new Uint8Array(indexedValues);
  }
  return new Uint8Array(0);
}

export type SyncRoomInvite = { host: string; port: number; roomCode: string; projectSyncKey?: string; version: number };

export function normalizeSyncRoomCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeSyncProjectKey(value: string) {
  return value.trim();
}

export function createSyncRoomInvite(address: string, roomCode: string, projectSyncKey: string) {
  const normalized = createLanSyncAddress(address, "").replace(/^ws:\/\//, "");
  const separator = normalized.lastIndexOf(":");
  const host = normalized.slice(0, separator);
  const port = Number(normalized.slice(separator + 1));
  const normalizedRoomCode = normalizeSyncRoomCode(roomCode);
  const normalizedProjectKey = normalizeSyncProjectKey(projectSyncKey);
  if (!/^[A-Z0-9]{4,12}$/.test(normalizedRoomCode)) throw new Error("房间口令无效。");
  if (!normalizedProjectKey) throw new Error("同步任务键无效。");
  return JSON.stringify({ type: SYNC_INVITE_TYPE, version: 2, host, port, roomCode: normalizedRoomCode, projectSyncKey: normalizedProjectKey });
}

export function parseSyncRoomInvite(raw: string): SyncRoomInvite | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.type !== SYNC_INVITE_TYPE || (value.version !== 1 && value.version !== 2) || !isString(value.host) || !isNumber(value.port) || !isString(value.roomCode)) return null;
    createLanSyncAddress(value.host, value.port);
    const roomCode = normalizeSyncRoomCode(value.roomCode);
    const projectSyncKey = value.version === 2 && isString(value.projectSyncKey) ? normalizeSyncProjectKey(value.projectSyncKey) : undefined;
    return /^[A-Z0-9]{4,12}$/.test(roomCode) ? { host: value.host, port: value.port, roomCode, projectSyncKey, version: value.version } : null;
  } catch {
    return null;
  }
}

export type SyncRole = "host" | "client";
export type SyncRecordingState = "idle" | "leading" | "recording" | "trailing" | "saving" | "playing" | "error";
export type SyncCommandName = "start" | "stop" | "previous" | "next" | "jump" | "play" | "rerecord" | "cancel" | "complete";

export type SyncCommand = {
  id: string;
  name: SyncCommandName;
  projectId: string;
  sentenceIndex: number;
  executeAt: number;
  issuedAt: number;
};

export type SyncDevice = {
  id: string;
  name: string;
  role: SyncRole;
  state: SyncRecordingState;
  sentenceIndex: number;
  connectedAt: number;
  updatedAt: number;
  latencyMs?: number;
  detail?: string;
};

function normalizeScriptKeyText(value: string) {
  return value.normalize("NFC").replace(/\r\n|\r|\n/g, "\n").trim();
}

function stableKeyChecksum(value: string) {
  let checksum = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    checksum ^= value.charCodeAt(index);
    checksum = Math.imul(checksum, 16777619);
  }
  return (checksum >>> 0).toString(16).padStart(8, "0");
}

export type SyncMessage =
  | { type: "hello"; roomCode: string; projectId: string; deviceId: string; deviceName: string; sentAt: number }
  | { type: "welcome"; roomCode: string; projectId: string; serverTime: number; devices: SyncDevice[] }
  | { type: "command"; command: SyncCommand }
  | { type: "device-state"; device: Omit<SyncDevice, "role" | "connectedAt">; sentAt: number }
  | { type: "ping"; sentAt: number }
  | { type: "pong"; sentAt: number }
  | { type: "error"; message: string };

export function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function createProjectSyncKey(sourceFileName: string, sentences: Array<{ rawText: string; tokens: Array<{ char: string }> }>) {
  const source = normalizeScriptKeyText(sourceFileName).toLowerCase();
  const text = sentences.map((sentence) => normalizeScriptKeyText(sentence.rawText || sentence.tokens.map((token) => token.char).join(""))).join("\u241E");
  return `v3|${source}|${sentences.length}|${stableKeyChecksum(text)}`;
}

export function createSyncCommand(input: Omit<SyncCommand, "id" | "issuedAt" | "executeAt">, now = Date.now()): SyncCommand {
  return { ...input, id: `cmd_${now}_${Math.random().toString(36).slice(2, 8)}`, issuedAt: now, executeAt: now + LAN_SYNC_EXECUTION_LEAD_MS };
}

export function parseSyncMessage(raw: string): SyncMessage | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || !("type" in value) || typeof value.type !== "string") return null;
    const message = value as Record<string, unknown>;
    if (message.type === "hello" && isString(message.roomCode) && isString(message.projectId) && isString(message.deviceId) && isString(message.deviceName) && isNumber(message.sentAt)) {
      return { type: "hello", roomCode: message.roomCode, projectId: message.projectId, deviceId: message.deviceId, deviceName: message.deviceName, sentAt: message.sentAt };
    }
    if (message.type === "welcome" && isString(message.roomCode) && isString(message.projectId) && isNumber(message.serverTime) && Array.isArray(message.devices) && message.devices.every(isSyncDevice)) {
      return { type: "welcome", roomCode: message.roomCode, projectId: message.projectId, serverTime: message.serverTime, devices: message.devices };
    }
    if (message.type === "command" && isSyncCommand(message.command)) return { type: "command", command: message.command };
    if (message.type === "device-state" && isDeviceUpdate(message.device) && isNumber(message.sentAt)) return { type: "device-state", device: message.device, sentAt: message.sentAt };
    if ((message.type === "ping" || message.type === "pong") && isNumber(message.sentAt)) return { type: message.type, sentAt: message.sentAt };
    if (message.type === "error" && isString(message.message)) return { type: "error", message: message.message };
    return null;
  } catch {
    return null;
  }
}

function isString(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function isNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

function isSyncCommand(value: unknown): value is SyncCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as Record<string, unknown>;
  return isString(command.id) && isString(command.projectId) && isNumber(command.sentenceIndex) && isNumber(command.executeAt) && isNumber(command.issuedAt) && (command.name === "start" || command.name === "stop" || command.name === "previous" || command.name === "next" || command.name === "jump" || command.name === "play" || command.name === "rerecord" || command.name === "cancel" || command.name === "complete");
}

function isSyncDevice(value: unknown): value is SyncDevice {
  if (!value || typeof value !== "object") return false;
  const device = value as Record<string, unknown>;
  return isString(device.id) && isString(device.name) && (device.role === "host" || device.role === "client") && isRecordingState(device.state) && isNumber(device.sentenceIndex) && isNumber(device.connectedAt) && isNumber(device.updatedAt) && (device.latencyMs === undefined || isNumber(device.latencyMs)) && (device.detail === undefined || typeof device.detail === "string");
}

function isDeviceUpdate(value: unknown): value is Omit<SyncDevice, "role" | "connectedAt"> {
  if (!value || typeof value !== "object") return false;
  const device = value as Record<string, unknown>;
  return isString(device.id) && isString(device.name) && isRecordingState(device.state) && isNumber(device.sentenceIndex) && isNumber(device.updatedAt) && (device.latencyMs === undefined || isNumber(device.latencyMs)) && (device.detail === undefined || typeof device.detail === "string");
}

function isRecordingState(value: unknown): value is SyncRecordingState {
  return value === "idle" || value === "leading" || value === "recording" || value === "trailing" || value === "saving" || value === "playing" || value === "error";
}
