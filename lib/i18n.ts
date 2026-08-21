import { useLocales } from "expo-localization";

export const translations = {
  zh: {
    tasks: "任务", scripts: "脚本", settings: "设置", newTask: "新建录音任务", startRecording: "开始录制", stopRecording: "停止录制", replaySentence: "重新录制本句", play: "播放", pause: "暂停", previous: "上一句", next: "下一句", jump: "跳转", prompt: "提示词", readingText: "朗读文本", recorded: "本句已录制，可播放或重新录制", ready: "准备好后开始录制", recording: "正在录制，请朗读下方文本", leadingSilence: "首端静音中，请保持安静", trailingSilence: "尾端静音中，请保持安静", saving: "正在归档录音文件", selectSpeaker: "请选择发音人", importScript: "导入 TXT 脚本", chooseScript: "选择一个 TXT 脚本", scriptChoice: "已选择脚本", selectOneScript: "请选择一个脚本创建任务", language: "中文", localVoice: "本地语音采集", appSubtitle: "导入文本，逐句完成高质量录音", recordingTasks: "录音任务", recordedSentences: "已录句子", speakers: "发音人", selectSpeakerAndImport: "选择发音人并导入文本脚本", recentTasks: "最近任务", allTasks: "全部任务", startFirstScript: "从第一个脚本开始", loadingLocalData: "正在载入本地数据", localStorageHint: "创建任务后，系统会将脚本和录音按发音人分类保存在设备本地。", sentencesUnit: "句", taskName: "任务名称", taskNamePlaceholder: "例如：普通话采音 A 组", speakerAttached: "请选择要绑定到任务的发音人。", importFailed: "导入失败", chooseDirectory: "从目录读取 TXT 脚本（Android）", selectTxtDirectory: "请选择包含 TXT 脚本文件的目录。", importedScripts: "已导入脚本", lineFormat: "每一行都是一个 JSON 字元数组", sentenceCount: "句", backTasks: "返回任务", unableOpenSentence: "无法打开该录音句子。", microphonePermission: "需要麦克风权限", microphonePermissionHint: "请在系统设置中允许麦克风权限后再开始录制。", unableStart: "无法开始录制", unableSave: "保存录音失败", invalidSentence: "句号无效", enterSentence: "请输入 1 到 {count} 之间的句号。", cancelPreparation: "取消准备", sentenceNumber: "句号",
  },
  en: {
    tasks: "Tasks", scripts: "Scripts", settings: "Settings", newTask: "New recording task", startRecording: "Start recording", stopRecording: "Stop recording", replaySentence: "Re-record sentence", play: "Play", pause: "Pause", previous: "Previous", next: "Next", jump: "Go", prompt: "Prompt", readingText: "Reading text", recorded: "This sentence is recorded. You can play or re-record it.", ready: "Ready to record", recording: "Recording. Please read the text below.", leadingSilence: "Leading silence. Please stay quiet.", trailingSilence: "Trailing silence. Please stay quiet.", saving: "Saving audio file", selectSpeaker: "Select a speaker", importScript: "Import TXT script", chooseScript: "Choose a TXT script", scriptChoice: "Selected script", selectOneScript: "Choose one script to create a task", language: "English", localVoice: "Local voice capture", appSubtitle: "Import a script and record one sentence at a time.", recordingTasks: "Recording tasks", recordedSentences: "Recorded lines", speakers: "Speakers", selectSpeakerAndImport: "Select a speaker and import a TXT script", recentTasks: "Recent tasks", allTasks: "All tasks", startFirstScript: "Start with your first script", loadingLocalData: "Loading local data", localStorageHint: "Scripts and recordings are kept locally and grouped by speaker.", sentencesUnit: "lines", taskName: "Task name", taskNamePlaceholder: "e.g. Mandarin recording group A", speakerAttached: "Select the speaker whose information should be attached to this task.", importFailed: "Import failed", chooseDirectory: "Read TXT scripts from directory (Android)", selectTxtDirectory: "Choose a directory containing TXT scripts.", importedScripts: "TXT script(s) imported", lineFormat: "Each line is one JSON character array", sentenceCount: "sentences", backTasks: "Back to tasks", unableOpenSentence: "Unable to open this recording sentence.", microphonePermission: "Microphone permission", microphonePermissionHint: "Allow microphone access in system settings before recording.", unableStart: "Unable to start recording", unableSave: "Unable to save recording", invalidSentence: "Invalid sentence", enterSentence: "Enter a number between 1 and {count}.", cancelPreparation: "Cancel preparation", sentenceNumber: "Sentence #",
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;
export type AppLanguage = keyof typeof translations;

export function languageFromCode(code?: string | null): AppLanguage {
  return code?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function useAppLanguage() {
  const locales = useLocales();
  const language = languageFromCode(locales[0]?.languageCode ?? locales[0]?.languageTag);
  return { language, t: (key: TranslationKey) => translations[language][key] };
}
