import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Slider from "@react-native-community/slider";
import { AudioQuality, IOSOutputFormat, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { AudioWaveform } from "@/components/audio-waveform";
import { PhoneticText } from "@/components/phonetic-text";
import { ScreenContainer } from "@/components/screen-container";
import { useAppLanguage } from "@/lib/i18n";
import { clampReadingFontSize, READING_FONT_SIZE } from "@/lib/reading-font";
import { useRecorder } from "@/lib/recorder-context";
import { canContinueRecordingSession, isProjectRecordingComplete } from "@/lib/recording-session";
import { appendWaveformSample } from "@/lib/waveform-math";

type RecordingPhase = "idle" | "leading" | "recording" | "trailing" | "saving";
const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export default function RecordingScreen() {
  const router = useRouter();
  const { t } = useAppLanguage();
  const { projectId, sentence: sentenceParam } = useLocalSearchParams<{ projectId: string; sentence?: string }>();
  const { projects, speakers, settings, saveSentenceRecording, updateSettings } = useRecorder();
  const project = projects.find((item) => item.id === projectId);
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, Number(sentenceParam) || 0));
  const [jumpValue, setJumpValue] = useState("");
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [showFontControls, setShowFontControls] = useState(false);
  const [readingFontSize, setReadingFontSize] = useState(settings.readingFontSize);
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const lifecycleTokenRef = useRef(0);
  const pauseCancellerRef = useRef<(() => void) | null>(null);
  const nativeOperationRef = useRef<Promise<void>>(Promise.resolve());
  const promptWave = useRef(new Animated.Value(0)).current;
  const player = useAudioPlayer(null, { updateInterval: 90 });
  const playerStatus = useAudioPlayerStatus(player);
  const recorderOptions = useMemo(() => ({
    extension: ".m4a", sampleRate: settings.sampleRate, numberOfChannels: settings.channels, bitRate: settings.bitRate, isMeteringEnabled: true,
    android: { extension: ".m4a", outputFormat: "mpeg4" as const, audioEncoder: "aac" as const, audioSource: "mic" as const },
    ios: { extension: ".m4a", outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MAX, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
    web: { mimeType: "audio/webm", bitsPerSecond: settings.bitRate },
  }), [settings]);
  const recorder = useAudioRecorder(recorderOptions);
  const recorderState = useAudioRecorderState(recorder, 90);
  useKeepAwake();

  const sentence = project?.sentences[currentIndex];
  const speaker = project ? speakers.find((item) => item.id === project.speakerId) : undefined;
  const total = project?.sentences.length ?? 0;
  const isBusy = phase !== "idle" || isClosing;
  const playbackProgress = playerStatus.duration > 0 ? playerStatus.currentTime / playerStatus.duration : 0;
  const projectComplete = isProjectRecordingComplete(project?.sentences.map((item) => item.recordingUri) ?? []);

  const cancelPendingOperation = () => {
    lifecycleTokenRef.current += 1;
    pauseCancellerRef.current?.();
    pauseCancellerRef.current = null;
  };
  const isCancelled = (token: number) => !canContinueRecordingSession(token, lifecycleTokenRef.current, closingRef.current);
  const waitForSilence = (milliseconds: number, token: number) => new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      if (pauseCancellerRef.current === cancel) pauseCancellerRef.current = null;
      resolve(!isCancelled(token));
    }, milliseconds);
    const cancel = () => { clearTimeout(timeout); resolve(false); };
    pauseCancellerRef.current = cancel;
  });
  const runRecorderOperation = async (operation: () => Promise<void>) => {
    const previous = nativeOperationRef.current;
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => { release = resolve; });
    nativeOperationRef.current = previous.catch(() => undefined).then(() => next);
    await previous.catch(() => undefined);
    try { await operation(); }
    finally { release(); }
  };
  const stopRecorderSafely = async () => {
    await runRecorderOperation(async () => {
      try { if (recorder.isRecording || recorderState.isRecording) await recorder.stop(); }
      catch { /* stopping an unprepared recorder is safe to ignore during cancellation */ }
    });
  };

  useEffect(() => { setCurrentIndex(Math.min(Math.max(0, Number(sentenceParam) || 0), Math.max(0, total - 1))); }, [sentenceParam, total]);
  useEffect(() => { setReadingFontSize(settings.readingFontSize); }, [settings.readingFontSize]);
  useEffect(() => {
    promptWave.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(promptWave, { toValue: 1, duration: 460, useNativeDriver: true }),
      Animated.timing(promptWave, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [promptWave, sentence?.id]);
  useEffect(() => {
    if (phase !== "recording") return;
    setLiveWaveform((current) => appendWaveformSample(current, recorderState.metering));
  }, [phase, recorderState.metering]);
  useEffect(() => () => {
    closingRef.current = true;
    cancelPendingOperation();
    void stopRecorderSafely();
  }, [recorder]);

  if (!project || !sentence || !speaker) return <ScreenContainer className="items-center justify-center px-6"><Text style={styles.missing}>Unable to open this recording sentence.</Text><TouchableOpacity onPress={() => router.replace("/(tabs)" as never)}><Text style={styles.backText}>Back to tasks</Text></TouchableOpacity></ScreenContainer>;

  const notify = (style: Haptics.ImpactFeedbackStyle) => { if (Platform.OS !== "web") void Haptics.impactAsync(style); };
  const closeScreen = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    cancelPendingOperation();
    try { await stopRecorderSafely(); player.pause(); }
    catch { /* navigation should remain available even when a native audio resource is unavailable */ }
    if (router.canGoBack()) router.back(); else router.replace(`/project/${project.id}` as never);
  };
  const start = async () => {
    const token = ++lifecycleTokenRef.current;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (isCancelled(token)) return;
      if (!permission.granted) { Alert.alert("Microphone permission", "Allow microphone access in system settings before recording."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: "doNotMix", interruptionModeAndroid: "doNotMix" });
      if (isCancelled(token)) return;
      setLiveWaveform([]); notify(Haptics.ImpactFeedbackStyle.Light); setPhase("leading");
      if (!await waitForSilence(settings.leadingSilenceMs, token)) { if (!closingRef.current) setPhase("idle"); return; }
      await runRecorderOperation(async () => {
        await recorder.prepareToRecordAsync();
        if (!isCancelled(token)) recorder.record();
      });
      if (isCancelled(token)) { await stopRecorderSafely(); return; }
      setPhase("recording"); notify(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) { if (!isCancelled(token)) { setPhase("idle"); Alert.alert("Unable to start recording", error instanceof Error ? error.message : "Check the microphone permission and device status."); } }
  };
  const finish = async () => {
    const token = lifecycleTokenRef.current;
    try {
      setPhase("trailing"); if (!await waitForSilence(settings.trailingSilenceMs, token)) return;
      await stopRecorderSafely();
      if (isCancelled(token)) return;
      const uri = recorder.uri;
      if (!uri) throw new Error("Recording file was not created.");
      setPhase("saving"); const result = await saveSentenceRecording(project.id, sentence.id, uri, liveWaveform); notify(Haptics.ImpactFeedbackStyle.Medium); setPhase("idle"); if (result.publicExportError) Alert.alert("录音已保存", result.publicExportError); setCurrentIndex((value) => Math.min(value + 1, total - 1));
    } catch (error) { if (!isCancelled(token)) { setPhase("idle"); Alert.alert("Unable to save recording", error instanceof Error ? error.message : "Try recording this sentence again."); } }
  };
  const togglePlay = async () => {
    if (!sentence.recordingUri) return;
    if (playerStatus.playing) { player.pause(); return; }
    player.replace({ uri: sentence.recordingUri }); await player.seekTo(0); player.play();
  };
  const jump = () => { const target = Number(jumpValue) - 1; if (Number.isInteger(target) && target >= 0 && target < total) { setCurrentIndex(target); setJumpValue(""); } else Alert.alert("Invalid sentence", `Enter a number between 1 and ${total}.`); };
  const finishTask = () => { try { player.pause(); } catch { /* player is optional */ } router.replace(`/project/${project.id}` as never); };
  const statusCopy = phase === "leading" ? t("leadingSilence") : phase === "recording" ? t("recording") : phase === "trailing" ? t("trailingSilence") : phase === "saving" ? t("saving") : sentence.recordingUri ? t("recorded") : t("ready");
  const waveform = phase === "recording" ? liveWaveform : sentence.waveform ?? [];
  const promptRippleStyle = {
    opacity: promptWave.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 0.28, 0.18, 0] }),
    transform: [{ translateX: promptWave.interpolate({ inputRange: [0, 1], outputRange: [-90, 440] }) }],
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.page}>
        <View style={styles.header}><TouchableOpacity style={styles.iconButton} onPress={closeScreen} disabled={isClosing}><MaterialIcons color="#2F4DA0" name="close" size={24} /></TouchableOpacity><View style={styles.headerCenter}><Text style={styles.speaker}>{speaker.name} · {speaker.gender} · {speaker.age}</Text><Text style={styles.position}>{currentIndex + 1} / {total}</Text></View><TouchableOpacity style={styles.iconButton} onPress={() => router.replace(`/project/${project.id}` as never)} disabled={isBusy}><MaterialIcons color="#2F4DA0" name="format-list-bulleted" size={23} /></TouchableOpacity></View>
        <View style={styles.progressTrack}><View style={[styles.progress, { width: `${total ? ((currentIndex + 1) / total) * 100 : 0}%` }]} /></View>
        <View style={styles.promptBox}>
          <Text style={styles.promptLabel}>{t("prompt")}</Text>
          <View style={styles.promptTextWrapper}>
            <Animated.Text style={[styles.promptText, { transform: [{ scale: promptWave.interpolate({ inputRange: [0, 0.36, 1], outputRange: [1, 1.025, 1] }) }] }]}>{sentence.prompt || t("ready")}</Animated.Text>
            <Animated.View pointerEvents="none" style={[styles.promptRipple, promptRippleStyle]} />
          </View>
        </View>
        <View style={styles.readingCard}>
          <View style={styles.readingHeader}>
            <Text style={styles.readingCaption}>{t("readingText")}</Text>
            <TouchableOpacity accessibilityLabel={t("fontSize")} accessibilityRole="button" hitSlop={8} onPress={() => setShowFontControls((visible) => !visible)} style={[styles.fontButton, showFontControls && styles.fontButtonActive]}>
              <MaterialIcons color={showFontControls ? "#FFFFFF" : "#2F4DA0"} name="format-size" size={21} />
            </TouchableOpacity>
          </View>
          {showFontControls ? <View style={styles.fontControl}><Text style={styles.fontControlLabel}>{t("fontSize")}</Text><Slider accessibilityLabel={t("fontSize")} minimumTrackTintColor="#2F4DA0" maximumTrackTintColor="#DDE4F0" thumbTintColor="#2F4DA0" minimumValue={READING_FONT_SIZE.minimumValue} maximumValue={READING_FONT_SIZE.maximumValue} step={READING_FONT_SIZE.step} value={readingFontSize} onValueChange={(value) => setReadingFontSize(clampReadingFontSize(value))} onSlidingComplete={(value) => updateSettings({ ...settings, readingFontSize: clampReadingFontSize(value) })} style={styles.fontSlider} /><Text style={styles.fontValue}>{readingFontSize}</Text></View> : null}
          <ScrollView accessibilityLabel={t("readingText")} contentContainerStyle={styles.readingTextContent} nestedScrollEnabled persistentScrollbar showsVerticalScrollIndicator style={styles.readingTextArea}>
            <PhoneticText fontSize={readingFontSize} tokens={sentence.tokens} />
          </ScrollView>
        </View>
        <View style={styles.waveformBlock}><View style={styles.waveformHeader}><Text style={styles.waveformTitle}>{phase === "recording" ? t("recording") : sentence.recordingUri ? t("play") : t("ready")}</Text>{sentence.recordingUri && phase !== "recording" ? <Text style={styles.waveformTime}>{formatSeconds(playerStatus.currentTime)} / {formatSeconds(playerStatus.duration)}</Text> : phase === "recording" ? <Text style={styles.waveformTime}>{formatSeconds(recorderState.durationMillis / 1000)}</Text> : null}</View><AudioWaveform samples={waveform} recording={phase === "recording"} progress={sentence.recordingUri && phase !== "recording" ? playbackProgress : 0} /></View>
        <Text style={[styles.statusText, phase === "recording" && styles.statusRecording]}>{statusCopy}</Text>
        <View style={styles.bottomActionArea}>
          <View style={styles.bottomTools}><TouchableOpacity style={[styles.tool, !sentence.recordingUri && styles.toolDisabled]} onPress={togglePlay} disabled={!sentence.recordingUri || isBusy}><MaterialIcons color={sentence.recordingUri ? "#2F4DA0" : "#B9C2D5"} name={playerStatus.playing ? "pause" : "play-arrow"} size={23} /><Text style={[styles.toolText, !sentence.recordingUri && styles.toolTextDisabled]}>{playerStatus.playing ? t("pause") : t("play")}</Text></TouchableOpacity><TouchableOpacity style={styles.tool} onPress={() => setCurrentIndex((value) => Math.max(0, value - 1))} disabled={isBusy || currentIndex === 0}><MaterialIcons color={currentIndex ? "#2F4DA0" : "#B9C2D5"} name="skip-previous" size={23} /><Text style={[styles.toolText, currentIndex === 0 && styles.toolTextDisabled]}>{t("previous")}</Text></TouchableOpacity><TouchableOpacity style={styles.tool} onPress={() => setCurrentIndex((value) => Math.min(total - 1, value + 1))} disabled={isBusy || currentIndex === total - 1}><MaterialIcons color={currentIndex < total - 1 ? "#2F4DA0" : "#B9C2D5"} name="skip-next" size={23} /><Text style={[styles.toolText, currentIndex === total - 1 && styles.toolTextDisabled]}>{t("next")}</Text></TouchableOpacity></View>
          <View style={styles.jumpRow}><TextInput value={jumpValue} onChangeText={setJumpValue} keyboardType="number-pad" placeholder="Sentence #" placeholderTextColor="#9AA5BC" style={styles.jumpInput} editable={!isBusy} /><TouchableOpacity style={styles.jumpButton} onPress={jump} disabled={isBusy}><Text style={styles.jumpText}>{t("jump")}</Text></TouchableOpacity></View>
          {phase === "idle" && projectComplete ? <TouchableOpacity style={styles.completeButton} onPress={finishTask}><MaterialIcons color="#FFFFFF" name="check-circle" size={23} /><Text style={styles.recordText}>{t("completeTask")}</Text></TouchableOpacity> : phase === "idle" ? <TouchableOpacity style={[styles.recordButton, sentence.recordingUri && styles.rerecordButton]} onPress={start}><MaterialIcons color="#FFFFFF" name="mic" size={23} /><Text style={styles.recordText}>{sentence.recordingUri ? t("replaySentence") : t("startRecording")}</Text></TouchableOpacity> : phase === "leading" ? <TouchableOpacity style={styles.cancelButton} onPress={() => { cancelPendingOperation(); setPhase("idle"); }}><Text style={styles.cancelText}>{t("cancelPreparation")}</Text></TouchableOpacity> : phase === "recording" ? <TouchableOpacity style={styles.stopButton} onPress={finish}><View style={styles.stopSquare} /><Text style={styles.recordText}>{t("stopRecording")}</Text></TouchableOpacity> : <View style={styles.workingButton}><ActivityIndicator color="#FFFFFF" /><Text style={styles.recordText}>{phase === "trailing" ? t("trailingSilence") : t("saving")}</Text></View>}
        </View>
      </View>
    </ScreenContainer>
  );
}

function formatSeconds(seconds?: number) { const safe = Math.max(0, Math.floor(seconds ?? 0)); return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`; }

const styles = StyleSheet.create({
  page: { flex: 1 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 6 }, iconButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 }, headerCenter: { alignItems: "center" }, speaker: { color: "#182033", fontSize: 14, fontWeight: "800" }, position: { color: "#65708A", fontSize: 12, marginTop: 3 }, progressTrack: { backgroundColor: "#E5E9F1", borderRadius: 99, height: 5, marginTop: 13, overflow: "hidden" }, progress: { backgroundColor: "#2F4DA0", borderRadius: 99, height: "100%" }, promptBox: { alignItems: "flex-start", backgroundColor: "#EEF3FF", borderRadius: 14, marginTop: 14, padding: 12 }, promptLabel: { alignSelf: "flex-start", color: "#65708A", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 }, promptTextWrapper: { alignSelf: "stretch", marginTop: 4, overflow: "hidden", position: "relative" }, promptText: { color: "#30466F", fontSize: 16, fontWeight: "700", lineHeight: 23 }, promptRipple: { backgroundColor: "#B9D7FF", borderRadius: 99, bottom: 2, position: "absolute", top: 2, width: 88 }, readingCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 20, borderWidth: 1, flex: 1, marginTop: 12, minHeight: 184, padding: 20 }, readingHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", width: "100%" }, readingCaption: { color: "#8A95AA", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 }, fontButton: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 12, height: 32, justifyContent: "center", width: 32 }, fontButtonActive: { backgroundColor: "#2F4DA0" }, fontControl: { alignItems: "center", backgroundColor: "#F6F8FD", borderRadius: 12, flexDirection: "row", marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, width: "100%" }, fontControlLabel: { color: "#65708A", fontSize: 12, fontWeight: "700", marginRight: 4 }, fontSlider: { flex: 1, height: 30 }, fontValue: { color: "#2F4DA0", fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "800", marginLeft: 5, minWidth: 22, textAlign: "right" }, readingTextArea: { alignSelf: "stretch", flex: 1, marginTop: 10, width: "100%" }, readingTextContent: { alignItems: "center", flexGrow: 1, justifyContent: "center", paddingBottom: 4, paddingHorizontal: 2 }, waveformBlock: { marginTop: 9 }, waveformHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }, waveformTitle: { color: "#3F4A62", fontSize: 12, fontWeight: "800" }, waveformTime: { color: "#65708A", fontSize: 12, fontVariant: ["tabular-nums"] }, statusText: { color: "#65708A", fontSize: 12, marginTop: 6, textAlign: "center" }, statusRecording: { color: "#D64646", fontWeight: "800" }, bottomActionArea: { marginTop: "auto", paddingBottom: 4 }, bottomTools: { flexDirection: "row", gap: 9, justifyContent: "space-between" }, tool: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 13, borderWidth: 1, flex: 1, gap: 3, paddingVertical: 8 }, toolDisabled: { backgroundColor: "#F7F8FB" }, toolText: { color: "#2F4DA0", fontSize: 12, fontWeight: "800" }, toolTextDisabled: { color: "#B9C2D5" }, jumpRow: { flexDirection: "row", gap: 9, marginTop: 9 }, jumpInput: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 11, borderWidth: 1, color: "#182033", flex: 1, fontSize: 14, paddingHorizontal: 13, paddingVertical: 9 }, jumpButton: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 11, justifyContent: "center", paddingHorizontal: 19 }, jumpText: { color: "#2F4DA0", fontSize: 14, fontWeight: "800" }, recordButton: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 17, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 10, paddingVertical: 16 }, rerecordButton: { backgroundColor: "#4963B5" }, stopButton: { alignItems: "center", backgroundColor: "#D64646", borderRadius: 17, flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 10, paddingVertical: 16 }, workingButton: { alignItems: "center", backgroundColor: "#7481A0", borderRadius: 17, flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 10, paddingVertical: 16 }, completeButton: { alignItems: "center", backgroundColor: "#1E8B61", borderRadius: 17, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 10, paddingVertical: 16 }, cancelButton: { alignItems: "center", backgroundColor: "#EDF0F6", borderRadius: 17, marginTop: 10, paddingVertical: 16 }, cancelText: { color: "#3F4A62", fontSize: 16, fontWeight: "800" }, stopSquare: { backgroundColor: "#FFFFFF", borderRadius: 3, height: 15, width: 15 }, recordText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, missing: { color: "#65708A", fontSize: 16 }, backText: { color: "#2F4DA0", fontWeight: "800", marginTop: 12 },
});
