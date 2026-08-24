export const LAN_SYNC_PORT = 35679;
export const LAN_SYNC_EXECUTION_LEAD_MS = 850;

export type SyncRole = "host" | "client";
export type SyncRecordingState = "idle" | "leading" | "recording" | "trailing" | "saving" | "playing" | "error";
export type SyncCommandName = "start" | "stop" | "previous" | "next" | "play" | "rerecord";

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
  const first = sentences.at(0);
  const last = sentences.at(-1);
  const toText = (sentence?: { rawText: string; tokens: Array<{ char: string }> }) => (sentence?.rawText || sentence?.tokens.map((token) => token.char).join("") || "").slice(0, 48);
  return `${sourceFileName.trim().toLowerCase()}|${sentences.length}|${toText(first)}|${toText(last)}`;
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
  return isString(command.id) && isString(command.projectId) && isNumber(command.sentenceIndex) && isNumber(command.executeAt) && isNumber(command.issuedAt) && (command.name === "start" || command.name === "stop" || command.name === "previous" || command.name === "next" || command.name === "play" || command.name === "rerecord");
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
