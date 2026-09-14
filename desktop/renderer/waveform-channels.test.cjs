const assert = require("node:assert/strict");
const test = require("node:test");
const { createWaveChannels, createWaveLaneLayout } = require("./waveform-channels.js");

test("多通道波形按录音通道数创建独立数据序列", () => {
  const channels = createWaveChannels(3);
  assert.equal(channels.length, 3);
  assert.notEqual(channels[0], channels[1]);
});

test("多通道波形为每个通道分配独立且等高的显示区域", () => {
  const lanes = createWaveLaneLayout(180, 3);
  assert.deepEqual(lanes.map((lane) => lane.center), [30, 90, 150]);
  assert.equal(lanes.every((lane) => lane.maxAmplitude === 25.2), true);
});
