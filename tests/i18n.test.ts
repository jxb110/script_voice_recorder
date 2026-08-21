import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({ useLocales: () => [] }));

import { languageFromCode, translations } from "@/lib/i18n";

describe("系统语言回退规则", () => {
  it("中文系统语言显示中文", () => {
    expect(languageFromCode("zh-CN")).toBe("zh");
    expect(languageFromCode("zh-Hant")).toBe("zh");
  });

  it("所有非中文系统语言回退为英文", () => {
    expect(languageFromCode("en-US")).toBe("en");
    expect(languageFromCode("ja-JP")).toBe("en");
    expect(languageFromCode(null)).toBe("en");
  });

  it("中英文资源提供相同的核心文案键", () => {
    expect(Object.keys(translations.zh).sort()).toEqual(Object.keys(translations.en).sort());
  });
});
