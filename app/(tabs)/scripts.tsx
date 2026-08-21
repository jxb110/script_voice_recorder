import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useRecorder } from "@/lib/recorder-context";

export default function ScriptsScreen() {
  const router = useRouter();
  const { projects, speakers, loaded, deleteProject } = useRecorder();
  const confirmDelete = (projectId: string, name: string) => {
    Alert.alert("删除任务？", `“${name}”及其本地录制进度将从任务列表移除。`, [
      { text: "取消", style: "cancel" },
      { text: "删除任务", style: "destructive", onPress: () => deleteProject(projectId) },
    ]);
  };
  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <View style={styles.header}><View><Text style={styles.title}>脚本任务</Text><Text style={styles.subtitle}>按句管理录制进度</Text></View><TouchableOpacity style={styles.addButton} onPress={() => router.push("/new-project" as never)}><MaterialIcons color="#FFFFFF" name="add" size={23} /></TouchableOpacity></View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={projects.length ? styles.list : styles.emptyList}
        renderItem={({ item }) => {
          const recorded = item.sentences.filter((sentence) => sentence.recordingUri).length;
          const speaker = speakers.find((candidate) => candidate.id === item.speakerId);
          return <View style={styles.card}><TouchableOpacity style={styles.cardMain} onPress={() => router.push(`/project/${item.id}` as never)} activeOpacity={0.76}><View style={styles.icon}><MaterialIcons color="#2F4DA0" name="description" size={23} /></View><View style={styles.cardBody}><Text numberOfLines={1} style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardSubtitle}>{speaker?.name ?? "未指定发音人"} · {recorded}/{item.sentences.length} 句</Text><View style={styles.progressTrack}><View style={[styles.progress, { width: `${item.sentences.length ? (recorded / item.sentences.length) * 100 : 0}%` }]} /></View></View><MaterialIcons color="#9AA5BC" name="chevron-right" size={24} /></TouchableOpacity><TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(item.id, item.name)} accessibilityLabel={`删除任务 ${item.name}`}><MaterialIcons color="#C34F5A" name="delete-outline" size={21} /></TouchableOpacity></View>;
        }}
        ListEmptyComponent={<View style={styles.empty}><MaterialIcons color="#A9B2C7" name="library-books" size={44} /><Text style={styles.emptyTitle}>{loaded ? "尚未导入脚本" : "正在载入任务"}</Text><Text style={styles.emptyText}>选择 TXT 脚本；每一行是一条 JSON 字元数组，即可创建逐句录音任务。</Text><TouchableOpacity style={styles.importButton} onPress={() => router.push("/new-project" as never)}><Text style={styles.importText}>导入 TXT 脚本</Text></TouchableOpacity></View>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 22, paddingTop: 10 }, title: { color: "#182033", fontSize: 29, fontWeight: "800", letterSpacing: -0.5 }, subtitle: { color: "#65708A", fontSize: 14, marginTop: 4 }, addButton: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 18, height: 46, justifyContent: "center", width: 46 }, list: { gap: 12, paddingBottom: 28 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 80 }, card: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 18, borderWidth: 1, flexDirection: "row", overflow: "hidden" }, cardMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: 13, padding: 15 }, icon: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 14, height: 48, justifyContent: "center", width: 48 }, cardBody: { flex: 1, gap: 5 }, cardTitle: { color: "#182033", fontSize: 16, fontWeight: "700" }, cardSubtitle: { color: "#65708A", fontSize: 13 }, progressTrack: { backgroundColor: "#E8EBF3", borderRadius: 99, height: 5, overflow: "hidden" }, progress: { backgroundColor: "#2F855A", borderRadius: 99, height: "100%" }, deleteButton: { alignItems: "center", alignSelf: "stretch", borderLeftColor: "#EDF0F5", borderLeftWidth: 1, justifyContent: "center", width: 48 }, empty: { alignItems: "center", paddingHorizontal: 26 }, emptyTitle: { color: "#182033", fontSize: 19, fontWeight: "800", marginTop: 15 }, emptyText: { color: "#65708A", fontSize: 14, lineHeight: 22, marginTop: 8, textAlign: "center" }, importButton: { backgroundColor: "#2F4DA0", borderRadius: 14, marginTop: 21, paddingHorizontal: 23, paddingVertical: 13 }, importText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
