import { describe, expect, it } from "vitest";

import { shouldAnimatePromptChange } from "@/lib/prompt-animation";

describe("提示词水波动效触发条件", () => {
  it("首次展示提示词时不播放动效", () => {
    expect(shouldAnimatePromptChange(null, "请自然朗读")).toBe(false);
  });

  it("相同提示词及仅空白差异的提示词不播放动效", () => {
    expect(shouldAnimatePromptChange("请自然朗读", "请自然朗读")).toBe(false);
    expect(shouldAnimatePromptChange("请  自然朗读", "请 自然朗读 ")).toBe(false);
  });

  it("提示词内容变化时播放动效", () => {
    expect(shouldAnimatePromptChange("请自然朗读", "请使用疑问语气朗读")).toBe(true);
  });
});
