const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { formatRecordingTimestamp, getRecordingTarget } = require("./recording-paths.cjs");

test("桌面端保持与手机一致的可读时间格式", () => {
  assert.equal(formatRecordingTimestamp(new Date(2026, 7, 25, 16, 36, 41).getTime()), "20260825-163641");
});

test("桌面端 WAV 按任务、发音人、句号和时间戳命名并放入共享目录结构", () => {
  const timestamp = new Date(2026, 7, 25, 16, 36, 41).getTime();
  const result = getRecordingTarget("D:/Audio", { name: "任务 A" }, { name: "张 三", gender: "女", age: 25 }, 4, timestamp);
  assert.equal(result.fileName, "任务_A_张_三_004_20260825-163641.wav");
  assert.equal(result.directory, path.join("D:/Audio", "record_jxb", "wave", "张_三_女_25岁", "任务_A"));
});
