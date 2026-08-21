const MINIMUM_SAMPLE = 0.025;
export const MAX_WAVEFORM_SAMPLES = 720;

export function normalizeMetering(level?: number) {
  if (typeof level !== "number" || !Number.isFinite(level)) return null;
  if (level > 0 && level <= 1) return Math.max(MINIMUM_SAMPLE, level);
  return Math.min(1, Math.max(MINIMUM_SAMPLE, (level + 70) / 70));
}

export function appendWaveformSample(samples: number[], level?: number, maximum = MAX_WAVEFORM_SAMPLES) {
  const normalized = normalizeMetering(level);
  if (normalized === null) return samples;
  const previous = samples.at(-1) ?? MINIMUM_SAMPLE;
  const next = [...samples, previous * 0.3 + normalized * 0.7];
  if (next.length <= maximum) return next;
  return next.reduce<number[]>((result, value, index) => {
    if (index % 2 === 0) result.push(value);
    else result[result.length - 1] = (result[result.length - 1] + value) / 2;
    return result;
  }, []);
}

export function resampleWaveform(samples: number[], count: number): number[] {
  if (!samples.length) return Array.from({ length: count }, () => MINIMUM_SAMPLE);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index / count) * samples.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * samples.length));
    return Math.max(MINIMUM_SAMPLE, ...samples.slice(start, end));
  });
}
