const DEFAULT_DESKTOP_UI = Object.freeze({ readingFontSize: 20, sidebarWidth: 340, language: "zh", panelHeights: Object.freeze({ prompt: 68, reading: 180, wave: 176 }) });

function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Math.round(Number(value) || minimum))); }

function normalizeDesktopUiPreferences(value) {
  const panels = value?.panelHeights || {};
  return {
    readingFontSize: clamp(value?.readingFontSize, 15, 50),
    sidebarWidth: clamp(value?.sidebarWidth, 270, 560),
    language: value?.language === "en" ? "en" : "zh",
    panelHeights: {
      prompt: clamp(panels.prompt, 68, 220),
      reading: clamp(panels.reading, 116, 440),
      wave: clamp(panels.wave, 120, 500),
    },
  };
}

module.exports = { DEFAULT_DESKTOP_UI, normalizeDesktopUiPreferences };
