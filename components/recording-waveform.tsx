import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

const SAMPLE_COUNT = 46;
const DEFAULT_SAMPLES = Array.from({ length: SAMPLE_COUNT }, (_, index) => 0.07 + Math.abs(Math.sin(index * 0.42)) * 0.06);

function normalizeDecibels(level?: number) {
  return Math.min(1, Math.max(0.04, ((level ?? -60) + 60) / 60));
}

export function RecordingWaveform({ level, active }: { level?: number; active: boolean }) {
  const [samples, setSamples] = useState(DEFAULT_SAMPLES);
  useEffect(() => {
    if (!active) {
      setSamples(DEFAULT_SAMPLES);
      return;
    }
    const sample = normalizeDecibels(level);
    setSamples((current) => [...current.slice(-(SAMPLE_COUNT - 1)), sample]);
  }, [active, level]);

  const path = useMemo(() => {
    const width = 320;
    const midline = 30;
    const step = width / (samples.length - 1);
    return samples.reduce((drawing, sample, index) => {
      const x = index * step;
      const y = midline - sample * 24;
      if (index === 0) return `M ${x} ${y}`;
      const previousX = (index - 1) * step;
      const previousY = midline - samples[index - 1] * 24;
      const controlX = previousX + step / 2;
      return `${drawing} Q ${controlX} ${previousY}, ${x} ${y}`;
    }, "");
  }, [samples]);

  return (
    <View style={[styles.container, active && styles.containerActive]} accessibilityLabel={active ? "正在绘制连续录音波形" : "录音波形等待中"}>
      <Svg width="100%" height={60} viewBox="0 0 320 60" preserveAspectRatio="none">
        <Line x1="0" y1="30" x2="320" y2="30" stroke="#D9DFEC" strokeWidth="1" strokeDasharray="3 5" />
        <Path d={path} fill="none" stroke={active ? "#D64646" : "#9EABC3"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch", backgroundColor: "#F7F8FC", borderRadius: 12, height: 60, justifyContent: "center", overflow: "hidden", paddingHorizontal: 5 },
  containerActive: { backgroundColor: "#FFF4F4" },
});
