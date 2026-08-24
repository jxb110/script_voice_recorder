import { type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassNavigationBackground } from "@/components/liquid-glass";
import { IconSymbol } from "@/components/ui/icon-symbol";

type TabItem = { route: "index" | "scripts" | "settings"; label: string; icon: "house.fill" | "list.bullet" | "gearshape.fill"; size: number };

export function LiquidBottomTabs({ state, descriptors, navigation, labels }: BottomTabBarProps & { labels: Record<TabItem["route"], string> }) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const selection = useRef(new Animated.Value(state.index)).current;
  const liquid = useRef(new Animated.Value(0)).current;
  const items = useMemo<TabItem[]>(() => [
    { route: "index", label: labels.index, icon: "house.fill", size: 27 },
    { route: "scripts", label: labels.scripts, icon: "list.bullet", size: 25 },
    { route: "settings", label: labels.settings, icon: "gearshape.fill", size: 25 },
  ], [labels]);
  const selected = Math.max(0, items.findIndex((item) => state.routes[state.index]?.name === item.route));
  const tabWidth = barWidth / items.length;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(selection, { duration: 430, easing: Easing.bezier(0.18, 0.88, 0.28, 1), toValue: selected, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(liquid, { duration: 110, easing: Easing.out(Easing.quad), toValue: 1, useNativeDriver: true }),
        Animated.timing(liquid, { duration: 340, easing: Easing.bezier(0.16, 0.86, 0.28, 1), toValue: 0, useNativeDriver: true }),
      ]),
    ]).start();
  }, [liquid, selected, selection]);

  const translateX = tabWidth ? selection.interpolate({ inputRange: [0, 1, 2], outputRange: [0, tabWidth, tabWidth * 2] }) : 0;
  const lensScaleX = liquid.interpolate({ inputRange: [0, 1], outputRange: [1, 1.34] });
  const lensScaleY = liquid.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0.76, 1.03] });
  const lensLift = liquid.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const splashOpacity = liquid.interpolate({ inputRange: [0, 0.12, 0.58, 1], outputRange: [0, 1, 0.38, 0] });
  const splashScale = liquid.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.78] });
  const bubbleLift = liquid.interpolate({ inputRange: [0, 1], outputRange: [0, -19] });

  return <View onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)} pointerEvents="box-none" style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 7) }]}>
    <GlassNavigationBackground />
    <View pointerEvents="none" style={styles.topRim} />
    {tabWidth ? <Animated.View pointerEvents="none" style={[styles.lensSlot, { width: tabWidth, transform: [{ translateX }] }]}>
      <Animated.View style={[styles.splash, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]} />
      <Animated.View style={[styles.lens, { transform: [{ translateY: lensLift }, { scaleX: lensScaleX }, { scaleY: lensScaleY }] }]}><View style={styles.lensGlint} /><View style={styles.lensRim} /></Animated.View>
      <Animated.View style={[styles.bubble, styles.bubbleLeft, { opacity: splashOpacity, transform: [{ translateY: bubbleLift }, { scale: splashScale }] }]} />
      <Animated.View style={[styles.bubble, styles.bubbleRight, { opacity: splashOpacity, transform: [{ translateY: bubbleLift }, { scale: splashScale }] }]} />
    </Animated.View> : null}
    <View style={styles.tabRow}>{items.map((item) => {
      const routeIndex = state.routes.findIndex((route) => route.name === item.route);
      const route = state.routes[routeIndex];
      if (!route) return null;
      const focused = routeIndex === state.index;
      const options = descriptors[route.key]?.options;
      const onPress = () => {
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
      };
      const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });
      return <Pressable accessibilityRole="button" accessibilityState={{ selected: focused }} key={route.key} onLongPress={onLongPress} onPress={onPress} style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]} testID={options?.tabBarButtonTestID}>
        <View style={styles.iconArea}><IconSymbol color={focused ? "#3157D2" : "#73819C"} name={item.icon} size={item.size} /></View><Text numberOfLines={1} style={[styles.label, focused && styles.labelFocused]}>{item.label}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

const styles = StyleSheet.create({
  shell: { backgroundColor: "rgba(244,249,255,0.38)", borderColor: "rgba(255,255,255,0.86)", borderRadius: 28, borderWidth: 1, height: 74, marginBottom: 8, marginHorizontal: 8, overflow: "visible", shadowColor: "#24467F", shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.15, shadowRadius: 18 },
  topRim: { backgroundColor: "rgba(255,255,255,0.86)", borderRadius: 999, height: 1.5, left: 22, position: "absolute", right: 22, top: 2 },
  tabRow: { flex: 1, flexDirection: "row", paddingTop: 7, zIndex: 3 },
  tab: { alignItems: "center", flex: 1, justifyContent: "center", minWidth: 0 },
  tabPressed: { opacity: 0.68 },
  iconArea: { alignItems: "center", height: 36, justifyContent: "center", width: "100%" },
  label: { color: "#73819C", fontSize: 12, fontWeight: "700", includeFontPadding: false, lineHeight: 17, marginTop: 1, minWidth: 58, paddingHorizontal: 2, textAlign: "center" },
  labelFocused: { color: "#3157D2", fontWeight: "900", textShadowColor: "rgba(90,134,255,0.32)", textShadowRadius: 5 },
  lensSlot: { alignItems: "center", height: 59, justifyContent: "center", left: 0, position: "absolute", top: 2, zIndex: 1 },
  lens: { backgroundColor: "rgba(221,240,255,0.35)", borderColor: "rgba(255,255,255,0.82)", borderRadius: 26, borderWidth: 1, height: 49, overflow: "hidden", shadowColor: "#3B65D5", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.18, shadowRadius: 14, width: 58 },
  lensGlint: { backgroundColor: "rgba(255,255,255,0.62)", borderRadius: 999, height: 8, left: 9, position: "absolute", right: 9, top: 4 },
  lensRim: { borderColor: "rgba(126,178,255,0.42)", borderRadius: 22, borderWidth: 1, bottom: 3, left: 3, position: "absolute", right: 3, top: 3 },
  splash: { backgroundColor: "rgba(111,175,255,0.26)", borderRadius: 36, height: 62, position: "absolute", width: 62 },
  bubble: { borderColor: "rgba(255,255,255,0.76)", borderWidth: 1, elevation: 6, opacity: 0.82, position: "absolute", shadowColor: "#345AD1", shadowOpacity: 0.22, shadowRadius: 6 },
  bubbleLeft: { backgroundColor: "rgba(86,207,233,0.74)", borderRadius: 8, height: 16, left: "24%", top: 11, width: 16 },
  bubbleRight: { backgroundColor: "rgba(113,144,255,0.72)", borderRadius: 10, height: 20, right: "20%", top: 16, width: 20 },
});
