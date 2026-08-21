import { describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  EncodingType: { UTF8: "utf8", Base64: "base64" },
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  copyAsync: vi.fn(),
  deleteAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import { parseScriptContent } from "@/lib/recorder-files";

describe("parseScriptContent", () => {
  it("将 CSV 的第一列映射为朗读文本、第二列映射为提示词", () => {
    const sentences = parseScriptContent("你好世界,自然地朗读\n早上好,语速稍慢", "sample.csv");
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toMatchObject({ index: 1, rawText: "你好世界", prompt: "自然地朗读" });
    expect(sentences[1]).toMatchObject({ index: 2, rawText: "早上好", prompt: "语速稍慢" });
  });

  it("将普通 TXT 的每一行解析为一句", () => {
    const sentences = parseScriptContent("第一句\n\n第二句", "sample.txt");
    expect(sentences.map((sentence) => sentence.rawText)).toEqual(["第一句", "第二句"]);
    expect(sentences[0].tokens.map((token) => token.char).join("")).toBe("第一句");
  });

  it("保留拼音 JSON 中字元与提示词的绑定关系", () => {
    const content = JSON.stringify([
      { char: "你", pinyin: "nǐ" },
      { char: "好", pinyin: "hǎo" },
      { Mark: "请自然问候" },
    ]);
    const [sentence] = parseScriptContent(content, "pinyin.json");
    expect(sentence.rawText).toBe("你好");
    expect(sentence.prompt).toBe("请自然问候");
    expect(sentence.tokens).toEqual([{ char: "你", pinyin: "nǐ" }, { char: "好", pinyin: "hǎo" }]);
  });
});
