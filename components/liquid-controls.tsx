import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps, type PropsWithChildren, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type LiquidButtonProps = PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: "blue" | "neutral" | "danger";
}>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function LiquidGlassButton({ children, disabled, onPress, style, tone = "blue" }: LiquidButtonProps) {
  const press = useRef(new Animated.Value(0)).current;
  const onPressIn = () => Animated.timing(press, { duration: 100, toValue: 1, useNativeDriver: true }).start();
  const onPressOut = () => Animated.timing(press, { duration: 170, toValue: 0, useNativeDriver: true }).start();
  const transform = { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) }, { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }] };
  const colors: [string, string] = tone === "danger" ? ["#F3848E", "#D65263"] : tone === "neutral" ? ["rgba(255,255,255,0.9)", "rgba(219,232,255,0.72)"] : ["#7399FF", "#4269E8"];
  return <AnimatedPressable accessibilityRole="button" disabled={disabled} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.buttonOuter, style, transform, disabled && styles.disabled]}>
    <LinearGradient colors={colors} end={{ x: 0.98, y: 1 }} start={{ x: 0.04, y: 0 }} style={styles.buttonFill}>
      <View pointerEvents="none" style={styles.buttonSpecular} />
      <View pointerEvents="none" style={styles.buttonRim} />
      <View style={styles.buttonContent}>{children}</View>
    </LinearGradient>
  </AnimatedPressable>;
}

type LiquidSegmentProps = { labels: string[]; selectedIndex: number; onSelect: (index: number) => void };

export function LiquidSegment({ labels, selectedIndex, onSelect }: LiquidSegmentProps) {
  return <View style={styles.segmentShell}>{labels.map((label, index) => {
    const active = index === selectedIndex;
    return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={label} onPress={() => onSelect(index)} style={({ pressed }) => [styles.segmentItem, active && styles.segmentActive, pressed && styles.segmentPressed]}>
      {active ? <LinearGradient colors={["rgba(255,255,255,0.98)", "rgba(221,232,255,0.82)"]} end={{ x: 0.9, y: 1 }} start={{ x: 0.1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
      {active ? <View pointerEvents="none" style={styles.segmentGlint} /> : null}
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

type LiquidSliderProps = ComponentProps<typeof Slider> & { containerStyle?: StyleProp<ViewStyle> };

export function LiquidSlider({ containerStyle, style, ...props }: LiquidSliderProps) {
  return <View style={[styles.sliderShell, containerStyle]}>
    <LinearGradient pointerEvents="none" colors={["rgba(85,118,216,0.92)", "rgba(114,223,241,0.9)"]} end={{ x: 1, y: 0.5 }} start={{ x: 0, y: 0.5 }} style={styles.sliderLiquid} />
    <View pointerEvents="none" style={styles.sliderShine} />
    <Slider {...props} maximumTrackTintColor="rgba(130,151,197,0.26)" minimumTrackTintColor="rgba(79,110,232,0.92)" style={[styles.slider, style]} thumbTintColor="#FFFFFF" />
  </View>;
}

const styles = StyleSheet.create({
  buttonOuter: { borderColor: "rgba(255,255,255,0.92)", borderRadius: 18, borderWidth: 1, overflow: "hidden", shadowColor: "#3658B3", shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.27, shadowRadius: 15 },
  buttonFill: { minHeight: 48, overflow: "hidden" },
  buttonSpecular: { backgroundColor: "rgba(255,255,255,0.44)", borderRadius: 99, height: 26, left: "8%", opacity: 0.78, position: "absolute", right: "8%", top: -14 },
  buttonRim: { borderColor: "rgba(255,255,255,0.5)", borderRadius: 16, borderWidth: 1, bottom: 2, left: 2, position: "absolute", right: 2, top: 2 },
  buttonContent: { alignItems: "center", flex: 1, flexDirection: "row", justifyContent: "center" },
  disabled: { opacity: 0.52 },
  segmentShell: { backgroundColor: "rgba(184,201,238,0.38)", borderColor: "rgba(255,255,255,0.76)", borderRadius: 13, borderWidth: 1, flexDirection: "row", overflow: "hidden", padding: 3 },
  segmentItem: { alignItems: "center", borderRadius: 10, flex: 1, justifyContent: "center", minHeight: 33, overflow: "hidden", position: "relative" },
  segmentActive: { elevation: 2, shadowColor: "#4E71BF", shadowOpacity: 0.17, shadowRadius: 6 },
  segmentPressed: { opacity: 0.74 },
  segmentGlint: { backgroundColor: "rgba(255,255,255,0.68)", borderRadius: 10, height: 11, left: 5, position: "absolute", right: 5, top: -3 },
  segmentText: { color: "#65769A", fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: "#3E60CE", fontWeight: "900" },
  sliderShell: { height: 34, justifyContent: "center", overflow: "visible", position: "relative" },
  sliderLiquid: { borderRadius: 99, height: 7, left: 0, position: "absolute", right: "52%" },
  sliderShine: { backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 99, height: 2, left: 5, position: "absolute", right: "54%", top: 11 },
  slider: { height: 34, width: "100%" },
});
