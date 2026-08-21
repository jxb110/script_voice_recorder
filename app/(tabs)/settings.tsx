import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SettingsFooter } from "@/components/settings-footer";
import { useAppLanguage } from "@/lib/i18n";
import { useRecorder } from "@/lib/recorder-context";
import type { RecorderSettings } from "@/shared/recorder-types";

const sampleRates = [16000, 22050, 44100, 48000];
const bitDepths = [16, 32] as const;

export default function SettingsScreen() {
  const { settings, updateSettings } = useRecorder();
  const { language } = useAppLanguage();
  const [draft, setDraft] = useState<RecorderSettings>(settings);
  const zh = language === "zh";
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const copy = zh ? {
    title: "录音设置", subtitle: "WAV 无损录音与静音控制", save: "保存", saved: "设置已保存", savedHint: "新参数会在下一句开始录制时生效。", format: "输出格式", formatHint: "所有新录音都保存为无压缩 WAV 文件", wav: "WAV", depth: "位深", depthHint: "仅保留录音所需的 16-bit 与 32-bit", sample: "采样率", sampleHint: "影响音频细节与文件体积", channels: "声道", channelsHint: "单人采音通常选择单声道", mono: "单声道", stereo: "立体声", silence: "静音控制", leading: "首端静音", leadingHint: "点击开始后，正式录制前预留的安静时长", trailing: "尾端静音", trailingHint: "点击停止后，保存文件前保留的安静时长", milliseconds: "毫秒", note: "WAV 为无压缩 PCM 格式。选择 32-bit 会显著增大文件体积；推荐语音录制使用 16-bit。",
  } : {
    title: "Recording settings", subtitle: "WAV lossless recording and silence control", save: "Save", saved: "Settings saved", savedHint: "New parameters apply when the next sentence starts recording.", format: "Output format", formatHint: "All new recordings are saved as uncompressed WAV files", wav: "WAV", depth: "Bit depth", depthHint: "Only the required 16-bit and 32-bit choices are available", sample: "Sample rate", sampleHint: "Controls audio detail and file size", channels: "Channels", channelsHint: "Mono is usually best for a single speaker", mono: "Mono", stereo: "Stereo", silence: "Silence controls", leading: "Leading silence", leadingHint: "Quiet time before the recording starts", trailing: "Trailing silence", trailingHint: "Quiet time retained before the file is saved", milliseconds: "ms", note: "WAV uses uncompressed PCM. 32-bit substantially increases file size; 16-bit is recommended for voice recording.",
  };

  useEffect(() => setDraft(settings), [settings]);

  const save = () => {
    const leadingSilenceMs = Math.max(0, Math.min(10000, Number(draft.leadingSilenceMs) || 0));
    const trailingSilenceMs = Math.max(0, Math.min(10000, Number(draft.trailingSilenceMs) || 0));
    const next = { ...draft, leadingSilenceMs, trailingSilenceMs };
    updateSettings(next);
    setDraft(next);
    Alert.alert(copy.saved, copy.savedHint);
  };

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <View style={styles.page}>
      <View style={styles.topBar}>
        <View style={styles.titleGroup}><Text style={styles.title}>{copy.title}</Text><Text style={styles.subtitle}>{copy.subtitle}</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={copy.save} style={styles.topSave} onPress={save}><MaterialIcons color="#FFFFFF" name="check" size={19} /><Text style={styles.topSaveText}>{copy.save}</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>{copy.format}</Text>
        <View style={styles.card}>
          <View style={styles.formatRow}><View><Text style={styles.optionTitle}>{copy.wav}</Text><Text style={styles.optionHelper}>{copy.formatHint}</Text></View><View style={styles.formatBadge}><MaterialIcons color="#1E8B61" name="graphic-eq" size={18} /><Text style={styles.formatBadgeText}>{copy.wav}</Text></View></View>
          <Divider />
          <Text style={styles.optionTitle}>{copy.depth}</Text><Text style={styles.optionHelper}>{copy.depthHint}</Text>
          <View style={styles.segment}>{bitDepths.map((bitDepth) => <TouchableOpacity key={bitDepth} style={[styles.segmentItem, draft.bitDepth === bitDepth && styles.segmentSelected]} onPress={() => setDraft((current) => ({ ...current, bitDepth }))}><Text style={[styles.segmentText, draft.bitDepth === bitDepth && styles.segmentTextSelected]}>{bitDepth}-bit</Text></TouchableOpacity>)}</View>
          <Divider />
          <OptionRow title={copy.sample} helper={copy.sampleHint} options={sampleRates} value={draft.sampleRate} unit="Hz" onChange={(sampleRate) => setDraft((current) => ({ ...current, sampleRate }))} />
          <Divider />
          <Text style={styles.optionTitle}>{copy.channels}</Text><Text style={styles.optionHelper}>{copy.channelsHint}</Text>
          <View style={styles.segment}>{[1, 2].map((channels) => <TouchableOpacity key={channels} style={[styles.segmentItem, draft.channels === channels && styles.segmentSelected]} onPress={() => setDraft((current) => ({ ...current, channels: channels as 1 | 2 }))}><Text style={[styles.segmentText, draft.channels === channels && styles.segmentTextSelected]}>{channels === 1 ? copy.mono : copy.stereo}</Text></TouchableOpacity>)}</View>
        </View>
        <Text style={styles.section}>{copy.silence}</Text>
        <View style={styles.card}><Text style={styles.optionTitle}>{copy.leading}</Text><Text style={styles.optionHelper}>{copy.leadingHint}</Text><NumberInput value={draft.leadingSilenceMs} unit={copy.milliseconds} onChange={(leadingSilenceMs) => setDraft((current) => ({ ...current, leadingSilenceMs }))} /><Divider /><Text style={styles.optionTitle}>{copy.trailing}</Text><Text style={styles.optionHelper}>{copy.trailingHint}</Text><NumberInput value={draft.trailingSilenceMs} unit={copy.milliseconds} onChange={(trailingSilenceMs) => setDraft((current) => ({ ...current, trailingSilenceMs }))} /></View>
        <View style={styles.note}><MaterialIcons color="#2F4DA0" name="info-outline" size={19} /><Text style={styles.noteText}>{copy.note}</Text></View>
        <SettingsFooter versionLabel={zh ? "版本" : "Version"} version={appVersion} />
      </ScrollView>
    </View>
  </ScreenContainer>;
}

const Divider = () => <View style={styles.divider} />;
function OptionRow({ title, helper, options, value, unit, onChange }: { title: string; helper: string; options: number[]; value: number; unit: string; onChange: (value: number) => void }) { return <View><Text style={styles.optionTitle}>{title}</Text><Text style={styles.optionHelper}>{helper}</Text><View style={styles.chips}>{options.map((option) => <TouchableOpacity key={option} style={[styles.chip, value === option && styles.chipActive]} onPress={() => onChange(option)}><Text style={[styles.chipText, value === option && styles.chipTextActive]}>{option} {unit}</Text></TouchableOpacity>)}</View></View>; }
function NumberInput({ value, unit, onChange }: { value: number; unit: string; onChange: (value: number) => void }) { return <View style={styles.numberRow}><TextInput value={String(value)} keyboardType="number-pad" onChangeText={(text) => onChange(Number(text.replace(/[^0-9]/g, "")) || 0)} style={styles.numberInput} /><Text style={styles.unit}>{unit}</Text></View>; }

const styles = StyleSheet.create({
  page: { flex: 1 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: 14, paddingTop: 10 }, titleGroup: { flex: 1, paddingRight: 12 }, title: { color: "#182033", fontSize: 27, fontWeight: "800", letterSpacing: -0.5 }, subtitle: { color: "#65708A", fontSize: 13, marginTop: 4 }, topSave: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 13, flexDirection: "row", gap: 5, paddingHorizontal: 14, paddingVertical: 11 }, topSaveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, content: { paddingBottom: 32 }, section: { color: "#3F4A62", fontSize: 14, fontWeight: "800", letterSpacing: 0.3, marginBottom: 9, marginTop: 18 }, card: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 18, borderWidth: 1, padding: 17 }, formatRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, formatBadge: { alignItems: "center", backgroundColor: "#E8F7EF", borderRadius: 10, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 8 }, formatBadgeText: { color: "#1E8B61", fontSize: 13, fontWeight: "800" }, optionTitle: { color: "#182033", fontSize: 16, fontWeight: "800" }, optionHelper: { color: "#65708A", fontSize: 13, lineHeight: 19, marginTop: 4 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }, chip: { backgroundColor: "#F2F4F8", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }, chipActive: { backgroundColor: "#E7EEFF", borderColor: "#2F4DA0", borderWidth: 1 }, chipText: { color: "#59647B", fontSize: 13, fontWeight: "700" }, chipTextActive: { color: "#2F4DA0" }, divider: { backgroundColor: "#E8EBF3", height: 1, marginVertical: 18 }, segment: { backgroundColor: "#EEF1F7", borderRadius: 11, flexDirection: "row", marginTop: 14, padding: 3 }, segmentItem: { alignItems: "center", borderRadius: 8, flex: 1, paddingVertical: 10 }, segmentSelected: { backgroundColor: "#FFFFFF", elevation: 1 }, segmentText: { color: "#65708A", fontSize: 14, fontWeight: "700" }, segmentTextSelected: { color: "#2F4DA0" }, numberRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 13 }, numberInput: { backgroundColor: "#F2F4F8", borderRadius: 10, color: "#182033", fontSize: 16, fontWeight: "700", paddingHorizontal: 13, paddingVertical: 10, width: 110 }, unit: { color: "#65708A", fontSize: 14 }, note: { alignItems: "flex-start", backgroundColor: "#EAF0FF", borderRadius: 14, flexDirection: "row", gap: 10, marginTop: 20, padding: 14 }, noteText: { color: "#415273", flex: 1, fontSize: 13, lineHeight: 20 },
});
