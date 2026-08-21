const MINIMUM_SAMPLE = 0.025;

export function normalizeMetering(level?: number) {
  if (typeof level !== "number" || !Number.isFinite(level)) return null;
  if (level > 0 && level <= 1) return Math.max(MINIMUM_SAMPLE, level);
  return Math.min(1, Math.max(MINIMUM_SAMPLE, (level + 70) / 70));
}

export function appendWaveformSample(samples: number[], level?: number, size = 46) {
  const normalized = normalizeMetering(level);
  if (normalized === null) return samples;
  const previous = samples.at(-1) ?? MINIMUM_SAMPLE;
  const smoothed = previous * 0.3 + normalized * 0.7;
  return [...samples.slice(-(size - 1)), smoothed];
}
