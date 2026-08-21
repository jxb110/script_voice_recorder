import { describe, expect, it } from "vitest";

import { canReplaceProjectScript, hasRecordingProgress } from "@/lib/project-rules";

describe("任务脚本更换保护规则", () => {
  const baseProject = { sentences: [{ id: "line-1", index: 1, prompt: "", rawText: "你好", tokens: [{ char: "你" }, { char: "好" }] }] };

  it("允许尚无任何录音进度的任务更换脚本", () => {
    expect(hasRecordingProgress(baseProject.sentences)).toBe(false);
    expect(canReplaceProjectScript(baseProject)).toBe(true);
  });

  it("锁定已有录音进度的任务，防止录音与更换后的文本错配", () => {
    const recordedProject = { sentences: [{ ...baseProject.sentences[0], recordingUri: "file:///recordings/001.wav" }] };
    expect(hasRecordingProgress(recordedProject.sentences)).toBe(true);
    expect(canReplaceProjectScript(recordedProject)).toBe(false);
  });
});
