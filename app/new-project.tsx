import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAppLanguage } from "@/lib/i18n";
import { parseScriptContent, persistImportedScript, readImportedScript } from "@/lib/recorder-files";
import { useRecorder } from "@/lib/recorder-context";
import type { ScriptSentence } from "@/shared/recorder-types";

type ScriptAsset = { uri: string; name: string; content?: string };
type ImportedScript = { id: string; name: string; uri: string; sentences: ScriptSentence[] };
const SCRIPT_NAME_PATTERN = /\.txt$/i;

export default function NewProjectScreen() {
  const router = useRouter();
  const { t } = useAppLanguage();
  const { speakers, createProject } = useRecorder();
  const [projectName, setProjectName] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [scripts, setScripts] = useState<ImportedScript[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [importing, setImporting] = useState(false);
  const selectedScript = scripts.find((script) => script.id === selectedScriptId);

  const importAssets = async (assets: ScriptAsset[]) => {
    if (!assets.length) return;
    try {
      setImporting(true);
      const parsed = await Promise.all(assets.map(async (asset, index) => {
        const sentences = parseScriptContent(asset.content ?? await readImportedScript(asset.uri), asset.name);
        const uri = await persistImportedScript(asset.uri, asset.name).catch(() => asset.uri);
        return { id: `${Date.now()}_${index}_${asset.name}`, name: asset.name, uri, sentences };
      }));
      setScripts(parsed); setSelectedScriptId(parsed[0]?.id ?? "");
      if (!projectName.trim() && parsed[0]) setProjectName(parsed[0].name.replace(/\.[^.]+$/, ""));
    } catch (error) { Alert.alert(t("importFailed"), error instanceof Error ? error.message : t("lineFormat")); }
    finally { setImporting(false); }
  };
  const pickFiles = async () => { const result = await DocumentPicker.getDocumentAsync({ type: "text/plain", copyToCacheDirectory: true, multiple: true }); if (!result.canceled) await importAssets(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name }))); };
  const pickDirectory = async () => {
    if (Platform.OS === "web") { Alert.alert("Android", t("chooseDirectory")); return; }
    try { const directory = await Directory.pickDirectoryAsync(); const files = directory.list().filter((item): item is File => item instanceof File && SCRIPT_NAME_PATTERN.test(item.name)); if (!files.length) { Alert.alert(t("importScript"), t("selectTxtDirectory")); return; } await importAssets(files.map((file) => ({ uri: file.uri, name: file.name, content: file.textSync() }))); }
    catch (error) { Alert.alert(t("importFailed"), error instanceof Error ? error.message : t("selectTxtDirectory")); }
  };
  const chooseScript = (script: ImportedScript) => { setSelectedScriptId(script.id); if (!projectName.trim() || projectName === selectedScript?.name.replace(/\.[^.]+$/, "")) setProjectName(script.name.replace(/\.[^.]+$/, "")); };
  const create = () => {
    if (!speakerId) { Alert.alert(t("selectSpeaker"), t("speakerAttached")); return; }
    if (!selectedScript) { Alert.alert(t("selectOneScript"), t("chooseScript")); return; }
    const project = createProject({ name: projectName.trim() || selectedScript.name.replace(/\.[^.]+$/, ""), speakerId, sourceFileName: selectedScript.name, sourceFileUri: selectedScript.uri, sentences: selectedScript.sentences });
    router.replace(`/project/${project.id}` as never);
  };

  return <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => router.back()}><MaterialIcons color="#2F4DA0" name="arrow-back" size={23} /></TouchableOpacity><Text style={styles.title}>{t("newTask")}</Text><View style={styles.back} /></View><Text style={styles.label}>{t("taskName")}</Text><TextInput value={projectName} onChangeText={setProjectName} placeholder={t("taskNamePlaceholder")} placeholderTextColor="#9AA5BC" style={styles.input} /><Text style={styles.label}>{t("selectSpeaker")}</Text><View style={styles.speakerGroup}>{speakers.length ? speakers.map((speaker) => <TouchableOpacity key={speaker.id} style={[styles.speaker, speakerId === speaker.id && styles.speakerSelected]} onPress={() => setSpeakerId(speaker.id)}><View style={styles.speakerAvatar}><Text style={styles.speakerAvatarText}>{speaker.name.slice(0, 1)}</Text></View><View style={styles.speakerInfo}><Text style={styles.speakerName}>{speaker.name}</Text><Text style={styles.speakerMeta}>{speaker.gender} · {speaker.age}</Text></View>{speakerId === speaker.id && <MaterialIcons color="#2F855A" name="check-circle" size={21} />}</TouchableOpacity>) : <TouchableOpacity style={styles.noSpeaker} onPress={() => router.push("/speakers" as never)}><MaterialIcons color="#2F4DA0" name="person-add" size={21} /><Text style={styles.noSpeakerText}>{t("selectSpeaker")}</Text></TouchableOpacity>}</View><Text style={styles.label}>{t("importScript")}</Text><TouchableOpacity style={styles.importBox} onPress={pickFiles} disabled={importing}>{importing ? <ActivityIndicator color="#2F4DA0" /> : <><View style={styles.fileIcon}><MaterialIcons color="#2F4DA0" name="upload-file" size={27} /></View><View style={styles.importCopy}><Text style={styles.importTitle}>{scripts.length ? `${scripts.length} ${t("importedScripts")}` : t("chooseScript")}</Text><Text style={styles.importHint}>{t("lineFormat")}</Text></View><MaterialIcons color="#9AA5BC" name="chevron-right" size={24} /></>}</TouchableOpacity><TouchableOpacity style={styles.directoryButton} onPress={pickDirectory} disabled={importing}><MaterialIcons color="#2F4DA0" name="folder-open" size={20} /><Text style={styles.directoryText}>{t("chooseDirectory")}</Text></TouchableOpacity>{scripts.length > 0 && <View style={styles.scriptSelection}><Text style={styles.selectionTitle}>{t("selectOneScript")}</Text>{scripts.map((script) => <TouchableOpacity key={script.id} style={[styles.scriptOption, selectedScriptId === script.id && styles.scriptOptionSelected]} onPress={() => chooseScript(script)}><MaterialIcons color={selectedScriptId === script.id ? "#2F855A" : "#8A95AA"} name={selectedScriptId === script.id ? "radio-button-checked" : "radio-button-unchecked"} size={21} /><View style={styles.scriptCopy}><Text style={styles.scriptName}>{script.name}</Text><Text style={styles.scriptMeta}>{script.sentences.length} {t("sentenceCount")}</Text></View></TouchableOpacity>)}</View>}{selectedScript && <View style={styles.preview}><Text style={styles.previewTitle}>{t("scriptChoice")}: {selectedScript.name}</Text><Text style={styles.previewText} numberOfLines={3}>{selectedScript.sentences.slice(0, 3).map((sentence) => `${sentence.index}. ${sentence.rawText}${sentence.prompt ? ` (${sentence.prompt})` : ""}`).join("\n")}</Text></View>}<View style={styles.formatNote}><MaterialIcons color="#65708A" name="lightbulb-outline" size={19} /><Text style={styles.formatText}>{t("lineFormat")}</Text></View><TouchableOpacity style={[styles.create, (!speakerId || !selectedScript) && styles.createDisabled]} onPress={create} disabled={!speakerId || !selectedScript}><Text style={styles.createText}>{t("startRecording")}</Text></TouchableOpacity></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 30 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 26, paddingTop: 8 }, back: { alignItems: "center", height: 38, justifyContent: "center", width: 38 }, title: { color: "#182033", fontSize: 20, fontWeight: "800" }, label: { color: "#3F4A62", fontSize: 14, fontWeight: "800", marginBottom: 9, marginTop: 20 }, input: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, color: "#182033", fontSize: 16, paddingHorizontal: 14, paddingVertical: 14 }, speakerGroup: { gap: 9 }, speaker: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 11, padding: 12 }, speakerSelected: { backgroundColor: "#F4F7FF", borderColor: "#2F4DA0" }, speakerAvatar: { alignItems: "center", backgroundColor: "#EEE9FF", borderRadius: 13, height: 38, justifyContent: "center", width: 38 }, speakerAvatarText: { color: "#6651A8", fontSize: 16, fontWeight: "800" }, speakerInfo: { flex: 1 }, speakerName: { color: "#182033", fontSize: 15, fontWeight: "800" }, speakerMeta: { color: "#65708A", fontSize: 12, marginTop: 3 }, noSpeaker: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 14, flexDirection: "row", gap: 9, padding: 15 }, noSpeakerText: { color: "#2F4DA0", fontWeight: "800" }, importBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C9D3EA", borderRadius: 17, borderStyle: "dashed", borderWidth: 1.5, flexDirection: "row", gap: 12, minHeight: 92, padding: 14 }, fileIcon: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 13, height: 48, justifyContent: "center", width: 48 }, importCopy: { flex: 1 }, importTitle: { color: "#182033", fontSize: 15, fontWeight: "800" }, importHint: { color: "#65708A", fontSize: 12, lineHeight: 18, marginTop: 4 }, directoryButton: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 13, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 10, paddingVertical: 12 }, directoryText: { color: "#2F4DA0", fontSize: 14, fontWeight: "800" }, scriptSelection: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, marginTop: 12, padding: 13 }, selectionTitle: { color: "#3F4A62", fontSize: 13, fontWeight: "800", marginBottom: 8 }, scriptOption: { alignItems: "center", borderRadius: 10, flexDirection: "row", gap: 10, padding: 10 }, scriptOptionSelected: { backgroundColor: "#F2F6FF" }, scriptCopy: { flex: 1 }, scriptName: { color: "#26314A", fontSize: 14, fontWeight: "800" }, scriptMeta: { color: "#65708A", fontSize: 12, marginTop: 3 }, preview: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, marginTop: 12, padding: 14 }, previewTitle: { color: "#3F4A62", fontSize: 13, fontWeight: "800" }, previewText: { color: "#65708A", fontSize: 13, lineHeight: 21, marginTop: 7 }, formatNote: { alignItems: "flex-start", flexDirection: "row", gap: 9, marginTop: 17, paddingHorizontal: 3 }, formatText: { color: "#65708A", flex: 1, fontSize: 13, lineHeight: 20 }, create: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 16, marginTop: 26, paddingVertical: 16 }, createDisabled: { backgroundColor: "#B6C0D7" }, createText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
