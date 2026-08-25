import { describe, expect, it } from "vitest";

import { peakDbFromSamples, WAVEFORM_WINDOW_MS, waveformBufferLength } from "@/lib/waveform-window";

describe("录制波形窗口", () => {
  it("以 120ms 作为每次波形更新窗口", () => {
    expect(WAVEFORM_WINDOW_MS).toBe(120);
    expect(waveformBufferLength(48_000)).toBe(5_760);
  });

  it("以缓冲区绝对峰值计算分贝，不使用 RMS 均值", () => {
    const samples = new Float32Array([0.1, -0.8, 0.2]);
    expect(peakDbFromSamples(samples)).toBeCloseTo(20 * Math.log10(0.8));
  });
});
