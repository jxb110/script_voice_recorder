import { describe, expect, it } from "vitest";

import { READING_FONT_SIZE } from "@/lib/reading-font";
import { DEFAULT_RECORDER_SETTINGS } from "@/shared/recorder-types";

describe("录音默认设置", () => {
  it("默认使用最小朗读字号", () => {
    expect(DEFAULT_RECORDER_SETTINGS.readingFontSize).toBe(READING_FONT_SIZE.minimumValue);
  });

  it("默认使用 500ms 首尾静音、16-bit 与单通道", () => {
    expect(DEFAULT_RECORDER_SETTINGS.leadingSilenceMs).toBe(500);
    expect(DEFAULT_RECORDER_SETTINGS.trailingSilenceMs).toBe(500);
    expect(DEFAULT_RECORDER_SETTINGS.bitDepth).toBe(16);
    expect(DEFAULT_RECORDER_SETTINGS.channels).toBe(1);
    expect(DEFAULT_RECORDER_SETTINGS.sampleRate).toBe(48000);
  });
});
