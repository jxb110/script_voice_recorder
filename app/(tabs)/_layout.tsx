import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAppLanguage } from "@/lib/i18n";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, headerShown: false, tabBarButton: HapticTab, tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: 56 + bottomPadding, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 0.5 } }}><Tabs.Screen name="index" options={{ title: t("tasks"), tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} /> }} /><Tabs.Screen name="scripts" options={{ title: t("scripts"), tabBarIcon: ({ color }) => <IconSymbol size={25} name="list.bullet" color={color} /> }} /><Tabs.Screen name="settings" options={{ title: t("settings"), tabBarIcon: ({ color }) => <IconSymbol size={25} name="gearshape.fill" color={color} /> }} /></Tabs>;
}
