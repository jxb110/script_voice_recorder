const MINIMUM_SAMPLE = 0.025;
export const MAX_WAVEFORM_SAMPLES = 720;
export const WAVEFORM_SILENCE_THRESHOLD = 0.2;

export type WaveformSegmentKind = "silence" | "voice";

export function normalizeMetering(level?: number) {
  if (typeof level !== "number" || !Number.isFinite(level)) return null;
  if (level > 0 && level <= 1) return Math.max(MINIMUM_SAMPLE, level);
  return Math.min(1, Math.max(MINIMUM_SAMPLE, (level + 70) / 70));
}

export function classifyWaveformSample(sample: number): WaveformSegmentKind {
  return sample <= WAVEFORM_SILENCE_THRESHOLD ? "silence" : "voice";
}

export function waveformDisplayStrength(sample: number) {
  if (classifyWaveformSample(sample) === "silence") return 0;
  const activeRange = (sample - WAVEFORM_SILENCE_THRESHOLD) / (1 - WAVEFORM_SILENCE_THRESHOLD);
  return Math.pow(Math.min(1, Math.max(0, activeRange)), 0.58);
}

/** Returns a symmetric half-bar height that always remains inside the waveform drawing bounds. */
export function waveformBarHalfHeight(sample: number, totalHeight: number, edgeInset = 5) {
  const safeHalfHeight = Math.max(1, totalHeight / 2 - Math.max(0, edgeInset));
  if (classifyWaveformSample(sample) === "silence") return Math.min(safeHalfHeight, 1.2);
  const rawHeight = 2.6 + waveformDisplayStrength(sample) * safeHalfHeight * 0.94;
  return Math.min(safeHalfHeight, Math.max(1.7, rawHeight));
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
