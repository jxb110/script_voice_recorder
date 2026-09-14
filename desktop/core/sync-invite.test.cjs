const assert = require("node:assert/strict");
const test = require("node:test");
const QRCode = require("qrcode");
const { createDesktopSyncRoomInvite } = require("./sync-invite.cjs");

test("桌面端主控二维码使用 Android 可识别的 v2 邀请格式", () => {
  const raw = createDesktopSyncRoomInvite({ mode: "host", address: "192.168.1.20:35679", roomCode: " ab12cd ", projectId: "desktop|4|28" });
  assert.deepEqual(JSON.parse(raw), { type: "script-recorder-sync", version: 2, host: "192.168.1.20", port: 35679, roomCode: "AB12CD", projectSyncKey: "desktop|4|28" });
});

test("桌面端仅允许为有效主控房间生成二维码", () => {
  assert.throws(() => createDesktopSyncRoomInvite({ mode: "client" }), /请先创建主控房间/);
});

test("桌面端主控邀请可生成供渲染层显示的 PNG 二维码数据地址", async () => {
  const payload = createDesktopSyncRoomInvite({ mode: "host", address: "10.0.0.8:35679", roomCode: "AB12CD", projectId: "desktop|2|20" });
  const image = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", width: 264 });
  assert.match(image, /^data:image\/png;base64,/);
});
