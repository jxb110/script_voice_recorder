import { describe, expect, it } from "vitest";

import { READING_FONT_SIZE } from "@/lib/reading-font";
import { DEFAULT_RECORDER_SETTINGS } from "@/shared/recorder-types";

describe("录音默认设置", () => {
  it("默认使用 20 号朗读字体", () => {
    expect(DEFAULT_RECORDER_SETTINGS.readingFontSize).toBe(20);
    expect(DEFAULT_RECORDER_SETTINGS.readingFontSize).toBeGreaterThanOrEqual(READING_FONT_SIZE.minimumValue);
    expect(DEFAULT_RECORDER_SETTINGS.readingFontSize).toBeLessThanOrEqual(READING_FONT_SIZE.maximumValue);
  });

  it("默认使用 500ms 首尾静音、16-bit 与单通道", () => {
    expect(DEFAULT_RECORDER_SETTINGS.leadingSilenceMs).toBe(500);
    expect(DEFAULT_RECORDER_SETTINGS.trailingSilenceMs).toBe(500);
    expect(DEFAULT_RECORDER_SETTINGS.bitDepth).toBe(16);
    expect(DEFAULT_RECORDER_SETTINGS.channels).toBe(1);
    expect(DEFAULT_RECORDER_SETTINGS.sampleRate).toBe(48000);
  });
});
