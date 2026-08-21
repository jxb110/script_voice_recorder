import { describe, expect, it } from "vitest";

import { canContinueRecordingSession, isProjectRecordingComplete } from "@/lib/recording-session";

describe("录制会话控制", () => {
  it("在页面关闭或会话令牌变化后阻止后续录制操作", () => {
    expect(canContinueRecordingSession(2, 2, false)).toBe(true);
    expect(canContinueRecordingSession(2, 3, false)).toBe(false);
    expect(canContinueRecordingSession(2, 2, true)).toBe(false);
  });

  it("仅在所有句子均有录音时显示完成任务入口", () => {
    expect(isProjectRecordingComplete([])).toBe(false);
    expect(isProjectRecordingComplete(["file://one.wav", undefined])).toBe(false);
    expect(isProjectRecordingComplete(["file://one.wav", "file://two.wav"])).toBe(true);
  });
});
