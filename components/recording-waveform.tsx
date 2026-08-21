import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { appendWaveformSample } from "@/lib/waveform-math";

const SAMPLE_COUNT = 46;
const DEFAULT_SAMPLES = Array.from({ length: SAMPLE_COUNT }, () => 0.025);

export function RecordingWaveform({ level, active }: { level?: number; active: boolean }) {
  const [samples, setSamples] = useState(DEFAULT_SAMPLES);
  const isWebMeteringUnavailable = active && Platform.OS === "web" && typeof level !== "number";

  useEffect(() => {
    if (!active) { setSamples(DEFAULT_SAMPLES); return; }
    setSamples((current) => appendWaveformSample(current, level, SAMPLE_COUNT));
  }, [active, level]);

  const path = useMemo(() => {
    const width = 320;
    const midline = 30;
    const step = width / (samples.length - 1);
    return samples.reduce((drawing, sample, index) => {
      const x = index * step;
      const y = midline - sample * 25;
      if (index === 0) return `M ${x} ${y}`;
      const previousX = (index - 1) * step;
      const previousY = midline - samples[index - 1] * 25;
      return `${drawing} Q ${previousX + step / 2} ${previousY}, ${x} ${y}`;
    }, "");
  }, [samples]);

  return (
    <View style={[styles.container, active && styles.containerActive]} accessibilityLabel={isWebMeteringUnavailable ? "网页预览不提供实时麦克风波形" : active ? "正在绘制连续录音波形" : "录音波形等待中"}>
      <Svg width="100%" height={60} viewBox="0 0 320 60" preserveAspectRatio="none">
        <Line x1="0" y1="30" x2="320" y2="30" stroke="#D9DFEC" strokeWidth="1" strokeDasharray="3 5" />
        <Path d={path} fill="none" stroke={active ? "#D64646" : "#9EABC3"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      {isWebMeteringUnavailable ? <View style={styles.webHint}><Text style={styles.webHintText}>网页预览不支持实时麦克风波形，请在 Android 设备录制时查看</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch", backgroundColor: "#F7F8FC", borderRadius: 12, height: 60, justifyContent: "center", overflow: "hidden", paddingHorizontal: 5 },
  containerActive: { backgroundColor: "#FFF4F4" },
  webHint: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.88)", bottom: 0, justifyContent: "center", left: 0, paddingHorizontal: 12, position: "absolute", right: 0, top: 0 },
  webHintText: { color: "#68758D", fontSize: 11, lineHeight: 16, textAlign: "center" },
});
