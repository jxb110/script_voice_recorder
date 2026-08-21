import { strToU8, zipSync } from "fflate";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

import type { ScriptProject, ScriptSentence, ScriptToken, Speaker } from "@/shared/recorder-types";

const ROOT_DIRECTORY = FileSystem.documentDirectory ?? "";
const EXPORT_STAGING_DIRECTORY = `${FileSystem.cacheDirectory ?? ROOT_DIRECTORY}record_jxb_exports/`;
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

function readMarker(value: unknown) {
  if (!value || typeof value !== "object" || !("Mark" in value)) return "";
  const marker = (value as { Mark?: unknown }).Mark;
  return typeof marker === "string" ? marker.trim() : "";
}

function parseTxtJsonLine(line: string, lineNumber: number) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`第 ${lineNumber} 行不是合法 JSON。每一行必须是以 [ 开始、以 ] 结束的字元数组。`);
  }
  if (!Array.isArray(parsed)) throw new Error(`第 ${lineNumber} 行必须是 JSON 数组。`);
  const tokens = parsed
    .filter((entry): entry is { char: string; pinyin?: string } => Boolean(entry) && typeof entry === "object" && "char" in entry)
    .map((entry) => ({ char: String(entry.char), pinyin: entry.pinyin ? String(entry.pinyin) : undefined }));
  if (!tokens.length) throw new Error(`第 ${lineNumber} 行缺少 char 字段，无法生成朗读文本。`);
  const prompt = parsed.map(readMarker).find(Boolean) ?? "";
  return makeSentence(lineNumber, tokenText(tokens), prompt, tokens);
}

export function parseScriptContent(content: string, fileName: string): ScriptSentence[] {
  if (!fileName.toLowerCase().endsWith(".txt")) throw new Error("仅支持 TXT 脚本文件。每一行应为一个 JSON 字元数组。");
  const normalized = content.replace(/^\uFEFF/, "").trim();
  if (!normalized) throw new Error("脚本文件为空，请至少保留一行 JSON 字元数组。");
  const rows = normalized.split(/\r?\n/).filter((line) => line.trim());
  return rows.map((line, index) => parseTxtJsonLine(line, index + 1));
}

export async function persistImportedScript(sourceUri: string, originalName: string) {
  if (Platform.OS === "web") return sourceUri;
  await ensureDirectory(SCRIPTS_DIRECTORY);
  const destination = `${SCRIPTS_DIRECTORY}${Date.now()}_${cleanFileSegment(originalName)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

export async function persistTransferredScript(originalName: string, content: string) {
  if (!originalName.toLowerCase().endsWith(".txt")) throw new Error("文件快传仅接收 TXT 脚本文件。");
  parseScriptContent(content, originalName);
  await ensureDirectory(SCRIPTS_DIRECTORY);
  const destination = `${SCRIPTS_DIRECTORY}${Date.now()}_transfer_${cleanFileSegment(originalName)}`;
  await FileSystem.writeAsStringAsync(destination, content, { encoding: FileSystem.EncodingType.UTF8 });
  return destination;
}

export async function readImportedScript(uri: string) {
  if (Platform.OS === "web") return (await fetch(uri)).text();
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

const getSpeakerFolderName = (speaker: Speaker) => `${cleanFileSegment(speaker.name)}_${speaker.gender}_${speaker.age}岁`;

export function getPublicAudioAlbumName(project: ScriptProject, speaker: Speaker) {
  return `record_jxb/wave/${getSpeakerFolderName(speaker)}/${cleanFileSegment(project.name)}`;
}

export async function persistRecording(sourceUri: string, project: ScriptProject, sentence: ScriptSentence, speaker: Speaker) {
  if (Platform.OS === "web") return sourceUri;
  const folder = `${RECORDINGS_DIRECTORY}${getSpeakerFolderName(speaker)}/${cleanFileSegment(project.name)}/`;
  await ensureDirectory(folder);
  const paragraph = String(sentence.index).padStart(3, "0");
  const baseName = cleanFileSegment(project.sourceFileName.replace(/\.[^.]+$/, ""));
  const destination = `${folder}${baseName}_${cleanFileSegment(speaker.name)}_${paragraph}.wav`;
  if ((await FileSystem.getInfoAsync(destination)).exists) await FileSystem.deleteAsync(destination, { idempotent: true });
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

export async function exportRecordingToPublicWaveDirectory(privateUri: string, project: ScriptProject, speaker: Speaker) {
  if (Platform.OS !== "android") return undefined;
  let permission = await MediaLibrary.getPermissionsAsync(true, ["audio"]);
  if (!permission.granted) permission = await MediaLibrary.requestPermissionsAsync(true, ["audio"]);
  if (!permission.granted) throw new Error("未获得保存音频到手机公共目录的权限。录音已保留在应用内部目录。");

  await ensureDirectory(EXPORT_STAGING_DIRECTORY);
  const exportName = `${cleanFileSegment(project.sourceFileName.replace(/\.[^.]+$/, ""))}_${cleanFileSegment(speaker.name)}_${Date.now()}.wav`;
  const stagingUri = `${EXPORT_STAGING_DIRECTORY}${exportName}`;
  const existing = await FileSystem.getInfoAsync(stagingUri);
  if (existing.exists) await FileSystem.deleteAsync(stagingUri, { idempotent: true });
  await FileSystem.copyAsync({ from: privateUri, to: stagingUri });
  const stagedFile = await FileSystem.getInfoAsync(stagingUri);
  if (!stagedFile.exists) throw new Error("无法创建导出音频副本。录音已保留在应用内部目录。");

  const albumName = getPublicAudioAlbumName(project, speaker);
  const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);
  if (existingAlbum) {
    const asset = await MediaLibrary.createAssetAsync(stagingUri, existingAlbum);
    return asset.uri;
  }
  const firstAsset = await MediaLibrary.createAssetAsync(stagingUri);
  const album = await MediaLibrary.createAlbumAsync(albumName, firstAsset, false);
  return album ? firstAsset.uri : undefined;
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
    entries[`${folderName}/${cleanFileSegment(project.sourceFileName.replace(/\.[^.]+$/, ""))}_${cleanFileSegment(speaker.name)}_${String(sentence.index).padStart(3, "0")}.wav`] = base64ToBytes(audioBase64);
  }
  const archive = zipSync(entries, { level: 6 });
  const exportDirectory = `${ROOT_DIRECTORY}exports/`;
  await ensureDirectory(exportDirectory);
  const target = `${exportDirectory}${cleanFileSegment(project.name)}_${cleanFileSegment(speaker.name)}_录音包.zip`;
  await FileSystem.writeAsStringAsync(target, bytesToBase64(archive), { encoding: FileSystem.EncodingType.Base64 });
  return target;
}

export async function deleteProjectLocalFiles(project: ScriptProject) {
  if (Platform.OS === "web") return;
  const paths = new Set([project.sourceFileUri, ...project.sentences.map((sentence) => sentence.recordingUri)].filter((uri): uri is string => Boolean(uri)));
  await Promise.all(Array.from(paths).map(async (uri) => {
    if (!uri.startsWith(ROOT_DIRECTORY)) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  }));
}
