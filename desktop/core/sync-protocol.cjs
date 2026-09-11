const LAN_SYNC_PORT = 35679;
const LAN_SYNC_NATIVE_PROTOCOL = "SCRIPT-RECORDER-SYNC/1";
const LAN_SYNC_EXECUTION_LEAD_MS = 850;
const HEARTBEAT_MS = 5000;
const DEVICE_OFFLINE_AFTER_MS = HEARTBEAT_MS * 3;

function normalizeRoomCode(value) { return String(value ?? "").trim().toUpperCase().replace(/\s+/g, ""); }
function createRoomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function createCommand(name, projectId, sentenceIndex, now = Date.now()) { return { id: `cmd_${now}_${Math.random().toString(36).slice(2, 8)}`, name, projectId, sentenceIndex, issuedAt: now, executeAt: now + LAN_SYNC_EXECUTION_LEAD_MS }; }
function parseMessage(line) { try { const value = JSON.parse(line); return value && typeof value.type === "string" ? value : null; } catch { return null; } }
function isValidCount(value) { return Number.isInteger(value) && value > 0; }
function createDevice({ id, name, role, sentenceCount }) { const now = Date.now(); return { id, name: String(name || (role === "host" ? "电脑主控" : "电脑录音设备")).trim(), role, state: "idle", sentenceIndex: 0, connectedAt: now, updatedAt: now, sentenceCount }; }

module.exports = { LAN_SYNC_PORT, LAN_SYNC_NATIVE_PROTOCOL, HEARTBEAT_MS, DEVICE_OFFLINE_AFTER_MS, normalizeRoomCode, createRoomCode, createCommand, parseMessage, isValidCount, createDevice };
