export function resolveLiquidSliderValue(position: number, width: number, minimum: number, maximum: number, step = 1) {
  const progress = Math.max(0, Math.min(1, position / Math.max(1, width)));
  const raw = minimum + (maximum - minimum) * progress;
  const rounded = minimum + Math.round((raw - minimum) / Math.max(step, 0.0001)) * step;
  return Math.max(minimum, Math.min(maximum, Number(rounded.toFixed(4))));
}

export function resolveLiquidSliderDragValue(startValue: number, deltaX: number, width: number, minimum: number, maximum: number, step = 1) {
  const safeWidth = Math.max(1, width);
  const startProgress = Math.max(0, Math.min(1, (startValue - minimum) / Math.max(0.0001, maximum - minimum)));
  return resolveLiquidSliderValue(startProgress * safeWidth + deltaX, safeWidth, minimum, maximum, step);
}
