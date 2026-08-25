import { LinearGradient } from "expo-linear-gradient";
import { type PropsWithChildren, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { resolveLiquidSliderValue } from "@/lib/liquid-slider";

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

type LiquidSliderProps = {
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  maximumValue?: number;
  minimumValue?: number;
  onSlidingComplete?: (value: number) => void;
  onValueChange?: (value: number) => void;
  step?: number;
  style?: StyleProp<ViewStyle>;
  value?: number;
};

export function LiquidSlider({ accessibilityLabel, containerStyle, disabled = false, maximumValue = 100, minimumValue = 0, onSlidingComplete, onValueChange, step = 1, style, value = minimumValue }: LiquidSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const press = useRef(new Animated.Value(0)).current;
  const valueRef = useRef(value);
  valueRef.current = value;
  const progress = Math.max(0, Math.min(1, (value - minimumValue) / Math.max(0.0001, maximumValue - minimumValue)));
  const changeAt = (position: number) => {
    const width = trackWidthRef.current;
    if (width <= 0) return valueRef.current;
    const next = resolveLiquidSliderValue(position, width, minimumValue, maximumValue, step);
    if (next === valueRef.current) return next;
    valueRef.current = next;
    onValueChange?.(next);
    return next;
  };
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: () => !disabled,
    onStartShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (event) => { Animated.timing(press, { toValue: 1, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); changeAt(event.nativeEvent.locationX); },
    onPanResponderMove: (event) => { changeAt(event.nativeEvent.locationX); },
    onPanResponderRelease: () => { Animated.timing(press, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); onSlidingComplete?.(valueRef.current); },
    onPanResponderTerminate: () => { Animated.timing(press, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); onSlidingComplete?.(valueRef.current); },
  }), [disabled, maximumValue, minimumValue, onSlidingComplete, onValueChange, press, step, trackWidth]);
  const trackHeight = press.interpolate({ inputRange: [0, 1], outputRange: [3, 12] });
  const thumbHeight = press.interpolate({ inputRange: [0, 1], outputRange: [6, 16] });
  const thumbWidth = press.interpolate({ inputRange: [0, 1], outputRange: [6, 8] });
  const thumbRadius = press.interpolate({ inputRange: [0, 1], outputRange: [3, 5] });
  const thumbMarginLeft = press.interpolate({ inputRange: [0, 1], outputRange: [-3, -4] });
  const sourceThumbOpacity = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const activeThumbOpacity = press.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const activeTrackOpacity = press.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  return <View accessibilityLabel={accessibilityLabel} accessibilityRole="adjustable" accessibilityState={{ disabled }} onLayout={(event) => { const nextWidth = event.nativeEvent.layout.width; trackWidthRef.current = nextWidth; setTrackWidth((previous) => previous === nextWidth ? previous : nextWidth); }} style={[styles.sliderShell, style, containerStyle, disabled && styles.disabled]} {...panResponder.panHandlers}>
    <Animated.View pointerEvents="none" style={[styles.sliderTrack, { borderRadius: thumbRadius, height: trackHeight }]} />
    <Animated.View pointerEvents="none" style={[styles.sliderLiquid, { borderRadius: thumbRadius, height: trackHeight, opacity: activeTrackOpacity, width: `${progress * 100}%` }]} />
    <Animated.View pointerEvents="none" style={[styles.sliderSourceThumb, { borderRadius: thumbRadius, height: thumbHeight, left: `${progress * 100}%`, marginLeft: thumbMarginLeft, opacity: sourceThumbOpacity, width: thumbWidth }]} />
    <Animated.View pointerEvents="none" style={[styles.sliderActiveThumb, { borderRadius: thumbRadius, height: thumbHeight, left: `${progress * 100}%`, marginLeft: thumbMarginLeft, opacity: activeThumbOpacity, width: thumbWidth }]}><View style={styles.sliderThumbSpecular} /></Animated.View>
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
  sliderShell: { height: 48, justifyContent: "center", overflow: "visible", position: "relative" },
  sliderTrack: { backgroundColor: "rgba(255,255,255,0.2)", left: 0, position: "absolute", right: 0 },
  sliderLiquid: { backgroundColor: "rgba(255,255,255,0.86)", left: 0, position: "absolute" },
  sliderSourceThumb: { backgroundColor: "#3F6EE4", elevation: 2, position: "absolute", shadowColor: "#254996", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.26, shadowRadius: 2 },
  sliderActiveThumb: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.98)", borderColor: "rgba(255,255,255,0.96)", borderWidth: 1, elevation: 5, justifyContent: "center", position: "absolute", shadowColor: "#1C315F", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.23, shadowRadius: 5 },
  sliderThumbSpecular: { backgroundColor: "rgba(255,255,255,0.78)", borderRadius: 99, height: 3, position: "absolute", top: 2, width: "58%" },
});
