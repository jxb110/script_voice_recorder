import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from "react-native-svg";

import { createSymmetricWaveformPaths } from "@/lib/waveform-math";

type AudioWaveformProps = {
  samples: number[];
  progress?: number;
  recording?: boolean;
  height?: number;
};

const WAVE_VIEW_WIDTH = 360;

export function AudioWaveform({ samples, progress: _progress = 0, recording = false, height = 76 }: AudioWaveformProps) {
  const width = WAVE_VIEW_WIDTH;
  const center = height / 2;
  const waveform = useMemo(() => createSymmetricWaveformPaths(samples, width, height), [height, samples, width]);
  const clipId = recording ? "recording-wave-clip" : "playback-wave-clip";

  return (
    <View style={[styles.container, recording && styles.recordingContainer]} accessibilityLabel={recording ? "完整录制音频波形" : "完整播放音频波形"}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Rect x="0" y="0" width={width} height={height} fill="#FFFFFF" />
        <Defs><ClipPath id={clipId}><Rect x="2" y="2" width={width - 4} height={height - 4} /></ClipPath></Defs>
        <G clipPath={`url(#${clipId})`}>
          <Line x1="0" y1={center} x2={width} y2={center} stroke="rgba(91,110,137,0.22)" strokeWidth="0.35" />
          <Path d={waveform.fillPath} fill="#42D66B" />
          <Path d={waveform.upperPath} fill="#FFFFFF" opacity={0.15} />
          {recording ? <Rect x={width - 2} y="0" width="0.8" height={height} fill="rgba(82,112,92,0.45)" /> : null}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  recordingContainer: { borderColor: "#CBE6D2" },
});
