import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { GlassNavigationBackground } from "@/components/liquid-glass";
import { LiquidTabIcon, LiquidTabLabel } from "@/components/liquid-tab-item";
import { useColors } from "@/hooks/use-colors";
import { useAppLanguage } from "@/lib/i18n";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, tabBarInactiveTintColor: "#71809A", headerShown: false, tabBarButton: HapticTab, tabBarBackground: GlassNavigationBackground, tabBarIconStyle: { marginTop: -6 }, tabBarItemStyle: { flex: 1, minWidth: 0, overflow: "visible", paddingHorizontal: 0 }, tabBarLabelStyle: { marginTop: -2 }, tabBarStyle: { paddingTop: 10, paddingBottom: bottomPadding, height: 81 + bottomPadding, backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.92)", borderRadius: 30, borderWidth: 1, elevation: 0, marginBottom: 8, marginHorizontal: 8, overflow: "visible", shadowColor: "#31517F", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20 } }}><Tabs.Screen name="index" options={{ title: t("tasks"), tabBarIcon: ({ color, focused }) => <LiquidTabIcon color={String(color)} focused={focused} name="house.fill" size={28} />, tabBarLabel: ({ color, focused }) => <LiquidTabLabel color={String(color)} focused={focused}>{t("tasks")}</LiquidTabLabel> }} /><Tabs.Screen name="scripts" options={{ title: t("scripts"), tabBarIcon: ({ color, focused }) => <LiquidTabIcon color={String(color)} focused={focused} name="list.bullet" size={25} />, tabBarLabel: ({ color, focused }) => <LiquidTabLabel color={String(color)} focused={focused}>{t("scripts")}</LiquidTabLabel> }} /><Tabs.Screen name="settings" options={{ title: t("settings"), tabBarIcon: ({ color, focused }) => <LiquidTabIcon color={String(color)} focused={focused} name="gearshape.fill" size={25} />, tabBarLabel: ({ color, focused }) => <LiquidTabLabel color={String(color)} focused={focused}>{t("settings")}</LiquidTabLabel> }} /></Tabs>;
}
