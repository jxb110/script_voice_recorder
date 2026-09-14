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

  function resolveSyncControlState({ mode = "idle", recordingActive = false, onlineClientCount = 0 } = {}) {
    const syncRecordingLocked = Boolean(recordingActive);
    const isClient = mode === "client";
    const isHost = mode === "host";
    return {
      hostDisabled: isClient || syncRecordingLocked,
      joinDisabled: syncRecordingLocked,
      enterDisabled: !isHost || Number(onlineClientCount) < 1 || syncRecordingLocked,
      inputsDisabled: syncRecordingLocked,
      closeDisabled: false,
    };
  }

  const api = { resolveTaskEditState, shouldShowRecordedStatus, resolveSyncControlState };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.DesktopTaskAccess = api;
})(typeof window === "undefined" ? globalThis : window);
