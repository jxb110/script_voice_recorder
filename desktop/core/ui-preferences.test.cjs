const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeDesktopUiPreferences } = require("./ui-preferences.cjs");

test("桌面端界面偏好将字号和三个可拖拽面板高度限制在安全范围", () => {
  const preferences = normalizeDesktopUiPreferences({ readingFontSize: 64, panelHeights: { prompt: 20, reading: 205, wave: 999 } });
  assert.equal(preferences.readingFontSize, 50);
  assert.deepEqual(preferences.panelHeights, { prompt: 68, reading: 205, wave: 500 });
});
