import { type ComponentProps, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";

type IconName = ComponentProps<typeof IconSymbol>["name"];

type LiquidTabIconProps = {
  focused: boolean;
  color: string;
  name: IconName;
  size: number;
};

type LiquidTabLabelProps = {
  children: string;
  color: string;
  focused: boolean;
};

function useSelectionMotion(focused: boolean) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    motion.stopAnimation();
    motion.setValue(0);
    if (!focused) return;
    Animated.timing(motion, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focused, motion]);

  return motion;
}

export function LiquidTabIcon({ focused, color, name, size }: LiquidTabIconProps) {
  const motion = useSelectionMotion(focused);
  const iconScale = motion.interpolate({ inputRange: [0, 0.24, 0.56, 0.8, 1], outputRange: [1, 0.84, 1.13, 0.98, 1] });
  const iconRotate = motion.interpolate({ inputRange: [0, 0.24, 0.56, 0.8, 1], outputRange: ["0deg", "-7deg", "6deg", "-3deg", "0deg"] });
  const iconLift = motion.interpolate({ inputRange: [0, 0.28, 0.6, 1], outputRange: [0, 3, -4, 0] });
  const flashOpacity = motion.interpolate({ inputRange: [0, 0.14, 0.38, 1], outputRange: [0, 0.95, 0.08, 0] });
  const flashScale = motion.interpolate({ inputRange: [0, 0.38, 1], outputRange: [0.55, 1.35, 1.65] });
  const bubbleOpacity = motion.interpolate({ inputRange: [0, 0.16, 0.68, 1], outputRange: [0, 0.95, 0.5, 0] });
  const bubbleOneX = motion.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const bubbleOneY = motion.interpolate({ inputRange: [0, 1], outputRange: [0, -17] });
  const bubbleTwoX = motion.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const bubbleTwoY = motion.interpolate({ inputRange: [0, 1], outputRange: [0, -23] });
  const bubbleThreeX = motion.interpolate({ inputRange: [0, 1], outputRange: [0, 19] });
  const bubbleThreeY = motion.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });

  return (
    <View pointerEvents="none" style={styles.iconArea}>
      <Animated.View style={[styles.flash, { opacity: flashOpacity, transform: [{ scale: flashScale }] }]} />
      <Animated.View style={[styles.bubble, styles.bubbleOne, { opacity: bubbleOpacity, transform: [{ translateX: bubbleOneX }, { translateY: bubbleOneY }] }]} />
      <Animated.View style={[styles.bubble, styles.bubbleTwo, { opacity: bubbleOpacity, transform: [{ translateX: bubbleTwoX }, { translateY: bubbleTwoY }] }]} />
      <Animated.View style={[styles.bubble, styles.bubbleThree, { opacity: bubbleOpacity, transform: [{ translateX: bubbleThreeX }, { translateY: bubbleThreeY }] }]} />
      <Animated.View style={{ transform: [{ translateY: iconLift }, { rotate: iconRotate }, { scale: iconScale }] }}>
        <IconSymbol color={color} name={name} size={size} />
      </Animated.View>
    </View>
  );
}

export function LiquidTabLabel({ children, color, focused }: LiquidTabLabelProps) {
  const motion = useSelectionMotion(focused);
  const labelOpacity = motion.interpolate({ inputRange: [0, 0.12, 0.3, 0.5, 1], outputRange: [1, 0.44, 1, 0.82, 1] });
  const labelLift = motion.interpolate({ inputRange: [0, 0.24, 0.58, 1], outputRange: [0, 2, -1, 0] });
  const labelRotate = motion.interpolate({ inputRange: [0, 0.34, 0.66, 1], outputRange: ["0deg", "-2deg", "1.2deg", "0deg"] });

  return <Animated.Text style={[styles.label, { color, opacity: labelOpacity, transform: [{ translateY: labelLift }, { rotate: labelRotate }] }, focused && styles.labelFocused]}>{children}</Animated.Text>;
}

const styles = StyleSheet.create({
  iconArea: { alignItems: "center", height: 29, justifyContent: "center", overflow: "visible", width: 42 },
  flash: { backgroundColor: "rgba(158, 192, 255, 0.62)", borderRadius: 18, height: 31, position: "absolute", width: 31 },
  bubble: { borderColor: "rgba(255,255,255,0.78)", borderWidth: 1, position: "absolute" },
  bubbleOne: { backgroundColor: "#78A4FF", borderRadius: 4, height: 8, right: 3, top: 2, width: 8 },
  bubbleTwo: { backgroundColor: "#73D9E5", borderRadius: 3, height: 6, right: 8, top: -1, width: 6 },
  bubbleThree: { backgroundColor: "#9D8BFF", borderRadius: 3.5, height: 7, right: -1, top: 8, width: 7 },
  label: { fontSize: 11, fontWeight: "700", lineHeight: 14, marginBottom: 1 },
  labelFocused: { fontWeight: "800" },
});
