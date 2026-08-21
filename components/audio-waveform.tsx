import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { resampleWaveform } from "@/lib/waveform-math";

type AudioWaveformProps = {
  samples: number[];
  progress?: number;
  recording?: boolean;
  height?: number;
};

const BAR_COUNT = 78;

export function AudioWaveform({ samples, progress = 0, recording = false, height = 112 }: AudioWaveformProps) {
  const bars = useMemo(() => resampleWaveform(samples, BAR_COUNT), [samples]);
  const playedLimit = Math.round(Math.max(0, Math.min(1, progress)) * BAR_COUNT);
  const width = 360;
  const center = height / 2;
  const step = width / BAR_COUNT;

  return (
    <View style={[styles.container, recording && styles.recordingContainer]} accessibilityLabel={recording ? "完整录制音频波形" : "完整播放音频波形"}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Line x1="0" y1={center} x2={width} y2={center} stroke="#E1E5EE" strokeWidth="1" />
        {bars.map((sample, index) => {
          const amplitude = 6 + sample * (height * 0.42);
          const x = index * step + step / 2;
          const color = recording ? "#D64646" : index < playedLimit ? "#2F4DA0" : "#AEB8CD";
          return <Line key={index} x1={x} y1={center - amplitude} x2={x} y2={center + amplitude} stroke={color} strokeWidth={Math.max(1.5, step * 0.48)} strokeLinecap="round" />;
        })}
        {!recording && progress > 0 ? <Line x1={Math.max(2, Math.min(width - 2, width * progress))} y1="8" x2={Math.max(2, Math.min(width - 2, width * progress))} y2={height - 8} stroke="#2F4DA0" strokeWidth="1.5" /> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch", backgroundColor: "#F6F8FC", borderColor: "#E5EAF3", borderRadius: 16, borderWidth: 1, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 7 },
  recordingContainer: { backgroundColor: "#FFF6F6", borderColor: "#F3D1D5" },
});
