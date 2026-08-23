import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { GlassNavigationBackground } from "@/components/liquid-glass";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAppLanguage } from "@/lib/i18n";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, tabBarInactiveTintColor: "#71809A", headerShown: false, tabBarButton: HapticTab, tabBarBackground: GlassNavigationBackground, tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: 62 + bottomPadding, backgroundColor: "rgba(255,255,255,0.38)", borderColor: "rgba(255,255,255,0.88)", borderRadius: 24, borderWidth: 1, elevation: 0, marginBottom: 8, marginHorizontal: 12, overflow: "hidden", shadowColor: "#31517F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18 } }}><Tabs.Screen name="index" options={{ title: t("tasks"), tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} /> }} /><Tabs.Screen name="scripts" options={{ title: t("scripts"), tabBarIcon: ({ color }) => <IconSymbol size={25} name="list.bullet" color={color} /> }} /><Tabs.Screen name="settings" options={{ title: t("settings"), tabBarIcon: ({ color }) => <IconSymbol size={25} name="gearshape.fill" color={color} /> }} /></Tabs>;
}
