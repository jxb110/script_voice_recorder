const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveTaskEditState, shouldShowRecordedStatus } = require("./task-access.js");

test("被控同步中的桌面任务锁定脚本、基础信息和主控创建", () => {
  const result = resolveTaskEditState({ recordingCount: 0, syncMode: "client" });
  assert.equal(result.disabled, true);
  assert.equal(result.lockedByClientSync, true);
  assert.equal(result.hostDisabled, true);
});

test("新建且未录音的本地任务立即允许编辑", () => {
  const result = resolveTaskEditState({ recordingCount: 0, syncMode: "idle" });
  assert.equal(result.disabled, false);
  assert.equal(result.hostDisabled, false);
});

test("已有 WAV 的任务无论同步状态均锁定基础信息和脚本", () => {
  const result = resolveTaskEditState({ recordingCount: 1, syncMode: "host" });
  assert.equal(result.disabled, true);
  assert.equal(result.lockedByRecording, true);
});

test("任务摘要仅在已有录音时显示已录状态", () => {
  assert.equal(shouldShowRecordedStatus({ recordingCount: 0 }), false);
  assert.equal(shouldShowRecordedStatus({ recordingCount: 1 }), true);
});
