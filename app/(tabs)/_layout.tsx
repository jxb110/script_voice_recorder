import { Tabs } from "expo-router";

import { LiquidBottomTabs } from "@/components/liquid-bottom-tabs";
import { useAppLanguage } from "@/lib/i18n";

export default function TabLayout() {
  const { t } = useAppLanguage();
  return <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <LiquidBottomTabs {...props} labels={{ index: t("tasks"), scripts: t("scripts"), settings: t("settings") }} />}><Tabs.Screen name="index" options={{ title: t("tasks") }} /><Tabs.Screen name="scripts" options={{ title: t("scripts") }} /><Tabs.Screen name="settings" options={{ title: t("settings") }} /></Tabs>;
}
