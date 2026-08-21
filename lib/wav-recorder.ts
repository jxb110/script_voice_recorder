import { Platform } from "react-native";

import type { RecorderSettings } from "@/shared/recorder-types";

type AudioApiModule = typeof import("react-native-audio-api");
type AudioRecorderInstance = InstanceType<AudioApiModule["AudioRecorder"]>;

let audioApi: AudioApiModule | null = null;
let recorder: AudioRecorderInstance | null = null;

function getAudioApi() {
  if (Platform.OS === "web") throw new Error("WAV 录音需要使用重新构建后的 Android 应用。网页预览不支持原生 WAV 录音。");
  if (!audioApi) audioApi = require("react-native-audio-api") as AudioApiModule;
  return audioApi;
}

function getRecorder() {
  if (!recorder) {
    const { AudioRecorder } = getAudioApi();
    recorder = new AudioRecorder();
  }
  return recorder;
}

function getBitDepth(bitDepth: RecorderSettings["bitDepth"]) {
  const { BitDepth } = getAudioApi();
  return bitDepth === 32 ? BitDepth.Bit32 : BitDepth.Bit16;
}

function toFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function dbFromBuffer(samples: Float32Array) {
  if (!samples.length) return -80;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
  return 20 * Math.log10(Math.max(Math.sqrt(sum / samples.length), 0.00001));
}

export async function startWavRecording(settings: RecorderSettings, onMetering: (db: number) => void) {
  const { AudioManager, FileDirectory, FileFormat, FlacCompressionLevel, IOSAudioQuality } = getAudioApi();
  const permission = await AudioManager.requestRecordingPermissions();
  if (permission !== "Granted") throw new Error("请在系统设置中允许麦克风权限后再录制。");
  AudioManager.setAudioSessionOptions({ iosCategory: "record", iosMode: "measurement" });
  const active = getRecorder();
  active.clearOnAudioReady();
  const output = active.enableFileOutput({
    channelCount: settings.channels,
    directory: FileDirectory.Cache,
    fileNamePrefix: "script_voice",
    format: FileFormat.Wav,
    preset: {
      bitRate: 320000,
      sampleRate: settings.sampleRate,
      bitDepth: getBitDepth(settings.bitDepth),
      iosQuality: IOSAudioQuality.High,
      flacCompressionLevel: FlacCompressionLevel.L0,
    },
  });
  if (output.status === "error") throw new Error(output.message);
  const meter = active.onAudioReady({ sampleRate: settings.sampleRate, bufferLength: Math.max(512, Math.floor(settings.sampleRate / 12)), channelCount: settings.channels }, ({ buffer }) => {
    onMetering(dbFromBuffer(buffer.getChannelData(0)));
  });
  if (meter.status === "error") throw new Error(meter.message);
  const sessionActive = await AudioManager.setAudioSessionActivity(true);
  if (!sessionActive) throw new Error("无法启用麦克风录音会话。");
  const started = active.start();
  if (started.status === "error") throw new Error(started.message);
}

export async function stopWavRecording() {
  if (!recorder || !recorder.isRecording()) return undefined;
  const { AudioManager } = getAudioApi();
  const result = recorder.stop();
  recorder.clearOnAudioReady();
  await AudioManager.setAudioSessionActivity(false);
  if (result.status === "error") throw new Error(result.message);
  const path = result.paths[0];
  return path ? toFileUri(path) : undefined;
}

export async function cancelWavRecording() {
  try { await stopWavRecording(); }
  catch { /* cancellation must never block navigation */ }
}
