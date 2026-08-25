import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AudioWaveform } from "@/components/audio-waveform";
import { LiquidSlider } from "@/components/liquid-controls";
import { GlassSurface } from "@/components/liquid-glass";
import { PhoneticText } from "@/components/phonetic-text";
import { ScreenContainer } from "@/components/screen-container";
import { useAppLanguage } from "@/lib/i18n";
import { createProjectSyncKey, type SyncCommand } from "@/lib/lan-sync-protocol";
import { shouldAnimatePromptChange } from "@/lib/prompt-animation";
import { clampReadingFontSize, READING_FONT_SIZE } from "@/lib/reading-font";
import { useRecorder } from "@/lib/recorder-context";
import { canContinueRecordingSession, isLiveWaveformPhase, isProjectRecordingComplete } from "@/lib/recording-session";
import { useSyncRoom } from "@/lib/sync-room-context";
import { getSyncDeviceIndicator, getSyncDeviceInitial } from "@/lib/sync-device-status";
import { cancelWavRecording, startWavRecording, stopWavRecording } from "@/lib/wav-recorder";
import { appendWaveformSample } from "@/lib/waveform-math";

type RecordingPhase = "idle" | "leading" | "recording" | "trailing" | "saving";

export default function RecordingScreen() {
  const router = useRouter();
  const { t } = useAppLanguage();
  const { projectId, sentence: sentenceParam } = useLocalSearchParams<{ projectId: string; sentence?: string }>();
  const { projects, speakers, settings, saveSentenceRecording, updateSettings } = useRecorder();
  const { status: syncStatus, reportState, sendCommand, subscribeCommands } = useSyncRoom();
  const project = projects.find((item) => item.id === projectId);
  const syncProjectKey = project ? createProjectSyncKey(project.sourceFileName, project.sentences) : "";
  const activeSyncProjectKey = syncStatus.mode !== "idle" ? (syncStatus.projectId || syncProjectKey) : syncProjectKey;
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, Number(sentenceParam) || 0));
  const [showSentencePicker, setShowSentencePicker] = useState(false);
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [showFontControls, setShowFontControls] = useState(false);
  const [readingFontSize, setReadingFontSize] = useState(settings.readingFontSize);
  const [isClosing, setIsClosing] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const liveWaveformRef = useRef<number[]>([]);
  const closingRef = useRef(false);
  const lifecycleTokenRef = useRef(0);
  const pauseCancellerRef = useRef<(() => void) | null>(null);
  const nativeOperationRef = useRef<Promise<void>>(Promise.resolve());
  const promptWave = useRef(new Animated.Value(0)).current;
  const previousPromptRef = useRef<string | null>(null);
  const syncCommandHandlerRef = useRef<(command: SyncCommand) => void>(() => undefined);
  const syncTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const player = useAudioPlayer(null, { updateInterval: 90 });
  const playerStatus = useAudioPlayerStatus(player);
  useKeepAwake();

  const sentence = project?.sentences[currentIndex];
  const speaker = project ? speakers.find((item) => item.id === project.speakerId) : undefined;
  const total = project?.sentences.length ?? 0;
  const isBusy = phase !== "idle" || isClosing;
  const playbackProgress = playerStatus.duration > 0 ? playerStatus.currentTime / playerStatus.duration : 0;
  const projectComplete = isProjectRecordingComplete(project?.sentences.map((item) => item.recordingUri) ?? []);
  const promptContent = sentence?.prompt || t("ready");

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
      try { await cancelWavRecording(); }
      catch { /* stopping an unprepared recorder is safe to ignore during cancellation */ }
    });
  };
  const stopPlayback = () => {
    try {
      player.pause();
      void player.seekTo(0);
    } catch { /* the player may not be initialized while changing recording state */ }
  };
  const appendLiveWaveformSample = (metering: number) => {
    const next = appendWaveformSample(liveWaveformRef.current, metering);
    liveWaveformRef.current = next;
    setLiveWaveform(next);
  };

  useEffect(() => { setCurrentIndex(Math.min(Math.max(0, Number(sentenceParam) || 0), Math.max(0, total - 1))); }, [sentenceParam, total]);
  useEffect(() => { setReadingFontSize(settings.readingFontSize); }, [settings.readingFontSize]);
  useEffect(() => {
    if (syncStatus.mode !== "client") return;
    setShowSentencePicker(false);
    setShowFontControls(false);
  }, [syncStatus.mode]);
  useEffect(() => {
    if (!sentence) return;
    const shouldAnimate = shouldAnimatePromptChange(previousPromptRef.current, promptContent);
    previousPromptRef.current = promptContent;
    promptWave.stopAnimation();
    promptWave.setValue(0);
    if (!shouldAnimate) return;
    const animation = Animated.sequence([
      Animated.timing(promptWave, { toValue: 1, duration: 540, useNativeDriver: true }),
      Animated.timing(promptWave, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [promptContent, promptWave, sentence?.id]);
  useEffect(() => phase !== "recording" ? undefined : (() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setRecordingDurationMs(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  })(), [phase]);
  useEffect(() => () => {
    closingRef.current = true;
    cancelPendingOperation();
    void stopRecorderSafely();
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeCommands((command) => {
      if (!activeSyncProjectKey || command.projectId !== activeSyncProjectKey) return;
      const timer = setTimeout(() => {
        syncTimersRef.current.delete(timer);
        syncCommandHandlerRef.current(command);
      }, Math.max(0, command.executeAt - Date.now()));
      syncTimersRef.current.add(timer);
    });
    return () => {
      unsubscribe();
      syncTimersRef.current.forEach((timer) => clearTimeout(timer));
      syncTimersRef.current.clear();
    };
  }, [activeSyncProjectKey, subscribeCommands]);
  useEffect(() => {
    if (syncStatus.mode === "idle" || syncStatus.projectId !== activeSyncProjectKey) return;
    reportState({ state: playerStatus.playing && phase === "idle" ? "playing" : phase === "idle" ? "ready" : phase, sentenceIndex: currentIndex });
  }, [activeSyncProjectKey, currentIndex, phase, playerStatus.playing, reportState, syncStatus.mode, syncStatus.projectId]);

  if (!project || !sentence || !speaker) return <ScreenContainer className="items-center justify-center px-6"><Text style={styles.missing}>Unable to open this recording sentence.</Text><TouchableOpacity onPress={() => router.replace("/(tabs)" as never)}><Text style={styles.backText}>Back to tasks</Text></TouchableOpacity></ScreenContainer>;

  const notify = (style: Haptics.ImpactFeedbackStyle) => { if (Platform.OS !== "web") void Haptics.impactAsync(style); };
  const closeScreen = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    cancelPendingOperation();
    try { await stopRecorderSafely(); stopPlayback(); }
    catch { /* navigation should remain available even when a native audio resource is unavailable */ }
    if (syncActive) router.replace(`/project/${project.id}` as never);
    else if (router.canGoBack()) router.back(); else router.replace(`/project/${project.id}` as never);
  };
  const start = async () => {
    const token = ++lifecycleTokenRef.current;
    try {
      stopPlayback();
      liveWaveformRef.current = [];
      setLiveWaveform([]); setRecordingDurationMs(0); notify(Haptics.ImpactFeedbackStyle.Light); setPhase("leading");
      await runRecorderOperation(async () => {
        if (!isCancelled(token)) await startWavRecording(settings, appendLiveWaveformSample);
      });
      if (isCancelled(token)) { await stopRecorderSafely(); return; }
      if (!await waitForSilence(settings.leadingSilenceMs, token)) { await stopRecorderSafely(); if (!closingRef.current) setPhase("idle"); return; }
      setPhase("recording"); notify(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) { await stopRecorderSafely(); if (!isCancelled(token)) { setPhase("idle"); Alert.alert("Unable to start recording", error instanceof Error ? error.message : "Check the microphone permission and device status."); } }
  };
  const finish = async () => {
    const token = lifecycleTokenRef.current;
    try {
      setPhase("trailing"); if (!await waitForSilence(settings.trailingSilenceMs, token)) return;
      const uri = await stopWavRecording();
      if (isCancelled(token)) return;
      if (!uri) throw new Error("Recording file was not created.");
      setPhase("saving"); const result = await saveSentenceRecording(project.id, sentence.id, uri, liveWaveformRef.current); notify(Haptics.ImpactFeedbackStyle.Medium); setPhase("idle"); if (result.publicExportError) Alert.alert("录音已保存", result.publicExportError); setCurrentIndex((value) => Math.min(value + 1, total - 1));
    } catch (error) { if (!isCancelled(token)) { setPhase("idle"); Alert.alert("Unable to save recording", error instanceof Error ? error.message : "Try recording this sentence again."); } }
  };
  const togglePlay = async () => {
    if (!sentence.recordingUri) return;
    if (playerStatus.playing) { player.pause(); return; }
    player.replace({ uri: sentence.recordingUri }); await player.seekTo(0); player.play();
  };
  const jumpToSentence = (target: number) => { stopPlayback(); setCurrentIndex(target); setShowSentencePicker(false); };
  const moveToSyncSentence = (target: number) => { cancelPendingOperation(); void stopRecorderSafely(); stopPlayback(); setPhase("idle"); setCurrentIndex(Math.min(Math.max(0, target), total - 1)); };
  const finishTask = () => { cancelPendingOperation(); void stopRecorderSafely(); stopPlayback(); setPhase("idle"); router.replace(`/project/${project.id}` as never); };
  const syncActive = syncStatus.mode !== "idle" && syncStatus.projectId === activeSyncProjectKey;
  const syncHost = syncActive && syncStatus.mode === "host";
  const syncClient = syncActive && syncStatus.mode === "client";
  const syncDevices = syncActive ? syncStatus.devices : [];
  const sendOrRun = (name: "open" | "start" | "stop" | "previous" | "next" | "jump" | "play" | "rerecord" | "cancel" | "complete", target = currentIndex) => {
    if (syncHost) { sendCommand(name, target); return true; }
    return false;
  };
  syncCommandHandlerRef.current = (command) => {
    const target = Math.min(Math.max(0, command.sentenceIndex), total - 1);
    if (command.name === "open") { moveToSyncSentence(target); return; }
    if (command.name === "previous" || command.name === "next" || command.name === "jump") { moveToSyncSentence(target); return; }
    if (command.name === "cancel") { cancelPendingOperation(); void stopRecorderSafely(); stopPlayback(); setPhase("idle"); return; }
    if (command.name === "complete") { finishTask(); return; }
    if (command.name === "play") { if (target !== currentIndex) { moveToSyncSentence(target); return; } void togglePlay(); return; }
    if (command.name === "stop") { if (phase === "leading" || phase === "recording") void finish(); return; }
    if (target !== currentIndex) { moveToSyncSentence(target); return; }
    if (phase === "idle") void start();
  };
  const statusCopy = phase === "leading" ? t("leadingSilence") : phase === "recording" ? t("recording") : phase === "trailing" ? t("trailingSilence") : phase === "saving" ? t("saving") : sentence.recordingUri ? t("recorded") : t("ready");
  const waveformActive = isLiveWaveformPhase(phase);
  const waveform = waveformActive ? liveWaveform : sentence.waveform ?? [];
  const promptRippleStyle = {
    opacity: promptWave.interpolate({ inputRange: [0, 0.12, 0.76, 1], outputRange: [0, 0.62, 0.38, 0] }),
    transform: [{ translateX: promptWave.interpolate({ inputRange: [0, 1], outputRange: [-140, 520] }) }],
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.page}>
        <View style={styles.header}><TouchableOpacity style={[styles.iconButton, glass.iconButton, syncClient && styles.iconButtonDisabled]} onPress={closeScreen} disabled={isClosing || syncClient}><MaterialIcons color={syncClient ? "#B9C2D5" : "#4669DE"} name="close" size={24} /></TouchableOpacity><View style={styles.headerCenter}><Text style={[styles.speaker, glass.speaker]}>{speaker.name} · {speaker.gender} · {speaker.age}</Text><Text style={[styles.position, glass.position]}>{currentIndex + 1} / {total}</Text></View><TouchableOpacity style={[styles.iconButton, glass.iconButton, syncClient && styles.iconButtonDisabled]} onPress={() => router.replace(`/project/${project.id}` as never)} disabled={isBusy || syncClient}><MaterialIcons color={syncClient ? "#B9C2D5" : "#4669DE"} name="format-list-bulleted" size={23} /></TouchableOpacity></View>
        <View style={[styles.progressTrack, glass.progressTrack]}><View style={[styles.progress, glass.progress, { width: `${total ? ((currentIndex + 1) / total) * 100 : 0}%` }]} /></View>
        {syncDevices.length ? <View accessibilityLabel="同步设备状态" style={styles.syncDots}>{syncDevices.map((device) => <SyncDeviceDot device={device} key={device.id} />)}</View> : null}
        <GlassSurface style={[styles.promptBox, glass.promptBox]} intensity={30}>
          <Text style={[styles.promptLabel, glass.promptLabel]}>{t("prompt")}</Text>
          <View style={styles.promptTextWrapper}>
            <Animated.Text style={[styles.promptText, glass.promptText, { transform: [{ scale: promptWave.interpolate({ inputRange: [0, 0.36, 1], outputRange: [1, 1.07, 1] }) }] }]}>{promptContent}</Animated.Text>
            <Animated.View pointerEvents="none" style={[styles.promptRipple, promptRippleStyle]} />
          </View>
        </GlassSurface>
        <GlassSurface style={[styles.readingCard, glass.readingCard]} intensity={32}>
          <View style={styles.readingHeader}>
            <Text style={styles.readingCaption}>{t("readingText")}</Text>
            <TouchableOpacity accessibilityLabel={t("fontSize")} accessibilityRole="button" disabled={syncClient} hitSlop={8} onPress={() => setShowFontControls((visible) => !visible)} style={[styles.fontButton, glass.fontButton, showFontControls && styles.fontButtonActive, syncClient && styles.iconButtonDisabled]}>
              <MaterialIcons color={syncClient ? "#B9C2D5" : showFontControls ? "#FFFFFF" : "#4669DE"} name="format-size" size={21} />
            </TouchableOpacity>
          </View>
          {showFontControls ? <View style={styles.fontControl}><Text style={styles.fontControlLabel}>{t("fontSize")}</Text><LiquidSlider accessibilityLabel={t("fontSize")} disabled={syncClient} maximumValue={READING_FONT_SIZE.maximumValue} minimumValue={READING_FONT_SIZE.minimumValue} onSlidingComplete={(value) => updateSettings({ ...settings, readingFontSize: clampReadingFontSize(value) })} onValueChange={(value) => setReadingFontSize(clampReadingFontSize(value))} step={READING_FONT_SIZE.step} style={styles.fontSlider} value={readingFontSize} /><Text style={styles.fontValue}>{readingFontSize}</Text></View> : null}
          <ScrollView accessibilityLabel={t("readingText")} contentContainerStyle={styles.readingTextContent} nestedScrollEnabled persistentScrollbar showsVerticalScrollIndicator style={styles.readingTextArea}>
            <PhoneticText fontSize={readingFontSize} tokens={sentence.tokens} />
          </ScrollView>
        </GlassSurface>
        <GlassSurface style={[styles.waveformBlock, glass.waveformBlock]} intensity={25}><View style={styles.waveformHeader}><Text style={[styles.waveformTitle, glass.waveformTitle]}>{waveformActive ? statusCopy : sentence.recordingUri ? t("play") : t("ready")}</Text>{sentence.recordingUri && !waveformActive ? <Text style={[styles.waveformTime, glass.waveformTime]}>{formatSeconds(playerStatus.currentTime)} / {formatSeconds(playerStatus.duration)}</Text> : phase === "recording" ? <Text style={[styles.waveformTime, glass.waveformTime]}>{formatSeconds(recordingDurationMs / 1000)}</Text> : null}</View><AudioWaveform samples={waveform} recording={waveformActive} progress={sentence.recordingUri && !waveformActive ? playbackProgress : 0} /></GlassSurface>
        <Text style={[styles.statusText, phase === "recording" && styles.statusRecording]}>{statusCopy}</Text>
        <View style={styles.bottomActionArea}>
          <View style={styles.bottomTools}><TouchableOpacity style={[styles.tool, glass.tool, (!sentence.recordingUri || syncClient) && styles.toolDisabled]} onPress={() => { if (!sendOrRun("play")) void togglePlay(); }} disabled={!sentence.recordingUri || isBusy || syncClient}><MaterialIcons color={!syncClient && sentence.recordingUri ? "#4669DE" : "#B9C2D5"} name={playerStatus.playing ? "pause" : "play-arrow"} size={23} /><Text style={[styles.toolText, glass.toolText, (!sentence.recordingUri || syncClient) && styles.toolTextDisabled]}>{playerStatus.playing ? t("pause") : t("play")}</Text></TouchableOpacity><TouchableOpacity style={[styles.tool, glass.tool, (syncClient || currentIndex === 0) && styles.toolDisabled]} onPress={() => { const target = Math.max(0, currentIndex - 1); if (!sendOrRun("previous", target)) moveToSyncSentence(target); }} disabled={isBusy || syncClient || currentIndex === 0}><MaterialIcons color={!syncClient && currentIndex ? "#4669DE" : "#B9C2D5"} name="skip-previous" size={23} /><Text style={[styles.toolText, glass.toolText, (syncClient || currentIndex === 0) && styles.toolTextDisabled]}>{t("previous")}</Text></TouchableOpacity><TouchableOpacity style={[styles.tool, glass.tool, (syncClient || currentIndex === total - 1) && styles.toolDisabled]} onPress={() => { const target = Math.min(total - 1, currentIndex + 1); if (!sendOrRun("next", target)) moveToSyncSentence(target); }} disabled={isBusy || syncClient || currentIndex === total - 1}><MaterialIcons color={!syncClient && currentIndex < total - 1 ? "#4669DE" : "#B9C2D5"} name="skip-next" size={23} /><Text style={[styles.toolText, glass.toolText, (syncClient || currentIndex === total - 1) && styles.toolTextDisabled]}>{t("next")}</Text></TouchableOpacity></View>
          <TouchableOpacity accessibilityLabel={t("sentenceNumber")} accessibilityRole="button" disabled={isBusy || syncClient} onPress={() => setShowSentencePicker(true)} style={[styles.sentencePickerButton, glass.sentencePickerButton, (isBusy || syncClient) && styles.sentencePickerDisabled]}><View style={[styles.sentencePickerIcon, glass.sentencePickerIcon]}><MaterialIcons color="#4669DE" name="format-list-numbered" size={20} /></View><View style={styles.sentencePickerCopy}><Text style={[styles.sentencePickerLabel, glass.sentencePickerLabel]}>{t("sentenceNumber")}</Text><Text style={[styles.sentencePickerValue, glass.sentencePickerValue]}>#{String(currentIndex + 1).padStart(3, "0")} / {total}</Text></View><MaterialIcons color="#4669DE" name="expand-more" size={24} /></TouchableOpacity>
          {phase === "idle" ? <View style={styles.idleActionRow}><TouchableOpacity disabled={syncClient} style={[styles.recordButton, styles.inlineAction, sentence.recordingUri && styles.rerecordButton, syncClient && { opacity: 0.55 }]} onPress={() => { if (!sendOrRun(sentence.recordingUri ? "rerecord" : "start")) void start(); }}><MaterialIcons color="#FFFFFF" name="mic" size={23} /><Text style={styles.recordText}>{sentence.recordingUri ? t("replaySentence") : t("startRecording")}</Text></TouchableOpacity>{projectComplete ? <TouchableOpacity disabled={syncClient} style={[styles.completeButton, styles.inlineAction, syncClient && { opacity: 0.55 }]} onPress={() => { if (!sendOrRun("complete")) finishTask(); }}><MaterialIcons color="#FFFFFF" name="check-circle" size={22} /><Text style={styles.recordText}>{t("completeTask")}</Text></TouchableOpacity> : null}</View> : phase === "leading" ? <TouchableOpacity disabled={syncClient} style={[styles.cancelButton, syncClient && { opacity: 0.55 }]} onPress={() => { if (!sendOrRun("cancel")) { cancelPendingOperation(); void stopRecorderSafely(); setPhase("idle"); } }}><Text style={styles.cancelText}>{t("cancelPreparation")}</Text></TouchableOpacity> : phase === "recording" ? <TouchableOpacity disabled={syncClient} style={[styles.stopButton, syncClient && { opacity: 0.55 }]} onPress={() => { if (!sendOrRun("stop")) void finish(); }}><View style={styles.stopSquare} /><Text style={styles.recordText}>{t("stopRecording")}</Text></TouchableOpacity> : <View style={styles.workingButton}><ActivityIndicator color="#FFFFFF" /><Text style={styles.recordText}>{phase === "trailing" ? t("trailingSilence") : t("saving")}</Text></View>}
        </View>
        <Modal animationType="slide" transparent visible={showSentencePicker} onRequestClose={() => setShowSentencePicker(false)}>
          <View style={styles.sentenceModalOverlay}>
            <GlassSurface style={[styles.sentenceModalSheet, glass.sentenceModalSheet]} intensity={40}>
              <View style={[styles.sentenceModalHeader, glass.sentenceModalHeader]}><View><Text style={[styles.sentenceModalTitle, glass.sentenceModalTitle]}>{t("sentenceNumber")}</Text><Text style={[styles.sentenceModalSubtitle, glass.sentenceModalSubtitle]}>{total} {t("sentencesUnit")}</Text></View><TouchableOpacity accessibilityLabel="Close" accessibilityRole="button" onPress={() => setShowSentencePicker(false)} style={[styles.sentenceModalClose, glass.sentenceModalClose]}><MaterialIcons color="#4669DE" name="close" size={22} /></TouchableOpacity></View>
              <FlatList data={project.sentences} keyExtractor={(item) => item.id} contentContainerStyle={styles.sentenceList} renderItem={({ item, index }) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: syncClient, selected: index === currentIndex }} disabled={syncClient} onPress={() => { if (syncHost) { sendCommand("jump", index); setShowSentencePicker(false); } else jumpToSentence(index); }} style={[styles.sentenceListItem, index === currentIndex && styles.sentenceListItemActive, syncClient && styles.toolDisabled]}><View style={[styles.sentenceListNumber, index === currentIndex && styles.sentenceListNumberActive]}><Text style={[styles.sentenceListNumberText, index === currentIndex && styles.sentenceListNumberTextActive]}>{String(index + 1).padStart(3, "0")}</Text></View><Text numberOfLines={1} style={styles.sentenceListText}>{item.rawText || item.tokens.map((token) => token.char).join("")}</Text>{item.recordingUri ? <MaterialIcons color="#1E8B61" name="check-circle" size={20} /> : <MaterialIcons color="#B9C2D5" name="radio-button-unchecked" size={20} />}</TouchableOpacity>} />
            </GlassSurface>
          </View>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

function SyncDeviceDot({ device }: { device: ReturnType<typeof useSyncRoom>["status"]["devices"][number] }) {
  const [showName, setShowName] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const indicator = getSyncDeviceIndicator(device);
  useEffect(() => {
    if (indicator !== "waiting") { pulse.stopAnimation(); pulse.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 0.35, duration: 620, useNativeDriver: true }), Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true })]));
    animation.start();
    return () => animation.stop();
  }, [indicator, pulse]);
  const label = indicator === "recording-screen" ? `${device.name}：已进入录制界面` : indicator === "waiting" ? `${device.name}：在线，等待主控进入同步录制` : `${device.name}：离线，连接已断开`;
  return <View style={styles.syncDotWrap}>{showName ? <View pointerEvents="none" style={styles.syncDotTooltip}><Text numberOfLines={1} style={styles.syncDotTooltipText}>{device.name}</Text></View> : null}<Animated.View style={{ opacity: indicator === "waiting" ? pulse : 1 }}><TouchableOpacity accessibilityHint="点击显示设备名称" accessibilityLabel={label} activeOpacity={0.78} onPress={() => setShowName((value) => !value)} style={[styles.syncDot, indicator === "recording-screen" ? styles.syncDotRecording : indicator === "waiting" ? styles.syncDotWaiting : styles.syncDotOffline]}><Text style={styles.syncDotInitial}>{getSyncDeviceInitial(device.name)}</Text></TouchableOpacity></Animated.View></View>;
}

function formatSeconds(seconds?: number) { const safe = Math.max(0, Math.floor(seconds ?? 0)); return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`; }

const styles = StyleSheet.create({
  page: { flex: 1 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 6 }, iconButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 }, iconButtonDisabled: { backgroundColor: "#F2F4F8", opacity: 0.62 }, headerCenter: { alignItems: "center" }, speaker: { color: "#182033", fontSize: 14, fontWeight: "800" }, position: { color: "#65708A", fontSize: 12, marginTop: 3 }, progressTrack: { backgroundColor: "#E5E9F1", borderRadius: 99, height: 5, marginTop: 13, overflow: "hidden" }, progress: { backgroundColor: "#2F4DA0", borderRadius: 99, height: "100%" }, syncDots: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 28, paddingHorizontal: 3, paddingTop: 9, zIndex: 4 }, syncDotWrap: { minHeight: 24, minWidth: 24, position: "relative" }, syncDot: { alignItems: "center", borderColor: "rgba(255,255,255,0.94)", borderRadius: 12, borderWidth: 1.2, height: 24, justifyContent: "center", shadowColor: "#345284", shadowOpacity: 0.2, shadowRadius: 4, width: 24 }, syncDotRecording: { backgroundColor: "#43B77B" }, syncDotWaiting: { backgroundColor: "#E8B23C" }, syncDotOffline: { backgroundColor: "#D75C67" }, syncDotInitial: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", lineHeight: 13 }, syncDotTooltip: { backgroundColor: "rgba(24,32,51,0.95)", borderRadius: 7, bottom: 29, left: -22, maxWidth: 144, minWidth: 54, paddingHorizontal: 8, paddingVertical: 5, position: "absolute", zIndex: 8 }, syncDotTooltipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" }, promptBox: { alignItems: "flex-start", backgroundColor: "#EEF3FF", borderRadius: 14, marginTop: 5, padding: 12 }, promptLabel: { alignSelf: "flex-start", color: "#65708A", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 }, promptTextWrapper: { alignSelf: "stretch", marginTop: 4, overflow: "hidden", position: "relative" }, promptText: { color: "#30466F", fontSize: 16, fontWeight: "700", lineHeight: 23 }, promptRipple: { backgroundColor: "#FF3045", borderRadius: 99, bottom: 1, position: "absolute", top: 1, width: 138 }, readingCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 20, borderWidth: 1, flex: 1, marginTop: 12, minHeight: 184, padding: 20 }, readingHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", width: "100%" }, readingCaption: { color: "#8A95AA", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 }, fontButton: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 12, height: 32, justifyContent: "center", width: 32 }, fontButtonActive: { backgroundColor: "#2F4DA0" }, fontControl: { alignItems: "center", backgroundColor: "#F6F8FD", borderRadius: 12, flexDirection: "row", marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, width: "100%" }, fontControlLabel: { color: "#65708A", fontSize: 12, fontWeight: "700", marginRight: 4 }, fontSlider: { flex: 1, height: 30 }, fontValue: { color: "#2F4DA0", fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "800", marginLeft: 5, minWidth: 22, textAlign: "right" }, readingTextArea: { alignSelf: "stretch", flex: 1, marginTop: 10, width: "100%" }, readingTextContent: { alignItems: "center", flexGrow: 1, justifyContent: "center", paddingBottom: 4, paddingHorizontal: 2 }, waveformBlock: { marginTop: 9 }, waveformHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }, waveformTitle: { color: "#3F4A62", fontSize: 12, fontWeight: "800" }, waveformTime: { color: "#65708A", fontSize: 12, fontVariant: ["tabular-nums"] }, statusText: { color: "#65708A", fontSize: 12, marginTop: 6, textAlign: "center" }, statusRecording: { color: "#D64646", fontWeight: "800" }, bottomActionArea: { marginTop: "auto", paddingBottom: 4 }, bottomTools: { flexDirection: "row", gap: 9, justifyContent: "space-between" }, tool: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 13, borderWidth: 1, flex: 1, gap: 3, paddingVertical: 8 }, toolDisabled: { backgroundColor: "#F7F8FB", opacity: 0.62 }, toolText: { color: "#2F4DA0", fontSize: 12, fontWeight: "800" }, toolTextDisabled: { color: "#B9C2D5" }, sentencePickerButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 13, borderWidth: 1, flexDirection: "row", marginTop: 9, paddingHorizontal: 10, paddingVertical: 8 }, sentencePickerDisabled: { backgroundColor: "#F7F8FB", opacity: 0.7 }, sentencePickerIcon: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 10, height: 32, justifyContent: "center", width: 32 }, sentencePickerCopy: { flex: 1, marginLeft: 9 }, sentencePickerLabel: { color: "#65708A", fontSize: 11, fontWeight: "700" }, sentencePickerValue: { color: "#182033", fontSize: 14, fontVariant: ["tabular-nums"], fontWeight: "800", marginTop: 1 }, sentenceModalOverlay: { backgroundColor: "rgba(15, 24, 42, 0.42)", flex: 1, justifyContent: "flex-end" }, sentenceModalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "74%", minHeight: 300, paddingBottom: 18 }, sentenceModalHeader: { alignItems: "center", borderBottomColor: "#E9EDF4", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15 }, sentenceModalTitle: { color: "#182033", fontSize: 18, fontWeight: "800" }, sentenceModalSubtitle: { color: "#65708A", fontSize: 12, marginTop: 2 }, sentenceModalClose: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 14, height: 34, justifyContent: "center", width: 34 }, sentenceList: { paddingHorizontal: 16, paddingVertical: 10 }, sentenceListItem: { alignItems: "center", borderColor: "#E9EDF4", borderRadius: 13, borderWidth: 1, flexDirection: "row", marginBottom: 8, padding: 10 }, sentenceListItemActive: { backgroundColor: "#F1F5FF", borderColor: "#2F4DA0" }, sentenceListNumber: { alignItems: "center", backgroundColor: "#F2F4F8", borderRadius: 9, height: 32, justifyContent: "center", width: 44 }, sentenceListNumberActive: { backgroundColor: "#2F4DA0" }, sentenceListNumberText: { color: "#65708A", fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "800" }, sentenceListNumberTextActive: { color: "#FFFFFF" }, sentenceListText: { color: "#3F4A62", flex: 1, fontSize: 14, marginHorizontal: 10 }, idleActionRow: { flexDirection: "row", gap: 9, marginTop: 10 }, inlineAction: { flex: 1, marginTop: 0, paddingHorizontal: 8 }, recordButton: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 17, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 10, paddingVertical: 16 }, rerecordButton: { backgroundColor: "#4963B5" }, stopButton: { alignItems: "center", backgroundColor: "#D64646", borderRadius: 17, flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 10, paddingVertical: 16 }, workingButton: { alignItems: "center", backgroundColor: "#7481A0", borderRadius: 17, flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 10, paddingVertical: 16 }, completeButton: { alignItems: "center", backgroundColor: "#1E8B61", borderRadius: 17, flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 10, paddingVertical: 16 }, cancelButton: { alignItems: "center", backgroundColor: "#EDF0F6", borderRadius: 17, marginTop: 10, paddingVertical: 16 }, cancelText: { color: "#3F4A62", fontSize: 16, fontWeight: "800" }, stopSquare: { backgroundColor: "#FFFFFF", borderRadius: 3, height: 15, width: 15 }, recordText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, missing: { color: "#65708A", fontSize: 16 }, backText: { color: "#2F4DA0", fontWeight: "800", marginTop: 12 },
});

const glass = StyleSheet.create({
  iconButton: { backgroundColor: "rgba(255,255,255,0.58)", borderColor: "rgba(255,255,255,0.88)", borderRadius: 14, borderWidth: 1, elevation: 2, shadowColor: "#5A78B1", shadowOpacity: 0.12, shadowRadius: 10 },
  speaker: { color: "#182B55" }, position: { color: "#64769A" }, progressTrack: { backgroundColor: "rgba(115,142,196,0.2)" }, progress: { backgroundColor: "#4B6FE6" },
  promptBox: { borderRadius: 18, marginTop: 14, padding: 12 }, promptLabel: { color: "#61749E" }, promptText: { color: "#263D70" },
  readingCard: { borderRadius: 24, marginTop: 12, padding: 20 }, fontButton: { backgroundColor: "rgba(225,235,255,0.78)", borderColor: "rgba(255,255,255,0.85)", borderWidth: 1 },
  waveformBlock: { borderRadius: 18, marginTop: 9, padding: 11 }, waveformTitle: { color: "#3B527B" }, waveformTime: { color: "#61749E" },
  tool: { backgroundColor: "rgba(255,255,255,0.52)", borderColor: "rgba(255,255,255,0.86)", borderRadius: 15, elevation: 2, shadowColor: "#5E7BAE", shadowOpacity: 0.09, shadowRadius: 10 }, toolText: { color: "#4669DE" },
  sentencePickerButton: { backgroundColor: "rgba(255,255,255,0.58)", borderColor: "rgba(255,255,255,0.88)", borderRadius: 16, elevation: 2, shadowColor: "#5E7BAE", shadowOpacity: 0.1, shadowRadius: 10 }, sentencePickerIcon: { backgroundColor: "rgba(222,234,255,0.84)" }, sentencePickerLabel: { color: "#61749E" }, sentencePickerValue: { color: "#182B55" },
  sentenceModalSheet: { backgroundColor: "rgba(247,251,255,0.8)", borderColor: "rgba(255,255,255,0.94)", borderWidth: 1 }, sentenceModalHeader: { borderBottomColor: "rgba(116,143,193,0.16)" }, sentenceModalTitle: { color: "#182B55" }, sentenceModalSubtitle: { color: "#61749E" }, sentenceModalClose: { backgroundColor: "rgba(222,234,255,0.78)", borderColor: "rgba(255,255,255,0.88)", borderWidth: 1 },
});
