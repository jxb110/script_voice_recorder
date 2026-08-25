export const READING_FONT_SIZE = {
  defaultValue: 20,
  maximumValue: 50,
  minimumValue: 15,
  step: 1,
} as const;

export function clampReadingFontSize(value: number) {
  return Math.min(READING_FONT_SIZE.maximumValue, Math.max(READING_FONT_SIZE.minimumValue, Math.round(value)));
}

export function pinyinFontSizeForReadingFont(value: number) {
  return Math.max(11, Math.round(clampReadingFontSize(value) * 0.45));
}
