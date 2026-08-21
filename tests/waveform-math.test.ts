import { describe, expect, it } from "vitest";

import { appendWaveformSample, normalizeMetering } from "@/lib/waveform-math";

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

  it("持续保留固定数量的平滑采样点", () => {
    const next = appendWaveformSample([0.1, 0.2, 0.3], -10, 3);
    expect(next).toHaveLength(3);
    expect(next.at(-1)).toBeGreaterThan(0.3);
  });
});
