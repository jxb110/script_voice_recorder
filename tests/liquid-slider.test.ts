import { describe, expect, it } from "vitest";

import { resolveLiquidSliderValue } from "@/lib/liquid-slider";

describe("液态字体滑块", () => {
  it("在完整热区内支持点击和拖拽，并按步进限制值", () => {
    expect(resolveLiquidSliderValue(0, 240, 10, 100)).toBe(10);
    expect(resolveLiquidSliderValue(120, 240, 10, 100)).toBe(55);
    expect(resolveLiquidSliderValue(300, 240, 10, 100)).toBe(100);
  });
});
