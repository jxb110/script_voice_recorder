import { type ComponentProps, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";

type IconName = ComponentProps<typeof IconSymbol>["name"];

type LiquidTabIconProps = { focused: boolean; color: string; name: IconName; size: number };
type LiquidTabLabelProps = { children: string; color: string; focused: boolean };

function useSelectionMotion(focused: boolean) {
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    motion.stopAnimation();
    motion.setValue(0);
    if (!focused) return;
    Animated.timing(motion, { duration: 760, easing: Easing.bezier(0.16, 0.86, 0.28, 1), toValue: 1, useNativeDriver: true }).start();
  }, [focused, motion]);
  return motion;
}

function LiquidBubble({ motion, style, x, y, delay = 0 }: { motion: Animated.Value; style: object; x: number; y: number; delay?: number }) {
  const start = Math.min(0.58, 0.1 + delay);
  const opacity = motion.interpolate({ inputRange: [0, start, Math.min(0.92, start + 0.28), 1], outputRange: [0, 1, 0.84, 0] });
  const scale = motion.interpolate({ inputRange: [0, start, Math.min(0.88, start + 0.22), 1], outputRange: [0.18, 1.55, 1.08, 0.72] });
  const translateX = motion.interpolate({ inputRange: [0, 1], outputRange: [0, x] });
  const translateY = motion.interpolate({ inputRange: [0, 1], outputRange: [0, y] });
  return <Animated.View pointerEvents="none" style={[styles.bubble, style, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}><View style={styles.bubbleGlint} /></Animated.View>;
}

export function LiquidTabIcon({ focused, color, name, size }: LiquidTabIconProps) {
  const motion = useSelectionMotion(focused);
  const dockOpacity = motion.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] });
  const dockScale = motion.interpolate({ inputRange: [0, 0.18, 0.48, 1], outputRange: [0.66, 1.22, 0.94, 1] });
  const iconScale = motion.interpolate({ inputRange: [0, 0.2, 0.52, 0.78, 1], outputRange: [1, 0.78, 1.12, 0.97, 1] });
  const iconRotate = motion.interpolate({ inputRange: [0, 0.2, 0.53, 0.76, 1], outputRange: ["0deg", "-8deg", "7deg", "-2deg", "0deg"] });
  const iconLift = motion.interpolate({ inputRange: [0, 0.28, 0.62, 1], outputRange: [0, 3, -4, 0] });
  const flashOpacity = motion.interpolate({ inputRange: [0, 0.11, 0.43, 1], outputRange: [0, 0.98, 0.08, 0] });
  const flashScale = motion.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.42, 1.72, 2.15] });
  return <View pointerEvents="none" style={styles.iconArea}>
    <Animated.View style={[styles.flash, { opacity: flashOpacity, transform: [{ scale: flashScale }] }]} />
    <LiquidBubble delay={0} motion={motion} style={styles.bubbleBlue} x={24} y={-35} />
    <LiquidBubble delay={0.08} motion={motion} style={styles.bubbleCyan} x={9} y={-46} />
    <LiquidBubble delay={0.13} motion={motion} style={styles.bubbleViolet} x={36} y={-20} />
    <LiquidBubble delay={0.18} motion={motion} style={styles.bubbleSilver} x={-22} y={-29} />
    <Animated.View style={[styles.selectionDock, { opacity: dockOpacity, transform: [{ scale: dockScale }] }]}><View style={styles.dockGlint} /><View style={styles.dockRim} /></Animated.View>
    <Animated.View style={[styles.icon, { transform: [{ translateY: iconLift }, { rotate: iconRotate }, { scale: iconScale }] }]}><IconSymbol color={focused ? "#3558D5" : color} name={name} size={size} /></Animated.View>
  </View>;
}

export function LiquidTabLabel({ children, color, focused }: LiquidTabLabelProps) {
  const motion = useSelectionMotion(focused);
  const labelOpacity = motion.interpolate({ inputRange: [0, 0.12, 0.34, 0.56, 1], outputRange: [1, 0.36, 1, 0.84, 1] });
  const labelLift = motion.interpolate({ inputRange: [0, 0.24, 0.58, 1], outputRange: [0, 2, -1, 0] });
  const labelRotate = motion.interpolate({ inputRange: [0, 0.34, 0.66, 1], outputRange: ["0deg", "-2.6deg", "1.4deg", "0deg"] });
  return <Animated.Text style={[styles.label, { color: focused ? "#365BD5" : color, opacity: labelOpacity, transform: [{ translateY: labelLift }, { rotate: labelRotate }] }, focused && styles.labelFocused]}>{children}</Animated.Text>;
}

const styles = StyleSheet.create({
  iconArea: { alignItems: "center", height: 48, justifyContent: "center", overflow: "visible", width: 70 },
  selectionDock: { backgroundColor: "rgba(238,246,255,0.82)", borderColor: "rgba(255,255,255,0.98)", borderRadius: 23, borderWidth: 1, height: 46, position: "absolute", shadowColor: "#4168D5", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.28, shadowRadius: 14, width: 62 },
  dockGlint: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 99, height: 11, left: 9, position: "absolute", right: 9, top: 4 },
  dockRim: { borderColor: "rgba(117,167,255,0.42)", borderRadius: 20, borderWidth: 1, bottom: 3, left: 3, position: "absolute", right: 3, top: 3 },
  icon: { alignItems: "center", justifyContent: "center", zIndex: 2 },
  flash: { backgroundColor: "rgba(137,190,255,0.88)", borderRadius: 34, height: 62, position: "absolute", width: 62 },
  bubble: { borderColor: "rgba(255,255,255,0.97)", borderWidth: 1.35, elevation: 7, overflow: "hidden", position: "absolute", shadowColor: "#355DD4", shadowOpacity: 0.42, shadowRadius: 7, zIndex: 5 },
  bubbleGlint: { backgroundColor: "rgba(255,255,255,0.74)", borderRadius: 99, height: 4, left: 3, position: "absolute", right: 3, top: 2 },
  bubbleBlue: { backgroundColor: "#397CFF", borderRadius: 10, height: 20, right: 5, top: -1, width: 20 },
  bubbleCyan: { backgroundColor: "#24D8E4", borderRadius: 8.5, height: 17, right: 17, top: -9, width: 17 },
  bubbleViolet: { backgroundColor: "#9A76FF", borderRadius: 9, height: 18, right: -5, top: 14, width: 18 },
  bubbleSilver: { backgroundColor: "#74B6FF", borderRadius: 7.5, height: 15, left: 6, top: 8, width: 15 },
  label: { alignSelf: "stretch", fontSize: 12, fontWeight: "700", includeFontPadding: false, lineHeight: 17, marginBottom: 1, minWidth: 58, paddingHorizontal: 2, textAlign: "center" },
  labelFocused: { fontWeight: "900", textShadowColor: "rgba(100,144,255,0.25)", textShadowRadius: 5 },
});
