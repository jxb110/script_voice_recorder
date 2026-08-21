export function canContinueRecordingSession(startedToken: number, currentToken: number, closing: boolean) {
  return !closing && startedToken === currentToken;
}

export function isProjectRecordingComplete(recordingUris: Array<string | undefined>) {
  return recordingUris.length > 0 && recordingUris.every(Boolean);
}
