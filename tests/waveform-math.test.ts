import { describe, expect, it } from "vitest";

import { appendWaveformSample, classifyWaveformSample, normalizeMetering, resampleWaveform, waveformBarHalfHeight, waveformDisplayStrength } from "@/lib/waveform-math";

describe("录音波形数据转换", () => {
  it("将 Android 的负分贝计量归一化为可绘制强度", () => {
    expect(normalizeMetering(-70)).toBeGreaterThan(0);
    expect(normalizeMetering(-20)).toBeGreaterThan(normalizeMetering(-60)!);
    expect(normalizeMetering(0)).toBe(1);
  });

  it("不将网页缺失的计量值伪装成实时波形", () => {
    expect(normalizeMetering(undefined)).toBeNull();
    const samples = [0.1, 0.2, 0.3];
    expect(appendWaveformSample(samples, undefined, 3)).toEqual(samples);
  });

  it("超过显示上限时压缩波形序列而非只保留末尾采样", () => {
    const next = appendWaveformSample([0.1, 0.2, 0.3], -10, 3);
    expect(next.length).toBeLessThanOrEqual(3);
    expect(next[0]).toBeGreaterThan(0.1);
    expect(next.at(-1)).toBeGreaterThan(0.3);
  });

  it("为播放视图重采样完整录制包络，并保留前后峰值", () => {
    const bars = resampleWaveform([0.1, 0.9, 0.2, 0.15, 0.8], 3);
    expect(bars).toHaveLength(3);
    expect(Math.max(...bars)).toBeGreaterThan(0.8);
    expect(bars.at(-1)).toBeGreaterThan(0.7);
  });

  it("将静音段绘制为低平基线，并放大有声段的可观察变化", () => {
    expect(classifyWaveformSample(normalizeMetering(-65)!)).toBe("silence");
    expect(classifyWaveformSample(normalizeMetering(-25)!)).toBe("voice");
    expect(waveformDisplayStrength(normalizeMetering(-65)!)).toBe(0);
    expect(waveformDisplayStrength(normalizeMetering(-25)!)).toBeGreaterThan(0.6);
  });

  it("在任意输入振幅下将双边波形严格限制在显示高度内", () => {
    const height = 58;
    const safeHalfHeight = height / 2 - 5;
    expect(waveformBarHalfHeight(0.025, height)).toBeLessThanOrEqual(safeHalfHeight);
    expect(waveformBarHalfHeight(1, height)).toBeLessThanOrEqual(safeHalfHeight);
    expect(waveformBarHalfHeight(1, height)).toBeGreaterThan(waveformBarHalfHeight(0.025, height));
  });
});
