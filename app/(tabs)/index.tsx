import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { LiquidGlassButton } from "@/components/liquid-controls";
import { GlassSurface } from "@/components/liquid-glass";
import { ScreenContainer } from "@/components/screen-container";
import { useRecorder } from "@/lib/recorder-context";
import { useAppLanguage } from "@/lib/i18n";

export default function HomeScreen() {
  const router = useRouter();
  const { t, language } = useAppLanguage();
  const { projects, speakers, loaded } = useRecorder();
  const totalSentences = projects.reduce((sum, project) => sum + project.sentences.length, 0);
  const recordedSentences = projects.reduce((sum, project) => sum + project.sentences.filter((sentence) => sentence.recordingUri).length, 0);

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t("localVoice")}</Text>
          <Text numberOfLines={1} style={styles.title}>{language === "zh" ? "采音脚本" : "Script Recorder"}</Text>
          <Text numberOfLines={2} style={styles.subtitle}>{t("appSubtitle")}</Text>
        </View>
        <TouchableOpacity style={styles.speakerButton} onPress={() => router.push("/speakers" as never)}>
          <MaterialIcons color="#2F4DA0" name="record-voice-over" size={24} />
        </TouchableOpacity>
      </View>
      <GlassSurface style={styles.stats} intensity={32}>
        <View style={styles.stat}><Text style={styles.statNumber}>{projects.length}</Text><Text numberOfLines={2} style={styles.statLabel}>{t("recordingTasks")}</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.stat}><Text style={styles.statNumber}>{recordedSentences}<Text style={styles.statTotal}>/{totalSentences}</Text></Text><Text numberOfLines={2} style={styles.statLabel}>{t("recordedSentences")}</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.stat}><Text style={styles.statNumber}>{speakers.length}</Text><Text numberOfLines={2} style={styles.statLabel}>{t("speakers")}</Text></View>
      </GlassSurface>
      <LiquidGlassButton onPress={() => router.push("/new-project" as never)} style={styles.primary}>
        <View style={[styles.primaryTap, layoutFix.primaryTap]}>
          <View style={styles.primaryIcon}><MaterialIcons color="#3656B7" name="add" size={23} /></View>
          <View style={[styles.primaryCopy, layoutFix.primaryCopy]}><Text numberOfLines={1} style={[styles.primaryTitle, layoutFix.primaryTitle]}>{t("newTask")}</Text><Text numberOfLines={2} style={[styles.primaryHint, layoutFix.primaryHint]}>{t("selectSpeakerAndImport")}</Text></View>
          <MaterialIcons color="#FFFFFF" name="arrow-forward" size={21} />
        </View>
      </LiquidGlassButton>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t("recentTasks")}</Text><TouchableOpacity onPress={() => router.push("/(tabs)/scripts" as never)}><Text style={styles.viewAll}>{t("allTasks")}</Text></TouchableOpacity></View>
      <FlatList
        data={projects.slice(0, 4)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={projects.length ? styles.list : styles.emptyList}
        renderItem={({ item }) => {
          const completed = item.sentences.filter((sentence) => sentence.recordingUri).length;
          return <TouchableOpacity style={styles.project} onPress={() => router.push(`/project/${item.id}` as never)}><View style={[styles.projectIcon, completed === item.sentences.length && styles.projectIconDone]}><MaterialIcons color={completed === item.sentences.length ? "#2F855A" : "#2F4DA0"} name={completed === item.sentences.length ? "check-circle" : "description"} size={22} /></View><View style={styles.projectCopy}><Text numberOfLines={1} style={styles.projectName}>{item.name}</Text><Text numberOfLines={1} style={styles.projectMeta}>{completed}/{item.sentences.length} {t("sentencesUnit")} · {item.sourceFileName}</Text></View><MaterialIcons color="#9AA5BC" name="chevron-right" size={24} /></TouchableOpacity>;
        }}
        ListEmptyComponent={<View style={styles.empty}><MaterialIcons color="#A9B2C7" name="mic-none" size={46} /><Text style={styles.emptyTitle}>{loaded ? t("startFirstScript") : t("loadingLocalData")}</Text><Text style={styles.emptyText}>{t("localStorageHint")}</Text></View>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", paddingTop: 12 }, headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 }, eyebrow: { color: "#61749E", fontSize: 12, fontWeight: "800", letterSpacing: 0.8 }, title: { color: "#182B55", fontSize: 32, fontWeight: "900", letterSpacing: -0.8, marginTop: 3 }, subtitle: { color: "#61749E", flexShrink: 1, fontSize: 14, lineHeight: 19, marginTop: 5 }, speakerButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.62)", borderColor: "rgba(255,255,255,0.92)", borderRadius: 18, borderWidth: 1, elevation: 3, flexShrink: 0, height: 48, justifyContent: "center", marginTop: 3, shadowColor: "#5B78AD", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.13, shadowRadius: 13, width: 48 }, stats: { alignItems: "center", borderRadius: 22, flexDirection: "row", justifyContent: "space-between", marginTop: 24, paddingHorizontal: 10, paddingVertical: 16 }, stat: { alignItems: "center", flex: 1, minWidth: 0 }, statNumber: { color: "#182B55", fontSize: 22, fontWeight: "900" }, statTotal: { color: "#7D8CAB", fontSize: 13, fontWeight: "700" }, statLabel: { color: "#61749E", fontSize: 11, lineHeight: 15, marginTop: 4, minHeight: 30, paddingHorizontal: 2, textAlign: "center" }, statDivider: { backgroundColor: "rgba(119,145,196,0.2)", height: 35, width: 1 }, primary: { borderColor: "rgba(255,255,255,0.78)", borderRadius: 22, borderWidth: 1, marginTop: 16, overflow: "hidden", shadowColor: "#3A5CB3", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20 }, primaryTap: { alignItems: "center", flexDirection: "row", gap: 12, padding: 15 }, primaryIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.86)", borderRadius: 14, flexShrink: 0, height: 43, justifyContent: "center", width: 43 }, primaryCopy: { flex: 1, minWidth: 0 }, primaryTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" }, primaryHint: { color: "#E9EEFF", flexShrink: 1, fontSize: 12, marginTop: 4 }, sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 11, marginTop: 25 }, sectionTitle: { color: "#182B55", flexShrink: 1, fontSize: 18, fontWeight: "900" }, viewAll: { color: "#4669DE", flexShrink: 0, fontSize: 13, fontWeight: "800", marginLeft: 12 }, list: { gap: 10, paddingBottom: 24 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 100 }, project: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.56)", borderColor: "rgba(255,255,255,0.86)", borderRadius: 19, borderWidth: 1, elevation: 2, flexDirection: "row", gap: 12, padding: 14, shadowColor: "#6380B7", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 14 }, projectIcon: { alignItems: "center", backgroundColor: "rgba(224,235,255,0.86)", borderRadius: 13, flexShrink: 0, height: 44, justifyContent: "center", width: 44 }, projectIconDone: { backgroundColor: "rgba(212,244,227,0.92)" }, projectCopy: { flex: 1, minWidth: 0 }, projectName: { color: "#182B55", fontSize: 15, fontWeight: "800" }, projectMeta: { color: "#61749E", fontSize: 12, marginTop: 5 }, empty: { alignItems: "center", paddingHorizontal: 27 }, emptyTitle: { color: "#182B55", fontSize: 19, fontWeight: "900", marginTop: 14, textAlign: "center" }, emptyText: { color: "#61749E", fontSize: 14, lineHeight: 22, marginTop: 7, textAlign: "center" },
});

const layoutFix = StyleSheet.create({
  primaryTap: { minHeight: 72, paddingVertical: 12 },
  primaryCopy: { justifyContent: "center", minHeight: 44 },
  primaryTitle: { includeFontPadding: false, lineHeight: 21, paddingTop: 1 },
  primaryHint: { includeFontPadding: false, lineHeight: 17, marginTop: 3, paddingBottom: 1 },
});
