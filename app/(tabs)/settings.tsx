import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { GlassSurface } from "@/components/liquid-glass";
import { SettingsFooter } from "@/components/settings-footer";
import { useAppLanguage } from "@/lib/i18n";
import { useRecorder } from "@/lib/recorder-context";
import type { RecorderSettings } from "@/shared/recorder-types";

const sampleRates = [16000, 22050, 44100, 48000];
const bitDepths = [16, 32] as const;

function isSameSettings(left: RecorderSettings, right: RecorderSettings) {
  return left.sampleRate === right.sampleRate && left.bitDepth === right.bitDepth && left.channels === right.channels && left.leadingSilenceMs === right.leadingSilenceMs && left.trailingSilenceMs === right.trailingSilenceMs && left.readingFontSize === right.readingFontSize;
}

export default function SettingsScreen() {
  const { settings, updateSettings } = useRecorder();
  const { language } = useAppLanguage();
  const navigation = useNavigation();
  const parentNavigation = navigation.getParent();
  const tabNavigation = parentNavigation as unknown as {
    getState: () => ReturnType<NonNullable<typeof parentNavigation>["getState"]>;
    navigate: (name: string) => void;
    addListener: (event: "tabPress", listener: (event: { target?: string; preventDefault: () => void }) => void) => () => void;
  } | undefined;
  const bypassGuardRef = useRef(false);
  const [draft, setDraft] = useState<RecorderSettings>(settings);
  const zh = language === "zh";
  const appVersion = "2.0.0";
  const copy = zh ? {
    title: "录音设置", subtitle: "WAV 无损录音", save: "保存", saved: "设置已保存", savedHint: "新参数会在下一句开始录制时生效。", format: "WAV", depth: "位深", sample: "采样率", channels: "声道", mono: "单声道", stereo: "立体声", silence: "首尾静音", leading: "首端", trailing: "尾端", milliseconds: "毫秒", note: "32-bit 文件更大；语音通常推荐 16-bit。", profile: "当前录制配置", profileHint: "下一句将按此无损 WAV 参数采集。", unsavedTitle: "有未保存的设置", unsavedHint: "是否保存当前更改后再离开？", keep: "继续编辑", discard: "放弃更改", saveLeave: "保存并离开",
  } : {
    title: "Recording settings", subtitle: "Lossless WAV capture", save: "Save", saved: "Settings saved", savedHint: "New parameters apply when the next sentence starts recording.", format: "WAV", depth: "Bit depth", sample: "Sample rate", channels: "Channels", mono: "Mono", stereo: "Stereo", silence: "Silence", leading: "Leading", trailing: "Trailing", milliseconds: "ms", note: "32-bit files are larger; 16-bit is recommended for voice.", profile: "Active recording profile", profileHint: "The next sentence will use these lossless WAV parameters.", unsavedTitle: "Unsaved settings", unsavedHint: "Save your changes before leaving?", keep: "Keep editing", discard: "Discard", saveLeave: "Save and leave",
  };
  const hasUnsavedChanges = useMemo(() => !isSameSettings(draft, settings), [draft, settings]);

  useEffect(() => setDraft(settings), [settings]);

  const saveDraft = useCallback((showFeedback: boolean) => {
    const next = { ...draft, leadingSilenceMs: Math.max(0, Math.min(10000, Number(draft.leadingSilenceMs) || 0)), trailingSilenceMs: Math.max(0, Math.min(10000, Number(draft.trailingSilenceMs) || 0)) };
    updateSettings(next);
    setDraft(next);
    if (showFeedback) Alert.alert(copy.saved, copy.savedHint);
  }, [copy.saved, copy.savedHint, draft, updateSettings]);

  const continueNavigation = useCallback((action: () => void) => {
    bypassGuardRef.current = true;
    action();
    setTimeout(() => { bypassGuardRef.current = false; }, 0);
  }, []);

  const confirmLeave = useCallback((action: () => void) => {
    if (!hasUnsavedChanges) { action(); return; }
    Alert.alert(copy.unsavedTitle, copy.unsavedHint, [
      { text: copy.keep, style: "cancel" },
      { text: copy.discard, style: "destructive", onPress: () => { setDraft(settings); continueNavigation(action); } },
      { text: copy.saveLeave, onPress: () => { saveDraft(false); continueNavigation(action); } },
    ]);
  }, [continueNavigation, copy.discard, copy.keep, copy.saveLeave, copy.unsavedHint, copy.unsavedTitle, hasUnsavedChanges, saveDraft, settings]);

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (!hasUnsavedChanges || bypassGuardRef.current) return;
    event.preventDefault();
    confirmLeave(() => navigation.dispatch(event.data.action));
  }), [confirmLeave, hasUnsavedChanges, navigation]);

  useEffect(() => {
    if (!tabNavigation) return;
    return tabNavigation.addListener("tabPress", (event) => {
      const state = tabNavigation.getState();
      const target = state.routes.find((route) => route.key === event.target);
      if (!target || target.name === "settings" || !hasUnsavedChanges || bypassGuardRef.current) return;
      event.preventDefault();
      confirmLeave(() => {
        const latest = tabNavigation.getState().routes.find((route) => route.key === event.target);
        if (latest) tabNavigation.navigate(latest.name);
      });
    });
  }, [confirmLeave, hasUnsavedChanges, tabNavigation]);

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <View style={styles.page}>
      <View style={styles.topBar}>
        <View style={styles.titleGroup}><Text style={styles.title}>{copy.title}</Text><Text style={styles.subtitle}>{copy.subtitle}</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={copy.save} disabled={!hasUnsavedChanges} style={[styles.topSave, !hasUnsavedChanges && styles.topSaveDisabled]} onPress={() => saveDraft(true)}><MaterialIcons color="#FFFFFF" name="check" size={18} /><Text style={styles.topSaveText}>{copy.save}</Text></TouchableOpacity>
      </View>
      <GlassSurface style={styles.card} intensity={34}>
        <View>
          <View style={styles.formatRow}><View style={styles.formatIcon}><MaterialIcons color="#1E8B61" name="graphic-eq" size={19} /></View><View style={styles.formatCopy}><Text style={styles.formatTitle}>{copy.format}</Text><Text style={styles.formatHint}>PCM</Text></View><Text style={styles.fixedBadge}>WAV</Text></View>
          <View style={styles.divider} />
          <SettingLine label={copy.depth}><Segment labels={bitDepths.map((value) => `${value}-bit`)} selectedIndex={bitDepths.indexOf(draft.bitDepth)} onSelect={(index) => setDraft((current) => ({ ...current, bitDepth: bitDepths[index] }))} /></SettingLine>
          <SettingLine label={copy.sample}><View style={styles.rateGrid}>{sampleRates.map((rate) => <TouchableOpacity key={rate} onPress={() => setDraft((current) => ({ ...current, sampleRate: rate }))} style={[styles.rateChip, draft.sampleRate === rate && styles.rateChipSelected]}><Text style={[styles.rateText, draft.sampleRate === rate && styles.rateTextSelected]}>{rate === 44100 ? "44.1k" : `${rate / 1000}k`}</Text></TouchableOpacity>)}</View></SettingLine>
          <SettingLine label={copy.channels}><Segment labels={[copy.mono, copy.stereo]} selectedIndex={draft.channels - 1} onSelect={(index) => setDraft((current) => ({ ...current, channels: (index + 1) as 1 | 2 }))} /></SettingLine>
          <View style={styles.divider} />
          <Text style={styles.groupLabel}>{copy.silence}</Text>
          <View style={styles.silenceRow}><CompactNumber label={copy.leading} unit={copy.milliseconds} value={draft.leadingSilenceMs} onChange={(leadingSilenceMs) => setDraft((current) => ({ ...current, leadingSilenceMs }))} /><CompactNumber label={copy.trailing} unit={copy.milliseconds} value={draft.trailingSilenceMs} onChange={(trailingSilenceMs) => setDraft((current) => ({ ...current, trailingSilenceMs }))} /></View>
        </View>
        <View style={styles.profilePanel}><View style={styles.profileHeader}><View style={styles.profileIcon}><MaterialIcons color="#2F4DA0" name="tune" size={19} /></View><View style={styles.profileCopy}><Text style={styles.profileTitle}>{copy.profile}</Text><Text style={styles.profileHint}>{copy.profileHint}</Text></View></View><View style={styles.profileStats}><ProfileStat label={copy.sample} value={`${draft.sampleRate / 1000} kHz`} /><ProfileStat label={copy.depth} value={`${draft.bitDepth}-bit`} /><ProfileStat label={copy.channels} value={draft.channels === 1 ? copy.mono : copy.stereo} /></View><View style={styles.profileSilenceRow}><ProfileStat label={copy.leading} value={`${draft.leadingSilenceMs} ${copy.milliseconds}`} /><ProfileStat label={copy.trailing} value={`${draft.trailingSilenceMs} ${copy.milliseconds}`} /></View></View>
      </GlassSurface>
      <View style={styles.note}><MaterialIcons color="#2F4DA0" name="info-outline" size={17} /><Text style={styles.noteText}>{copy.note}</Text></View>
      <SettingsFooter versionLabel={zh ? "版本" : "Version"} version={appVersion} />
    </View>
  </ScreenContainer>;
}

function SettingLine({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.settingLine}><Text style={styles.lineLabel}>{label}</Text><View style={styles.lineControl}>{children}</View></View>; }
function Segment({ labels, selectedIndex, onSelect }: { labels: string[]; selectedIndex: number; onSelect: (index: number) => void }) { return <View style={styles.segment}>{labels.map((label, index) => <TouchableOpacity key={label} onPress={() => onSelect(index)} style={[styles.segmentItem, selectedIndex === index && styles.segmentSelected]}><Text style={[styles.segmentText, selectedIndex === index && styles.segmentTextSelected]}>{label}</Text></TouchableOpacity>)}</View>; }
function CompactNumber({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (value: number) => void }) {
  const adjust = (amount: number) => onChange(Math.max(0, Math.min(10000, value + amount)));
  return <View style={styles.numberCard}><View style={styles.numberLabelRow}><MaterialIcons color="#2F4DA0" name="timer" size={14} /><Text style={styles.numberLabel}>{label}</Text></View><View style={styles.numberValue}><TextInput selectTextOnFocus value={String(value)} keyboardType="number-pad" maxLength={5} onChangeText={(text) => onChange(Number(text.replace(/[^0-9]/g, "")) || 0)} style={styles.numberInput} /><View style={styles.stepper}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} +100`} hitSlop={5} style={styles.stepButton} onPress={() => adjust(100)}><MaterialIcons color="#2F4DA0" name="keyboard-arrow-up" size={16} /></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} -100`} hitSlop={5} style={styles.stepButton} onPress={() => adjust(-100)}><MaterialIcons color="#2F4DA0" name="keyboard-arrow-down" size={16} /></TouchableOpacity></View><Text style={styles.unit}>{unit}</Text></View></View>;
}
function ProfileStat({ label, value }: { label: string; value: string }) { return <View style={styles.profileStat}><Text style={styles.profileStatValue}>{value}</Text><Text style={styles.profileStatLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 9 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: 10 }, titleGroup: { flex: 1, minWidth: 0, paddingRight: 12 }, title: { color: "#182B55", fontSize: 25, fontWeight: "900", letterSpacing: -0.4 }, subtitle: { color: "#61749E", fontSize: 12, marginTop: 3 }, topSave: { alignItems: "center", backgroundColor: "rgba(70,105,222,0.94)", borderColor: "rgba(255,255,255,0.82)", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 13, paddingVertical: 10, shadowColor: "#3E5FAC", shadowOpacity: 0.2, shadowRadius: 10 }, topSaveDisabled: { backgroundColor: "rgba(141,160,203,0.7)" }, topSaveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, card: { borderRadius: 23, flex: 1, justifyContent: "space-between", minHeight: 0, padding: 12 }, formatRow: { alignItems: "center", flexDirection: "row" }, formatIcon: { alignItems: "center", backgroundColor: "rgba(220,248,234,0.72)", borderRadius: 10, height: 32, justifyContent: "center", width: 32 }, formatCopy: { flex: 1, marginLeft: 8 }, formatTitle: { color: "#182B55", fontSize: 15, fontWeight: "900" }, formatHint: { color: "#61749E", fontSize: 11, fontWeight: "700", marginTop: 1 }, fixedBadge: { backgroundColor: "rgba(220,248,234,0.74)", borderRadius: 8, color: "#1E8B61", fontSize: 12, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 }, divider: { backgroundColor: "rgba(115,142,196,0.16)", height: 1, marginVertical: 8 }, settingLine: { alignItems: "center", flexDirection: "row", minHeight: 40 }, lineLabel: { color: "#3B527B", fontSize: 13, fontWeight: "800", width: 74 }, lineControl: { flex: 1 }, segment: { backgroundColor: "rgba(221,231,249,0.7)", borderRadius: 10, flexDirection: "row", padding: 2 }, segmentItem: { alignItems: "center", borderRadius: 8, flex: 1, paddingVertical: 6 }, segmentSelected: { backgroundColor: "rgba(255,255,255,0.82)", elevation: 1 }, segmentText: { color: "#61749E", fontSize: 12, fontWeight: "800" }, segmentTextSelected: { color: "#4669DE" }, rateGrid: { flexDirection: "row", gap: 5 }, rateChip: { alignItems: "center", backgroundColor: "rgba(235,241,251,0.72)", borderRadius: 9, flex: 1, paddingVertical: 7 }, rateChipSelected: { backgroundColor: "rgba(228,237,255,0.9)", borderColor: "#4B6FE6", borderWidth: 1, paddingVertical: 6 }, rateText: { color: "#61749E", fontSize: 11, fontWeight: "800" }, rateTextSelected: { color: "#4669DE" }, groupLabel: { color: "#61749E", fontSize: 11, fontWeight: "900", letterSpacing: 0.6, marginBottom: 6 }, silenceRow: { flexDirection: "row", gap: 8 }, numberCard: { backgroundColor: "rgba(234,242,255,0.7)", borderColor: "rgba(255,255,255,0.88)", borderRadius: 14, borderWidth: 1, flex: 1, paddingHorizontal: 8, paddingVertical: 7 }, numberLabelRow: { alignItems: "center", flexDirection: "row", gap: 4 }, numberLabel: { color: "#35518E", fontSize: 12, fontWeight: "900" }, numberValue: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.72)", borderColor: "rgba(190,207,240,0.72)", borderRadius: 9, borderWidth: 1, flexDirection: "row", marginTop: 6, paddingLeft: 7 }, numberInput: { color: "#182B55", flex: 1, fontSize: 19, fontVariant: ["tabular-nums"], fontWeight: "900", minWidth: 28, padding: 0 }, stepper: { alignSelf: "stretch", borderLeftColor: "rgba(165,187,228,0.6)", borderLeftWidth: 1, justifyContent: "center", marginLeft: 3 }, stepButton: { alignItems: "center", height: 18, justifyContent: "center", paddingHorizontal: 2 }, unit: { color: "#4669DE", fontSize: 11, fontWeight: "800", marginHorizontal: 5 }, profilePanel: { backgroundColor: "rgba(226,236,255,0.62)", borderColor: "rgba(255,255,255,0.82)", borderRadius: 15, borderWidth: 1, marginTop: 10, padding: 10 }, profileHeader: { alignItems: "center", flexDirection: "row" }, profileIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.76)", borderRadius: 9, height: 30, justifyContent: "center", width: 30 }, profileCopy: { flex: 1, marginLeft: 8 }, profileTitle: { color: "#263E81", fontSize: 13, fontWeight: "900" }, profileHint: { color: "#526588", fontSize: 10, lineHeight: 13, marginTop: 1 }, profileStats: { flexDirection: "row", gap: 5, marginTop: 9 }, profileSilenceRow: { flexDirection: "row", gap: 5, marginTop: 5 }, profileStat: { backgroundColor: "rgba(255,255,255,0.62)", borderColor: "rgba(255,255,255,0.78)", borderRadius: 9, borderWidth: 1, flex: 1, paddingHorizontal: 7, paddingVertical: 6 }, profileStatValue: { color: "#4669DE", fontSize: 12, fontWeight: "900" }, profileStatLabel: { color: "#61749E", fontSize: 9, fontWeight: "700", marginTop: 1 }, note: { alignItems: "center", backgroundColor: "rgba(229,239,255,0.72)", borderColor: "rgba(255,255,255,0.82)", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8 }, noteText: { color: "#415A84", flex: 1, fontSize: 11, lineHeight: 14 },
});
