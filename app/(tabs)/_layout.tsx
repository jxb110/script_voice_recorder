import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
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
  return <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, tabBarInactiveTintColor: "#71809A", headerShown: false, tabBarButton: HapticTab, tabBarBackground: GlassNavigationBackground, tabBarItemStyle: { overflow: "visible" }, tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: 62 + bottomPadding, backgroundColor: "rgba(255,255,255,0.38)", borderColor: "rgba(255,255,255,0.88)", borderRadius: 24, borderWidth: 1, elevation: 0, marginBottom: 8, marginHorizontal: 12, overflow: "visible", shadowColor: "#31517F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18 } }}><Tabs.Screen name="index" options={{ title: t("tasks"), tabBarIcon: ({ color, focused }) => <LiquidTabIcon color={String(color)} focused={focused} name="house.fill" size={28} />, tabBarLabel: ({ color, focused }) => <LiquidTabLabel color={String(color)} focused={focused}>{t("tasks")}</LiquidTabLabel> }} /><Tabs.Screen name="scripts" options={{ title: t("scripts"), tabBarIcon: ({ color, focused }) => <LiquidTabIcon color={String(color)} focused={focused} name="list.bullet" size={25} />, tabBarLabel: ({ color, focused }) => <LiquidTabLabel color={String(color)} focused={focused}>{t("scripts")}</LiquidTabLabel> }} /><Tabs.Screen name="settings" options={{ title: t("settings"), tabBarIcon: ({ color, focused }) => <LiquidTabIcon color={String(color)} focused={focused} name="gearshape.fill" size={25} />, tabBarLabel: ({ color, focused }) => <LiquidTabLabel color={String(color)} focused={focused}>{t("settings")}</LiquidTabLabel> }} /></Tabs>;
}
