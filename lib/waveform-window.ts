export const WAVEFORM_WINDOW_MS = 120;

export function waveformBufferLength(sampleRate: number) {
  return Math.max(512, Math.floor(sampleRate * WAVEFORM_WINDOW_MS / 1000));
}

export function peakDbFromSamples(samples: Float32Array) {
  if (!samples.length) return -80;
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) peak = Math.max(peak, Math.abs(samples[index]));
  return 20 * Math.log10(Math.max(peak, 0.00001));
}
