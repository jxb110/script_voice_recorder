import { describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  cacheDirectory: "file:///cache/",
  EncodingType: { UTF8: "utf8", Base64: "base64" },
  getInfoAsync: vi.fn(), makeDirectoryAsync: vi.fn(), copyAsync: vi.fn(), deleteAsync: vi.fn(), readAsStringAsync: vi.fn(), writeAsStringAsync: vi.fn(),
}));
vi.mock("expo-media-library", () => ({
  getPermissionsAsync: vi.fn(), requestPermissionsAsync: vi.fn(), getAlbumAsync: vi.fn(), createAssetAsync: vi.fn(), createAlbumAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import { getPublicAudioAlbumName, parseScriptContent } from "@/lib/recorder-files";
import { createProjectSyncKey } from "@/lib/lan-sync-protocol";

const makeLine = (label: string, prompt: string) => JSON.stringify([
  { char: `你${label}`, pinyin: "nǐ" },
  { char: "好", pinyin: "hǎo" },
  { char: "世", pinyin: "shì" },
  { char: "界", pinyin: "jiè" },
  { Mark: prompt },
]);

describe("逐行 JSON TXT 脚本", () => {
  it("将 TXT 的每一行解析为一句，并保留 char、pinyin 与 Mark", () => {
    const sentences = parseScriptContent(`${makeLine("1", "提示词1")}\n${makeLine("2", "提示词2")}\n${makeLine("3", "提示词3")}`, "sample.txt");
    expect(sentences).toHaveLength(3);
    expect(sentences.map((sentence) => sentence.rawText)).toEqual(["你1好世界", "你2好世界", "你3好世界"]);
    expect(sentences.map((sentence) => sentence.prompt)).toEqual(["提示词1", "提示词2", "提示词3"]);
    expect(sentences[0].tokens).toEqual([{ char: "你1", pinyin: "nǐ" }, { char: "好", pinyin: "hǎo" }, { char: "世", pinyin: "shì" }, { char: "界", pinyin: "jiè" }]);
  });

  it("将 LF、CRLF 与 CR 换行格式解析为相同脚本和同步任务键", () => {
    const lines = [makeLine("1", "提示词1"), makeLine("2", "提示词2")];
    const parsed = ["\n", "\r\n", "\r"].map((lineEnding) => parseScriptContent(lines.join(lineEnding), "sample.txt"));
    expect(parsed.map((sentences) => sentences.map((sentence) => sentence.rawText))).toEqual([["你1好世界", "你2好世界"], ["你1好世界", "你2好世界"], ["你1好世界", "你2好世界"]]);
    expect(new Set(parsed.map((sentences) => createProjectSyncKey("sample.txt", sentences))).size).toBe(1);
  });

  it("拒绝不是 TXT 的脚本文件", () => {
    expect(() => parseScriptContent(makeLine("1", "提示词1"), "sample.json")).toThrow("仅支持 TXT 脚本文件");
  });

  it("提示具体的错误行，避免导入普通文本或格式错误 JSON", () => {
    expect(() => parseScriptContent(`${makeLine("1", "提示词1")}\n不是 JSON`, "sample.txt")).toThrow("第 2 行不是合法 JSON");
    expect(() => parseScriptContent("{\"char\":\"你\"}", "sample.txt")).toThrow("第 1 行必须是 JSON 数组");
  });

  it("将公共音频相册按 record_jxb、发音人和任务名分层命名", () => {
    const name = getPublicAudioAlbumName({ name: "任务 A", sourceFileName: "sample.txt", sentences: [] } as never, { name: "张 三", gender: "女", age: 25 } as never);
    expect(name).toBe("record_jxb/wave/张_三_女_25岁/任务_A");
  });
});
