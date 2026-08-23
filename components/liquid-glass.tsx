import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export function LiquidGlassBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={["#EDF3FF", "#F9FBFF", "#EAF5FF"]} end={{ x: 0.9, y: 1 }} start={{ x: 0.08, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.orb, styles.indigoOrb]} />
      <View style={[styles.orb, styles.cyanOrb]} />
      <View style={[styles.orb, styles.pinkOrb]} />
    </View>
  );
}

export function GlassSurface({ children, style, intensity = 38 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; intensity?: number }>) {
  return (
    <BlurView
      experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
      intensity={intensity}
      tint="light"
      style={[styles.surface, style]}
    >
      {children}
    </BlurView>
  );
}

export function GlassNavigationBackground() {
  return <BlurView experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined} intensity={58} tint="light" style={StyleSheet.absoluteFill} />;
}

const styles = StyleSheet.create({
  orb: { borderRadius: 999, opacity: 0.6, position: "absolute" },
  indigoOrb: { backgroundColor: "#B8C9FF", height: 310, left: -125, top: 22, width: 310 },
  cyanOrb: { backgroundColor: "#B8EBF2", height: 260, right: -100, top: 230, width: 260 },
  pinkOrb: { backgroundColor: "#EAC9FA", bottom: -130, height: 280, left: 28, width: 280 },
  surface: { backgroundColor: "rgba(255,255,255,0.56)", borderColor: "rgba(255,255,255,0.9)", borderRadius: 22, borderWidth: 1, overflow: "hidden", shadowColor: "#5270B0", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 4 },
});
