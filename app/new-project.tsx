import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { parseScriptContent, persistImportedScript, readImportedScript } from "@/lib/recorder-files";
import { useRecorder } from "@/lib/recorder-context";
import type { ScriptSentence } from "@/shared/recorder-types";

type ScriptAsset = { uri: string; name: string; content?: string };
const SCRIPT_NAME_PATTERN = /\.(txt|csv|tsv|json)$/i;

export default function NewProjectScreen() {
  const router = useRouter();
  const { speakers, createProject } = useRecorder();
  const [projectName, setProjectName] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [sourceFileUri, setSourceFileUri] = useState("");
  const [sentences, setSentences] = useState<ScriptSentence[]>([]);
  const [importing, setImporting] = useState(false);

  const importAssets = async (assets: ScriptAsset[]) => {
    if (!assets.length) return;
    try {
      setImporting(true);
      const parsedGroups = await Promise.all(assets.map(async (asset) => {
        const content = asset.content ?? await readImportedScript(asset.uri);
        return parseScriptContent(content, asset.name);
      }));
      const merged = parsedGroups.flat().map((sentence, index) => ({ ...sentence, index: index + 1 }));
      const persisted = await Promise.all(assets.map((asset) => persistImportedScript(asset.uri, asset.name).catch(() => asset.uri)));
      setSourceFileName(assets.length === 1 ? assets[0].name : `批量导入 ${assets.length} 个脚本`);
      setSourceFileUri(persisted[0] ?? "");
      setSentences(merged);
      if (!projectName.trim()) setProjectName(assets.length === 1 ? assets[0].name.replace(/\.[^.]+$/, "") : `批量采音任务 ${new Date().toLocaleDateString("zh-CN")}`);
    } catch (error) {
      Alert.alert("导入失败", error instanceof Error ? error.message : "无法读取所选脚本文件，请检查文件格式。");
    } finally { setImporting(false); }
  };

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["text/plain", "text/csv", "application/json", "*/*"], copyToCacheDirectory: true, multiple: true });
    if (!result.canceled) await importAssets(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name })));
  };

  const pickDirectory = async () => {
    if (Platform.OS === "web") { Alert.alert("请在 Android 设备上使用", "目录读取需要 Android 系统文件管理器授权；网页版可使用“选择文本文件”。"); return; }
    try {
      const directory = await Directory.pickDirectoryAsync();
      const files = directory.list().filter((item): item is File => item instanceof File && SCRIPT_NAME_PATTERN.test(item.name));
      if (!files.length) { Alert.alert("目录中没有可导入脚本", "请选择包含 TXT、CSV、TSV 或 JSON 文件的目录。 "); return; }
      await importAssets(files.map((file) => ({ uri: file.uri, name: file.name, content: file.textSync() })));
    } catch (error) {
      Alert.alert("读取目录失败", error instanceof Error ? error.message : "无法读取该目录，请重新选择。 ");
    }
  };

  const create = () => {
    if (!speakerId) { Alert.alert("请选择发音人", "录音文件需要使用发音人信息建立目录。"); return; }
    if (!sentences.length) { Alert.alert("请先导入文本", "支持 TXT、CSV、TSV、拼音 JSON 以及 Android 目录批量读取。 "); return; }
    const project = createProject({ name: projectName.trim() || "未命名任务", speakerId, sourceFileName, sourceFileUri, sentences });
    router.replace(`/project/${project.id}` as never);
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => router.back()}><MaterialIcons color="#2F4DA0" name="arrow-back" size={23} /></TouchableOpacity><Text style={styles.title}>新建录音任务</Text><View style={styles.back} /></View>
        <Text style={styles.label}>任务名称</Text><TextInput value={projectName} onChangeText={setProjectName} placeholder="例如：普通话采音 A 组" placeholderTextColor="#9AA5BC" style={styles.input} />
        <Text style={styles.label}>发音人</Text>
        <View style={styles.speakerGroup}>{speakers.length ? speakers.map((speaker) => <TouchableOpacity key={speaker.id} style={[styles.speaker, speakerId === speaker.id && styles.speakerSelected]} onPress={() => setSpeakerId(speaker.id)}><View style={styles.speakerAvatar}><Text style={styles.speakerAvatarText}>{speaker.name.slice(0, 1)}</Text></View><View style={styles.speakerInfo}><Text style={styles.speakerName}>{speaker.name}</Text><Text style={styles.speakerMeta}>{speaker.gender} · {speaker.age} 岁</Text></View>{speakerId === speaker.id && <MaterialIcons color="#2F855A" name="check-circle" size={21} />}</TouchableOpacity>) : <TouchableOpacity style={styles.noSpeaker} onPress={() => router.push("/speakers" as never)}><MaterialIcons color="#2F4DA0" name="person-add" size={21} /><Text style={styles.noSpeakerText}>尚无发音人，先填写信息</Text></TouchableOpacity>}</View>
        <Text style={styles.label}>录音文本</Text>
        <TouchableOpacity style={styles.importBox} onPress={pickFiles} disabled={importing}>{importing ? <ActivityIndicator color="#2F4DA0" /> : <><View style={styles.fileIcon}><MaterialIcons color="#2F4DA0" name="upload-file" size={27} /></View><View style={styles.importCopy}><Text style={styles.importTitle}>{sourceFileName || "选择一个或多个文本文件"}</Text><Text style={styles.importHint}>{sentences.length ? `已解析 ${sentences.length} 句，点击可重新选择` : "支持 TXT、CSV、TSV、拼音 JSON"}</Text></View><MaterialIcons color="#9AA5BC" name="chevron-right" size={24} /></>}</TouchableOpacity>
        <TouchableOpacity style={styles.directoryButton} onPress={pickDirectory} disabled={importing}><MaterialIcons color="#2F4DA0" name="folder-open" size={20} /><Text style={styles.directoryText}>从目录批量读取脚本（Android）</Text></TouchableOpacity>
        {sentences.length > 0 && <View style={styles.preview}><Text style={styles.previewTitle}>导入预览</Text><Text style={styles.previewText} numberOfLines={3}>{sentences.slice(0, 3).map((sentence) => `${sentence.index}. ${sentence.rawText}${sentence.prompt ? `（${sentence.prompt}）` : ""}`).join("\n")}</Text></View>}
        <View style={styles.formatNote}><MaterialIcons color="#65708A" name="lightbulb-outline" size={19} /><Text style={styles.formatText}>两列表格中第一列为朗读文本、第二列为提示词。JSON 可以为每个汉字填写拼音，目录读取会合并目录内全部支持格式的文件。</Text></View>
        <TouchableOpacity style={[styles.create, (!speakerId || !sentences.length) && styles.createDisabled]} onPress={create} disabled={!speakerId || !sentences.length}><Text style={styles.createText}>创建并开始录制</Text></TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 26, paddingTop: 8 }, back: { alignItems: "center", height: 38, justifyContent: "center", width: 38 }, title: { color: "#182033", fontSize: 20, fontWeight: "800" }, label: { color: "#3F4A62", fontSize: 14, fontWeight: "800", marginBottom: 9, marginTop: 20 }, input: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, color: "#182033", fontSize: 16, paddingHorizontal: 14, paddingVertical: 14 }, speakerGroup: { gap: 9 }, speaker: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 11, padding: 12 }, speakerSelected: { backgroundColor: "#F4F7FF", borderColor: "#2F4DA0" }, speakerAvatar: { alignItems: "center", backgroundColor: "#EEE9FF", borderRadius: 13, height: 38, justifyContent: "center", width: 38 }, speakerAvatarText: { color: "#6651A8", fontSize: 16, fontWeight: "800" }, speakerInfo: { flex: 1 }, speakerName: { color: "#182033", fontSize: 15, fontWeight: "800" }, speakerMeta: { color: "#65708A", fontSize: 12, marginTop: 3 }, noSpeaker: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 14, flexDirection: "row", gap: 9, padding: 15 }, noSpeakerText: { color: "#2F4DA0", fontWeight: "800" }, importBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C9D3EA", borderRadius: 17, borderStyle: "dashed", borderWidth: 1.5, flexDirection: "row", gap: 12, minHeight: 92, padding: 14 }, fileIcon: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 13, height: 48, justifyContent: "center", width: 48 }, importCopy: { flex: 1 }, importTitle: { color: "#182033", fontSize: 15, fontWeight: "800" }, importHint: { color: "#65708A", fontSize: 12, lineHeight: 18, marginTop: 4 }, directoryButton: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 13, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 10, paddingVertical: 12 }, directoryText: { color: "#2F4DA0", fontSize: 14, fontWeight: "800" }, preview: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, marginTop: 12, padding: 14 }, previewTitle: { color: "#3F4A62", fontSize: 13, fontWeight: "800" }, previewText: { color: "#65708A", fontSize: 13, lineHeight: 21, marginTop: 7 }, formatNote: { alignItems: "flex-start", flexDirection: "row", gap: 9, marginTop: 17, paddingHorizontal: 3 }, formatText: { color: "#65708A", flex: 1, fontSize: 13, lineHeight: 20 }, create: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 16, marginTop: 26, paddingVertical: 16 }, createDisabled: { backgroundColor: "#B6C0D7" }, createText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
