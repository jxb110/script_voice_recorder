(function exposeDesktopMultiMicrophone(global) {
  const MAX_MICROPHONES = 8;

  function normalizeMicrophoneIds(value) {
    const source = Array.isArray(value) ? value : value ? [value] : [];
    return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, MAX_MICROPHONES);
  }

  function resolveMicrophoneRecordingPlan({ channelMode = "single", microphoneIds = [] } = {}) {
    const ids = normalizeMicrophoneIds(microphoneIds);
    const normalizedMode = channelMode === "multi" ? "multi" : "single";
    const isMultiChannel = normalizedMode === "multi" && ids.length > 1;
    return { microphoneIds: ids, channelMode: normalizedMode, channelCount: isMultiChannel ? ids.length : 1, isMultiChannel, mixesInputs: !isMultiChannel && ids.length > 1 };
  }

  const api = { MAX_MICROPHONES, normalizeMicrophoneIds, resolveMicrophoneRecordingPlan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.DesktopMultiMicrophone = api;
})(typeof window === "undefined" ? globalThis : window);
