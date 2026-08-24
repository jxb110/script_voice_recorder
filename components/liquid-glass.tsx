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
      <LinearGradient colors={["rgba(255,255,255,0.5)", "rgba(255,255,255,0.1)", "rgba(190,214,255,0.12)"]} end={{ x: 0.94, y: 1 }} pointerEvents="none" start={{ x: 0.05, y: 0 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.surfaceSpecular} />
      <View pointerEvents="none" style={styles.surfaceInnerRim} />
      {children}
    </BlurView>
  );
}

export function GlassNavigationBackground() {
  return <BlurView experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined} intensity={58} tint="light" style={[StyleSheet.absoluteFill, styles.navigationBackground]}><LinearGradient colors={["rgba(255,255,255,0.72)", "rgba(219,231,255,0.48)"]} end={{ x: 0.9, y: 1 }} pointerEvents="none" start={{ x: 0.08, y: 0 }} style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={styles.navigationSpecular} /></BlurView>;
}

const styles = StyleSheet.create({
  orb: { borderRadius: 999, opacity: 0.6, position: "absolute" },
  indigoOrb: { backgroundColor: "#B8C9FF", height: 310, left: -125, top: 22, width: 310 },
  cyanOrb: { backgroundColor: "#B8EBF2", height: 260, right: -100, top: 230, width: 260 },
  pinkOrb: { backgroundColor: "#EAC9FA", bottom: -130, height: 280, left: 28, width: 280 },
  navigationBackground: { borderColor: "rgba(255,255,255,0.92)", borderRadius: 28, borderWidth: 1, overflow: "hidden" },
  navigationSpecular: { backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 99, height: 14, left: 16, position: "absolute", right: 16, top: -7 },
  surface: { backgroundColor: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.92)", borderRadius: 22, borderWidth: 1, overflow: "hidden", shadowColor: "#5270B0", shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  surfaceSpecular: { backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 99, height: 22, left: "10%", position: "absolute", right: "22%", top: -12 },
  surfaceInnerRim: { borderColor: "rgba(255,255,255,0.34)", borderRadius: 20, borderWidth: 1, bottom: 2, left: 2, position: "absolute", right: 2, top: 2 },
});
