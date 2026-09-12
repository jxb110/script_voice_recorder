const test = require("node:test");
const assert = require("node:assert/strict");

const { collectTaskOutputs } = require("./task-recordings.cjs");

test("删除桌面任务时仅选择当前任务已管理的录音输出", () => {
  const outputs = {
    "任务 A␞发音人甲␞1": "C:/record_jxb/wave/任务 A/发音人甲/a.wav",
    "任务 A␞发音人乙␞2": "C:/record_jxb/wave/任务 A/发音人乙/b.wav",
    "任务 B␞发音人甲␞1": "C:/record_jxb/wave/任务 B/发音人甲/c.wav",
  };
  assert.deepEqual(collectTaskOutputs(outputs, "任务 A"), [
    ["任务 A␞发音人甲␞1", "C:/record_jxb/wave/任务 A/发音人甲/a.wav"],
    ["任务 A␞发音人乙␞2", "C:/record_jxb/wave/任务 A/发音人乙/b.wav"],
  ]);
});
