import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { ClipPath, Defs, G, Line, Rect } from "react-native-svg";

import { classifyWaveformSample, resampleWaveform, waveformBarHalfHeight } from "@/lib/waveform-math";

type AudioWaveformProps = {
  samples: number[];
  progress?: number;
  recording?: boolean;
  height?: number;
};

const BAR_COUNT = 68;

export function AudioWaveform({ samples, progress = 0, recording = false, height = 58 }: AudioWaveformProps) {
  const bars = useMemo(() => resampleWaveform(samples, BAR_COUNT), [samples]);
  const playedLimit = Math.round(Math.max(0, Math.min(1, progress)) * BAR_COUNT);
  const width = 360;
  const center = height / 2;
  const step = width / BAR_COUNT;
  const barWidth = Math.max(1.5, Math.min(2.8, step * 0.38));
  const clipId = recording ? "recording-wave-clip" : "playback-wave-clip";

  return (
    <View style={[styles.container, recording && styles.recordingContainer]} accessibilityLabel={recording ? "完整录制音频波形" : "完整播放音频波形"}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Rect x="0" y="0" width={width} height={height} fill={recording ? "#FFF9FA" : "#FAFBFD"} />
        <Defs><ClipPath id={clipId}><Rect x="2" y="2" width={width - 4} height={height - 4} /></ClipPath></Defs>
        <G clipPath={`url(#${clipId})`}>
          <Line x1="8" y1={center} x2={width - 8} y2={center} stroke={recording ? "#F0D7DB" : "#E1E7F0"} strokeDasharray="2 4" strokeWidth="1" />
          {bars.map((sample, index) => {
            const kind = classifyWaveformSample(sample);
            const halfHeight = waveformBarHalfHeight(sample, height);
            const x = index * step + (step - barWidth) / 2;
            const color = kind === "silence" ? recording ? "#E9BFC7" : "#D5DDEA" : recording ? "#E14A5A" : index < playedLimit ? "#3158B8" : "#8796B3";
            const opacity = kind === "silence" ? 0.72 : Math.min(1, 0.72 + sample * 0.28);
            return <Rect key={index} x={x} y={center - halfHeight} width={barWidth} height={halfHeight * 2} rx={barWidth / 2} fill={color} stroke={kind === "silence" ? "transparent" : recording ? "#B93445" : index < playedLimit ? "#1E438F" : "#657796"} strokeWidth={0.28} opacity={opacity} />;
          })}
          {recording ? <Rect x={width - 3} y="8" width="2" height={height - 16} rx="1" fill="#E14A5A" opacity="0.9" /> : null}
          {!recording && progress > 0 ? <Line x1={Math.max(4, Math.min(width - 4, width * progress))} y1="7" x2={Math.max(4, Math.min(width - 4, width * progress))} y2={height - 7} stroke="#3158B8" strokeWidth="1.5" /> : null}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch", backgroundColor: "#FAFBFD", borderColor: "#E4E9F1", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  recordingContainer: { backgroundColor: "#FFF9FA", borderColor: "#EFD8DC" },
});
