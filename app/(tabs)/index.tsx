import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statNumber}>{projects.length}</Text><Text style={styles.statLabel}>{t("recordingTasks")}</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.stat}><Text style={styles.statNumber}>{recordedSentences}<Text style={styles.statTotal}>/{totalSentences}</Text></Text><Text style={styles.statLabel}>{t("recordedSentences")}</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.stat}><Text style={styles.statNumber}>{speakers.length}</Text><Text style={styles.statLabel}>{t("speakers")}</Text></View>
      </View>
      <TouchableOpacity style={styles.primary} onPress={() => router.push("/new-project" as never)}>
        <View style={styles.primaryIcon}><MaterialIcons color="#2F4DA0" name="add" size={23} /></View>
        <View style={styles.primaryCopy}><Text style={styles.primaryTitle}>{t("newTask")}</Text><Text style={styles.primaryHint}>{t("selectSpeakerAndImport")}</Text></View>
        <MaterialIcons color="#FFFFFF" name="arrow-forward" size={21} />
      </TouchableOpacity>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t("recentTasks")}</Text><TouchableOpacity onPress={() => router.push("/(tabs)/scripts" as never)}><Text style={styles.viewAll}>{t("allTasks")}</Text></TouchableOpacity></View>
      <FlatList
        data={projects.slice(0, 4)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={projects.length ? styles.list : styles.emptyList}
        renderItem={({ item }) => {
          const completed = item.sentences.filter((sentence) => sentence.recordingUri).length;
          return <TouchableOpacity style={styles.project} onPress={() => router.push(`/project/${item.id}` as never)}><View style={[styles.projectIcon, completed === item.sentences.length && styles.projectIconDone]}><MaterialIcons color={completed === item.sentences.length ? "#2F855A" : "#2F4DA0"} name={completed === item.sentences.length ? "check-circle" : "description"} size={22} /></View><View style={styles.projectCopy}><Text numberOfLines={1} style={styles.projectName}>{item.name}</Text><Text style={styles.projectMeta}>{completed}/{item.sentences.length} {t("sentencesUnit")} · {item.sourceFileName}</Text></View><MaterialIcons color="#9AA5BC" name="chevron-right" size={24} /></TouchableOpacity>;
        }}
        ListEmptyComponent={<View style={styles.empty}><MaterialIcons color="#A9B2C7" name="mic-none" size={46} /><Text style={styles.emptyTitle}>{loaded ? t("startFirstScript") : t("loadingLocalData")}</Text><Text style={styles.emptyText}>{t("localStorageHint")}</Text></View>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", paddingTop: 12 }, headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 }, eyebrow: { color: "#65708A", fontSize: 12, fontWeight: "800", letterSpacing: 0.8 }, title: { color: "#182033", fontSize: 32, fontWeight: "900", letterSpacing: -0.8, marginTop: 3 }, subtitle: { color: "#65708A", flexShrink: 1, fontSize: 14, lineHeight: 19, marginTop: 5 }, speakerButton: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 18, flexShrink: 0, height: 48, justifyContent: "center", marginTop: 3, width: 48 }, stats: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 19, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 24, paddingHorizontal: 10, paddingVertical: 16 }, stat: { alignItems: "center", flex: 1 }, statNumber: { color: "#182033", fontSize: 22, fontWeight: "900" }, statTotal: { color: "#8A95AA", fontSize: 13, fontWeight: "700" }, statLabel: { color: "#65708A", fontSize: 12, marginTop: 4 }, statDivider: { backgroundColor: "#E8EBF3", height: 35, width: 1 }, primary: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 19, flexDirection: "row", gap: 12, marginTop: 16, padding: 15 }, primaryIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 43, justifyContent: "center", width: 43 }, primaryCopy: { flex: 1 }, primaryTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" }, primaryHint: { color: "#DDE5FF", fontSize: 12, marginTop: 4 }, sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 11, marginTop: 25 }, sectionTitle: { color: "#182033", fontSize: 18, fontWeight: "900" }, viewAll: { color: "#2F4DA0", fontSize: 13, fontWeight: "800" }, list: { gap: 10, paddingBottom: 24 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 100 }, project: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 }, projectIcon: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 13, height: 44, justifyContent: "center", width: 44 }, projectIconDone: { backgroundColor: "#E2F4E8" }, projectCopy: { flex: 1 }, projectName: { color: "#182033", fontSize: 15, fontWeight: "800" }, projectMeta: { color: "#65708A", fontSize: 12, marginTop: 5 }, empty: { alignItems: "center", paddingHorizontal: 27 }, emptyTitle: { color: "#182033", fontSize: 19, fontWeight: "900", marginTop: 14 }, emptyText: { color: "#65708A", fontSize: 14, lineHeight: 22, marginTop: 7, textAlign: "center" },
});
