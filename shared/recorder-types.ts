export type Gender = "女" | "男" | "其他";

export type Speaker = { id: string; name: string; gender: Gender; age: number; createdAt: string };
export type ScriptToken = { char: string; pinyin?: string };
export type ScriptSentence = { id: string; index: number; prompt: string; rawText: string; tokens: ScriptToken[]; recordingUri?: string; publicUri?: string; recordedAt?: string; waveform?: number[] };
export type ScriptProject = { id: string; name: string; sourceFileName: string; sourceFileUri?: string; speakerId: string; sentences: ScriptSentence[]; createdAt: string; updatedAt: string };
export type RecorderSettings = { sampleRate: number; bitDepth: 16 | 32; channels: 1 | 2; leadingSilenceMs: number; trailingSilenceMs: number; readingFontSize: number };
export type RecorderStore = { speakers: Speaker[]; projects: ScriptProject[]; settings: RecorderSettings };
export const DEFAULT_RECORDER_SETTINGS: RecorderSettings = { sampleRate: 48000, bitDepth: 16, channels: 1, leadingSilenceMs: 500, trailingSilenceMs: 500, readingFontSize: 20 };
