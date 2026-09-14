const SYNC_INVITE_TYPE = "script-recorder-sync";

function normalizeAddress(address) {
  const raw = String(address || "").trim().replace(/^wss?:\/\//i, "");
  const separator = raw.lastIndexOf(":");
  const host = separator > 0 ? raw.slice(0, separator).trim() : "";
  const port = separator > 0 ? Number(raw.slice(separator + 1)) : NaN;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("主控房间地址无效，无法生成二维码。");
  return { host, port };
}

function createDesktopSyncRoomInvite(session) {
  if (!session || session.mode !== "host") throw new Error("请先创建主控房间，再生成二维码。");
  const { host, port } = normalizeAddress(session.address);
  const roomCode = String(session.roomCode || "").trim().toUpperCase().replace(/\s+/g, "");
  const projectSyncKey = String(session.projectId || "").trim();
  if (!/^[A-Z0-9]{4,12}$/.test(roomCode)) throw new Error("主控房间口令无效，无法生成二维码。");
  if (!projectSyncKey) throw new Error("主控同步任务键无效，无法生成二维码。");
  return JSON.stringify({ type: SYNC_INVITE_TYPE, version: 2, host, port, roomCode, projectSyncKey });
}

module.exports = { createDesktopSyncRoomInvite };
