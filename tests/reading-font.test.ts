import { describe, expect, it } from "vitest";

import { clampReadingFontSize, pinyinFontSizeForReadingFont, READING_FONT_SIZE } from "@/lib/reading-font";

describe("朗读文字号规则", () => {
  it("将字号限制在滑条可选范围内", () => {
    expect(clampReadingFontSize(12)).toBe(READING_FONT_SIZE.minimumValue);
    expect(clampReadingFontSize(50)).toBe(READING_FONT_SIZE.maximumValue);
    expect(clampReadingFontSize(31.6)).toBe(32);
  });

  it("按朗读汉字字号等比调整拼音字号", () => {
    expect(pinyinFontSizeForReadingFont(29)).toBe(13);
    expect(pinyinFontSizeForReadingFont(42)).toBe(19);
  });
});
