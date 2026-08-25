import { describe, expect, it } from "vitest";

import { resolveLiquidSliderDragValue, resolveLiquidSliderValue } from "@/lib/liquid-slider";

describe("液态字体滑块", () => {
  it("在完整热区内支持点击和拖拽，并在最左端稳定保持最小值", () => {
    expect(resolveLiquidSliderValue(0, 240, 15, 50)).toBe(15);
    expect(resolveLiquidSliderValue(1, 240, 15, 50)).toBe(15);
    expect(resolveLiquidSliderValue(120, 240, 15, 50)).toBe(33);
    expect(resolveLiquidSliderValue(300, 240, 15, 50)).toBe(50);
  });

  it("使用累计位移时，最左边界始终锁定最小值", () => {
    expect(resolveLiquidSliderDragValue(15, -120, 240, 15, 50)).toBe(15);
    expect(resolveLiquidSliderDragValue(15, 0, 240, 15, 50)).toBe(15);
    expect(resolveLiquidSliderDragValue(15, 120, 240, 15, 50)).toBe(33);
  });
});
