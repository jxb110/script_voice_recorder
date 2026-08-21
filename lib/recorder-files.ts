import { strToU8, zipSync } from "fflate";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import type { ScriptProject, ScriptSentence, ScriptToken, Speaker } from "@/shared/recorder-types";

const ROOT_DIRECTORY = FileSystem.documentDirectory ?? "";
const SCRIPTS_DIRECTORY = `${ROOT_DIRECTORY}scripts/`;
const RECORDINGS_DIRECTORY = `${ROOT_DIRECTORY}recordings/`;
const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const cleanFileSegment = (value: string) => value.trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 48) || "未命名";

async function ensureDirectory(uri: string) {
  if (!(await FileSystem.getInfoAsync(uri)).exists) await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
}

const plainTokens = (text: string): ScriptToken[] => Array.from(text.trim()).map((char) => ({ char }));
const tokenText = (tokens: ScriptToken[]) => tokens.map((token) => token.char).join("");

function makeSentence(index: number, rawText: string, prompt = "", tokens?: ScriptToken[]): ScriptSentence {
  const cleanTokens = tokens?.filter((token) => token.char) ?? plainTokens(rawText);
  return { id: createId("sentence"), index, prompt: prompt.trim(), rawText: rawText.trim() || tokenText(cleanTokens), tokens: cleanTokens };
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let buffer = "";
  let inQuote = false;
  for (let position = 0; position < line.length; position += 1) {
    const character = line[position];
    if (character === '"') {
      if (inQuote && line[position + 1] === '"') { buffer += '"'; position += 1; }
      else inQuote = !inQuote;
    } else if (character === delimiter && !inQuote) {
      values.push(buffer.trim());
      buffer = "";
    } else buffer += character;
  }
  values.push(buffer.trim());
  return values;
}

function readMarker(value: unknown) {
  if (!value || typeof value !== "object" || !("Mark" in value)) return "";
  const marker = (value as { Mark?: unknown }).Mark;
  return typeof marker === "string" ? marker.trim() : "";
}

function parseTokenSentence(value: unknown, index: number, inheritedPrompt = ""): ScriptSentence | null {
  if (Array.isArray(value)) {
    const marker = value.map(readMarker).find(Boolean) ?? "";
    const tokens = value
      .filter((entry): entry is { char: string; pinyin?: string } => Boolean(entry) && typeof entry === "object" && "char" in entry)
      .map((entry) => ({ char: String(entry.char), pinyin: entry.pinyin ? String(entry.pinyin) : undefined }));
    return tokens.length ? makeSentence(index, tokenText(tokens), marker || inheritedPrompt, tokens) : null;
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const prompt = String(source.prompt ?? source.Mark ?? source.hint ?? inheritedPrompt ?? "").trim();
    const rawText = String(source.text ?? source.rawText ?? source.script ?? source.reading ?? source.content ?? "");
    if (Array.isArray(source.tokens)) return parseTokenSentence(source.tokens, index, prompt);
    return rawText.trim() ? makeSentence(index, rawText, prompt) : null;
  }
  return typeof value === "string" && value.trim() ? makeSentence(index, value, inheritedPrompt) : null;
}

export function parseScriptContent(content: string, fileName: string): ScriptSentence[] {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  if (!normalized) throw new Error("脚本文件为空，请至少保留一行朗读文本。");
  if (fileName.toLowerCase().endsWith(".json") || normalized.startsWith("[")) {
    try {
      const parsed = JSON.parse(normalized) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const isSingleTokenSequence = values.length > 0 && values.some((entry) => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry) && "char" in entry) && values.every((entry) => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry) && !("tokens" in entry) && ("char" in entry || "Mark" in entry));
      const sentences = (isSingleTokenSequence ? [values] : values)
        .map((value, index) => parseTokenSentence(value, index + 1))
        .filter((value): value is ScriptSentence => value !== null);
      if (sentences.length) return sentences;
    } catch {
      if (fileName.toLowerCase().endsWith(".json")) throw new Error("JSON 脚本格式无法解析。请检查逗号、括号以及 char、pinyin、Mark 字段。");
    }
  }
  const rows = normalized.split(/\r?\n/).filter((line) => line.trim());
  const extension = fileName.split(".").pop()?.toLowerCase();
  const delimiter = extension === "tsv" || (extension === "txt" && rows.some((line) => line.includes("\t"))) ? "\t" : extension === "csv" ? "," : "";
  return rows.map((line, index) => {
    const [reading = "", prompt = ""] = delimiter ? splitDelimitedLine(line, delimiter) : [line, ""];
    return makeSentence(index + 1, reading, prompt);
  });
}

export async function persistImportedScript(sourceUri: string, originalName: string) {
  if (Platform.OS === "web") return sourceUri;
  await ensureDirectory(SCRIPTS_DIRECTORY);
  const destination = `${SCRIPTS_DIRECTORY}${Date.now()}_${cleanFileSegment(originalName)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

export async function readImportedScript(uri: string) {
  if (Platform.OS === "web") return (await fetch(uri)).text();
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

const getSpeakerFolderName = (speaker: Speaker) => `${cleanFileSegment(speaker.name)}_${speaker.gender}_${speaker.age}岁`;

export async function persistRecording(sourceUri: string, project: ScriptProject, sentence: ScriptSentence, speaker: Speaker) {
  if (Platform.OS === "web") return sourceUri;
  const folder = `${RECORDINGS_DIRECTORY}${getSpeakerFolderName(speaker)}/${cleanFileSegment(project.name)}/`;
  await ensureDirectory(folder);
  const paragraph = String(sentence.index).padStart(3, "0");
  const baseName = cleanFileSegment(project.sourceFileName.replace(/\.[^.]+$/, ""));
  const destination = `${folder}${baseName}_${cleanFileSegment(speaker.name)}_${paragraph}.m4a`;
  if ((await FileSystem.getInfoAsync(destination)).exists) await FileSystem.deleteAsync(destination, { idempotent: true });
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

function base64ToBytes(value: string) {
  const binary = globalThis.atob(value);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  return result;
}

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < value.length; offset += chunkSize) binary += String.fromCharCode(...value.subarray(offset, offset + chunkSize));
  return globalThis.btoa(binary);
}

export async function createRecordingArchive(project: ScriptProject, speaker: Speaker) {
  if (Platform.OS === "web") throw new Error("浏览器预览不支持打包本地录音，请在 Android 设备上使用分享功能。");
  const entries: Record<string, Uint8Array> = {};
  const folderName = `${getSpeakerFolderName(speaker)}/${cleanFileSegment(project.name)}`;
  entries[`${folderName}/manifest.json`] = strToU8(JSON.stringify({ project: project.name, speaker: { name: speaker.name, gender: speaker.gender, age: speaker.age }, exportedAt: new Date().toISOString(), recordings: project.sentences.map((sentence) => ({ index: sentence.index, prompt: sentence.prompt, text: sentence.rawText, recorded: Boolean(sentence.recordingUri) })) }, null, 2));
  for (const sentence of project.sentences) {
    if (!sentence.recordingUri || !(await FileSystem.getInfoAsync(sentence.recordingUri)).exists) continue;
    const audioBase64 = await FileSystem.readAsStringAsync(sentence.recordingUri, { encoding: FileSystem.EncodingType.Base64 });
    entries[`${folderName}/${cleanFileSegment(project.sourceFileName.replace(/\.[^.]+$/, ""))}_${cleanFileSegment(speaker.name)}_${String(sentence.index).padStart(3, "0")}.m4a`] = base64ToBytes(audioBase64);
  }
  const archive = zipSync(entries, { level: 6 });
  const exportDirectory = `${ROOT_DIRECTORY}exports/`;
  await ensureDirectory(exportDirectory);
  const target = `${exportDirectory}${cleanFileSegment(project.name)}_${cleanFileSegment(speaker.name)}_录音包.zip`;
  await FileSystem.writeAsStringAsync(target, bytesToBase64(archive), { encoding: FileSystem.EncodingType.Base64 });
  return target;
}
