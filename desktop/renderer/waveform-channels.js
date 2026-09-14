(function exposeWaveformChannels(global) {
  function normalizeWaveformChannelCount(value) {
    return Math.max(1, Math.min(8, Math.round(Number(value) || 1)));
  }

  function createWaveChannels(channelCount) {
    return Array.from({ length: normalizeWaveformChannelCount(channelCount) }, () => []);
  }

  function createWaveLaneLayout(height, channelCount, amplitudeRatio = 0.42) {
    const count = normalizeWaveformChannelCount(channelCount);
    const laneHeight = Math.max(1, Number(height) / count);
    return Array.from({ length: count }, (_, index) => ({ top: index * laneHeight, height: laneHeight, center: index * laneHeight + laneHeight / 2, maxAmplitude: laneHeight * amplitudeRatio }));
  }

  const api = { normalizeWaveformChannelCount, createWaveChannels, createWaveLaneLayout };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.DesktopWaveformChannels = api;
})(typeof window === "undefined" ? globalThis : window);
