const test = require("node:test");
const assert = require("node:assert/strict");

const { SyncRoom } = require("./sync-room.cjs");

function waitFor(check, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const tick = () => {
      const value = check();
      if (value) return resolve(value);
      if (Date.now() - startedAt > timeoutMs) return reject(new Error("等待同步事件超时。"));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test("桌面端可创建 TCP 主控房间并允许相同句数客户端加入和接收指令", async () => {
  const hostEvents = [];
  const clientEvents = [];
  const host = new SyncRoom((event) => hostEvents.push(event));
  const client = new SyncRoom((event) => clientEvents.push(event));

  try {
    const hosted = await host.host({ projectId: "desktop|2|10", sentenceCount: 2, deviceName: "Windows 主控" });
    const joined = await client.join({ host: "127.0.0.1", port: 35679, roomCode: hosted.roomCode, projectId: "phone|2|99", sentenceCount: 2, deviceName: "Android 录音设备" });
    assert.equal(joined.mode, "client");
    assert.equal(host.snapshot().devices.filter((device) => device.role === "client").length, 1);

    host.sendCommand("jump", 1);
    const command = await waitFor(() => clientEvents.find((event) => event.type === "command")?.payload);
    assert.equal(command.name, "jump");
    assert.equal(command.sentenceIndex, 1);
  } finally {
    await client.stop();
    await host.stop();
  }
});

test("桌面端明确拒绝句数不一致的客户端而不比较脚本内容", async () => {
  const host = new SyncRoom(() => {});
  const client = new SyncRoom(() => {});
  try {
    const hosted = await host.host({ projectId: "desktop|3|12", sentenceCount: 3, deviceName: "Windows 主控" });
    await assert.rejects(
      () => client.join({ host: "127.0.0.1", port: 35679, roomCode: hosted.roomCode, projectId: "phone|2|90", sentenceCount: 2, deviceName: "Android 录音设备" }),
      /录音句数不一致：主控 3 句，当前设备 2 句。/,
    );
  } finally {
    await client.stop();
    await host.stop();
  }
});
