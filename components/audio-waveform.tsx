import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";

import { classifyWaveformSample, resampleWaveform, waveformDisplayStrength } from "@/lib/waveform-math";

type AudioWaveformProps = {
  samples: number[];
  progress?: number;
  recording?: boolean;
  height?: number;
};

const BAR_COUNT = 86;

export function AudioWaveform({ samples, progress = 0, recording = false, height = 52 }: AudioWaveformProps) {
  const bars = useMemo(() => resampleWaveform(samples, BAR_COUNT), [samples]);
  const playedLimit = Math.round(Math.max(0, Math.min(1, progress)) * BAR_COUNT);
  const width = 360;
  const center = height / 2;
  const step = width / BAR_COUNT;

  return (
    <View style={[styles.container, recording && styles.recordingContainer]} accessibilityLabel={recording ? "完整录制音频波形" : "完整播放音频波形"}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Rect x="0" y="0" width={width} height={height} fill={recording ? "#FFF9FA" : "#FAFBFD"} />
        <Line x1="0" y1={center} x2={width} y2={center} stroke="#D7DEEA" strokeDasharray="2 3" strokeWidth="1" />
        {bars.map((sample, index) => {
          const kind = classifyWaveformSample(sample);
          const amplitude = kind === "silence" ? 1.25 : 3.5 + waveformDisplayStrength(sample) * (height * 0.36);
          const x = index * step + step / 2;
          const color = kind === "silence" ? recording ? "#E7BEC5" : "#D4DCE9" : recording ? "#D64646" : index < playedLimit ? "#2F4DA0" : "#7585A5";
          return <Line key={index} x1={x} y1={center - amplitude} x2={x} y2={center + amplitude} stroke={color} strokeWidth={Math.max(1.8, step * 0.52)} strokeLinecap="round" />;
        })}
        {!recording && progress > 0 ? <Line x1={Math.max(2, Math.min(width - 2, width * progress))} y1="8" x2={Math.max(2, Math.min(width - 2, width * progress))} y2={height - 8} stroke="#2F4DA0" strokeWidth="1.5" /> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch", backgroundColor: "#FAFBFD", borderColor: "#E4E9F1", borderRadius: 10, borderWidth: 1, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 4 },
  recordingContainer: { backgroundColor: "#FFF9FA", borderColor: "#EFD8DC" },
});
