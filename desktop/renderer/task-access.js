(function exposeTaskAccess(global) {
  function resolveTaskEditState({ recordingCount = 0, syncMode = "idle" } = {}) {
    const lockedByRecording = Number(recordingCount) > 0;
    const lockedByClientSync = syncMode === "client";
    const disabled = lockedByRecording || lockedByClientSync;
    return {
      disabled,
      lockedByRecording,
      lockedByClientSync,
      hostDisabled: lockedByClientSync,
    };
  }

  function shouldShowRecordedStatus({ recordingCount = 0 } = {}) {
    return Number(recordingCount) > 0;
  }

  const api = { resolveTaskEditState, shouldShowRecordedStatus };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.DesktopTaskAccess = api;
})(typeof window === "undefined" ? globalThis : window);
