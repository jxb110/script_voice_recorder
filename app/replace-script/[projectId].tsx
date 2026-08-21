import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { parseScriptContent, persistImportedScript, readImportedScript } from "@/lib/recorder-files";
import { useRecorder } from "@/lib/recorder-context";
import type { ScriptSentence } from "@/shared/recorder-types";

type ScriptAsset = { uri: string; name: string; content?: string };
const SCRIPT_NAME_PATTERN = /\.(txt|csv|tsv|json)$/i;

export default function ReplaceScriptScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { projects, replaceProjectScript } = useRecorder();
  const project = projects.find((item) => item.id === projectId);
  const [fileName, setFileName] = useState("");
  const [fileUri, setFileUri] = useState("");
  const [sentences, setSentences] = useState<ScriptSentence[]>([]);
  const [importing, setImporting] = useState(false);
  const recorded = project?.sentences.some((sentence) => sentence.recordingUri) ?? false;

  if (!project) return <ScreenContainer className="items-center justify-center px-6"><Text style={styles.missing}>未找到该录音任务。</Text><TouchableOpacity onPress={() => router.replace("/" as never)}><Text style={styles.backText}>返回主页</Text></TouchableOpacity></ScreenContainer>;
  if (recorded) return <ScreenContainer className="items-center justify-center px-6"><MaterialIcons color="#B7791F" name="lock-outline" size={44} /><Text style={styles.blockedTitle}>已有录音进度</Text><Text style={styles.blockedText}>为避免录音与文本错配，已有任意句录音的任务不能更换脚本。</Text><TouchableOpacity style={styles.returnButton} onPress={() => router.back()}><Text style={styles.returnText}>返回任务详情</Text></TouchableOpacity></ScreenContainer>;

  const importAssets = async (assets: ScriptAsset[]) => {
    if (!assets.length) return;
    try {
      setImporting(true);
      const parsedGroups = await Promise.all(assets.map(async (asset) => parseScriptContent(asset.content ?? await readImportedScript(asset.uri), asset.name)));
      const merged = parsedGroups.flat().map((sentence, index) => ({ ...sentence, index: index + 1 }));
      const persisted = await Promise.all(assets.map((asset) => persistImportedScript(asset.uri, asset.name).catch(() => asset.uri)));
      setFileName(assets.length === 1 ? assets[0].name : `批量导入 ${assets.length} 个脚本`);
      setFileUri(persisted[0] ?? "");
      setSentences(merged);
    } catch (error) { Alert.alert("导入失败", error instanceof Error ? error.message : "无法读取所选脚本文件。 "); }
    finally { setImporting(false); }
  };
  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["text/plain", "text/csv", "application/json", "*/*"], copyToCacheDirectory: true, multiple: true });
    if (!result.canceled) await importAssets(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name })));
  };
  const pickDirectory = async () => {
    if (Platform.OS === "web") { Alert.alert("请在 Android 设备上使用", "目录读取需要 Android 文件管理器授权；网页版可选择文本文件。 "); return; }
    try {
      const directory = await Directory.pickDirectoryAsync();
      const files = directory.list().filter((item): item is File => item instanceof File && SCRIPT_NAME_PATTERN.test(item.name));
      if (!files.length) { Alert.alert("目录中没有可导入脚本", "请选择包含 TXT、CSV、TSV 或 JSON 文件的目录。 "); return; }
      await importAssets(files.map((file) => ({ uri: file.uri, name: file.name, content: file.textSync() })));
    } catch (error) { Alert.alert("读取目录失败", error instanceof Error ? error.message : "无法读取该目录。 "); }
  };
  const confirm = () => {
    if (!sentences.length) { Alert.alert("请先选择新文本", "选择文本后将显示解析预览。 "); return; }
    Alert.alert("替换录音文本？", `将用 ${sentences.length} 句新文本替换当前尚未录制的脚本。`, [
      { text: "取消", style: "cancel" },
      { text: "确认替换", onPress: () => { try { replaceProjectScript(project.id, { sourceFileName: fileName, sourceFileUri: fileUri, sentences }); router.back(); } catch (error) { Alert.alert("无法替换", error instanceof Error ? error.message : "请重试。 "); } } },
    ]);
  };

  return <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => router.back()}><MaterialIcons color="#2F4DA0" name="arrow-back" size={23} /></TouchableOpacity><Text style={styles.title}>更换录音文本</Text><View style={styles.back} /></View><View style={styles.notice}><MaterialIcons color="#2F4DA0" name="verified-user" size={20} /><Text style={styles.noticeText}>当前任务尚无录音进度，可以安全更换文本。替换后原脚本将不再用于本任务。</Text></View><TouchableOpacity style={styles.importBox} onPress={pickFiles} disabled={importing}>{importing ? <ActivityIndicator color="#2F4DA0" /> : <><View style={styles.fileIcon}><MaterialIcons color="#2F4DA0" name="upload-file" size={27} /></View><View style={styles.importCopy}><Text style={styles.importTitle}>{fileName || "选择一个或多个新脚本"}</Text><Text style={styles.importHint}>{sentences.length ? `已解析 ${sentences.length} 句，点击重新选择` : "支持 TXT、CSV、TSV、拼音 JSON"}</Text></View><MaterialIcons color="#9AA5BC" name="chevron-right" size={24} /></>}</TouchableOpacity><TouchableOpacity style={styles.directoryButton} onPress={pickDirectory} disabled={importing}><MaterialIcons color="#2F4DA0" name="folder-open" size={20} /><Text style={styles.directoryText}>从目录批量读取脚本（Android）</Text></TouchableOpacity>{sentences.length > 0 && <View style={styles.preview}><Text style={styles.previewTitle}>新脚本预览</Text><Text style={styles.previewText}>{sentences.slice(0, 4).map((sentence) => `${sentence.index}. ${sentence.rawText}${sentence.prompt ? `（${sentence.prompt}）` : ""}`).join("\n")}</Text></View>}<TouchableOpacity style={[styles.confirm, !sentences.length && styles.confirmDisabled]} onPress={confirm} disabled={!sentences.length}><Text style={styles.confirmText}>确认更换文本</Text></TouchableOpacity></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, paddingTop: 8 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }, back: { alignItems: "center", height: 38, justifyContent: "center", width: 38 }, title: { color: "#182033", fontSize: 20, fontWeight: "800" }, notice: { alignItems: "flex-start", backgroundColor: "#EAF0FF", borderRadius: 14, flexDirection: "row", gap: 10, marginBottom: 20, padding: 14 }, noticeText: { color: "#415273", flex: 1, fontSize: 13, lineHeight: 20 }, importBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C9D3EA", borderRadius: 17, borderStyle: "dashed", borderWidth: 1.5, flexDirection: "row", gap: 12, minHeight: 92, padding: 14 }, fileIcon: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 13, height: 48, justifyContent: "center", width: 48 }, importCopy: { flex: 1 }, importTitle: { color: "#182033", fontSize: 15, fontWeight: "800" }, importHint: { color: "#65708A", fontSize: 12, lineHeight: 18, marginTop: 4 }, directoryButton: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 13, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 10, paddingVertical: 12 }, directoryText: { color: "#2F4DA0", fontSize: 14, fontWeight: "800" }, preview: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 14 }, previewTitle: { color: "#3F4A62", fontSize: 13, fontWeight: "800" }, previewText: { color: "#65708A", fontSize: 13, lineHeight: 22, marginTop: 8 }, confirm: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 16, marginTop: 26, paddingVertical: 16 }, confirmDisabled: { backgroundColor: "#B6C0D7" }, confirmText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, missing: { color: "#65708A", fontSize: 16 }, backText: { color: "#2F4DA0", fontWeight: "800", marginTop: 12 }, blockedTitle: { color: "#182033", fontSize: 20, fontWeight: "800", marginTop: 14 }, blockedText: { color: "#65708A", fontSize: 14, lineHeight: 22, marginTop: 8, textAlign: "center" }, returnButton: { backgroundColor: "#2F4DA0", borderRadius: 14, marginTop: 22, paddingHorizontal: 20, paddingVertical: 13 }, returnText: { color: "#FFFFFF", fontWeight: "800" },
});
