import type { ScriptProject, ScriptSentence } from "@/shared/recorder-types";

export function hasRecordingProgress(sentences: ScriptSentence[]) {
  return sentences.some((sentence) => Boolean(sentence.recordingUri));
}

export function canReplaceProjectScript(project: Pick<ScriptProject, "sentences">) {
  return !hasRecordingProgress(project.sentences);
}
