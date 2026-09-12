const MINIMUM_SAMPLE = 0.025;
export const MAX_WAVEFORM_SAMPLES = 720;
export const WAVEFORM_SILENCE_THRESHOLD = 0.32;

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
  return Math.pow(Math.min(1, Math.max(0, activeRange)), 1.15);
}

/** Returns a symmetric half-bar height that always remains inside the waveform drawing bounds. */
export function waveformBarHalfHeight(sample: number, totalHeight: number, edgeInset = 5) {
  const safeHalfHeight = Math.max(1, totalHeight / 2 - Math.max(0, edgeInset));
  if (classifyWaveformSample(sample) === "silence") return Math.min(safeHalfHeight, 0.75);
  const rawHeight = 1.8 + waveformDisplayStrength(sample) * safeHalfHeight * 0.94;
  return Math.min(safeHalfHeight, Math.max(1.2, rawHeight));
}

export function appendWaveformSample(samples: number[], level?: number, maximum = MAX_WAVEFORM_SAMPLES) {
  const normalized = normalizeMetering(level);
  if (normalized === null) return samples;
  const next = [...samples, normalized];
  if (next.length <= maximum) return next;
  return next.reduce<number[]>((result, value, index) => {
    if (index % 2 === 0) result.push(value);
    else result[result.length - 1] = Math.max(result[result.length - 1], value);
    return result;
  }, []);
}

export function resampleWaveform(samples: number[], count: number): number[] {
  if (!samples.length) return Array.from({ length: count }, () => MINIMUM_SAMPLE);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index / count) * samples.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * samples.length));
    let peak = MINIMUM_SAMPLE;
    for (let cursor = start; cursor < end; cursor += 1) peak = Math.max(peak, samples[cursor] ?? MINIMUM_SAMPLE);
    return Math.max(MINIMUM_SAMPLE, Math.min(1, peak));
  });
}

export type SymmetricWaveformOptions = {
  maximumHeightRatio?: number;
  maximumPoints?: number;
  progressive?: boolean;
  sampleWidth?: number;
};

/** Builds the top, bottom and filled SVG paths for the mobile high-slim symmetric waveform. */
export function createSymmetricWaveformPaths(samples: number[], width: number, height: number, options: SymmetricWaveformOptions = {}) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const center = safeHeight / 2;
  const maximumPoints = Math.max(1, Math.floor(options.maximumPoints ?? safeWidth));
  const progressive = options.progressive ?? false;
  const sampleWidth = Math.max(0.8, options.sampleWidth ?? 2.1);
  const maximumHeightRatio = Math.min(0.5, Math.max(0.05, options.maximumHeightRatio ?? 0.48));
  if (!samples.length) return { drawWidth: 0, fillPath: "", lowerPath: "", maxHeight: safeHeight * maximumHeightRatio, pointCount: 0, upperPath: "" };
  const pointCount = Math.max(1, Math.min(maximumPoints, samples.length));
  const values = resampleWaveform(samples, pointCount);
  const drawWidth = progressive ? Math.min(safeWidth, pointCount * sampleWidth) : safeWidth;
  const maxHeight = safeHeight * maximumHeightRatio;
  const points = values.map((sample, index) => ({
    amplitude: Math.max(0.015, Math.min(1, sample)),
    x: index * (drawWidth / values.length),
  }));
  const upperPath = `M 0 ${center} ${points.map((point) => `L ${point.x} ${center - point.amplitude * maxHeight}`).join(" ")} L ${drawWidth} ${center}`;
  const lowerPath = `M ${drawWidth} ${center} ${points.slice().reverse().map((point) => `L ${point.x} ${center + point.amplitude * maxHeight}`).join(" ")} L 0 ${center}`;
  return { drawWidth, upperPath, lowerPath, fillPath: `${upperPath} Z ${lowerPath} Z`, pointCount: points.length, maxHeight };
}
