export function canContinueRecordingSession(startedToken: number, currentToken: number, closing: boolean) {
  return !closing && startedToken === currentToken;
}

export function isProjectRecordingComplete(recordingUris: Array<string | undefined>) {
  return recordingUris.length > 0 && recordingUris.every(Boolean);
}

export function isLiveWaveformPhase(phase: "idle" | "leading" | "recording" | "trailing" | "saving") {
  return phase === "leading" || phase === "recording" || phase === "trailing";
}
