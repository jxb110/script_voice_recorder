const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveMicrophoneRecordingPlan } = require("./multi-microphone.js");

test("多通道模式按用户选择顺序将每个麦克风映射为一个 WAV 通道", () => {
  const plan = resolveMicrophoneRecordingPlan({ channelMode: "multi", microphoneIds: ["mic-b", "mic-a", "mic-c"] });
  assert.deepEqual(plan.microphoneIds, ["mic-b", "mic-a", "mic-c"]);
  assert.equal(plan.channelCount, 3);
  assert.equal(plan.isMultiChannel, true);
  assert.equal(plan.mixesInputs, false);
});

test("单通道模式会将多个已选麦克风融合为一个 WAV 通道", () => {
  const plan = resolveMicrophoneRecordingPlan({ channelMode: "single", microphoneIds: ["mic-b", "mic-a"] });
  assert.equal(plan.channelCount, 1);
  assert.equal(plan.isMultiChannel, false);
  assert.equal(plan.mixesInputs, true);
});

test("多通道模式只选择一个麦克风时仍录制为单通道", () => {
  const plan = resolveMicrophoneRecordingPlan({ channelMode: "multi", microphoneIds: ["mic-a"] });
  assert.equal(plan.channelCount, 1);
  assert.equal(plan.isMultiChannel, false);
});

test("未展开选择麦克风时使用系统默认麦克风录制为单通道", () => {
  const plan = resolveMicrophoneRecordingPlan({ channelMode: "single", microphoneIds: [] });
  assert.deepEqual(plan.microphoneIds, []);
  assert.equal(plan.channelCount, 1);
  assert.equal(plan.isMultiChannel, false);
});
