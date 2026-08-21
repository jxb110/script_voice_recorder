import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { createRecordingArchive } from "@/lib/recorder-files";
import { useRecorder } from "@/lib/recorder-context";

export default function ProjectScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { projects, speakers } = useRecorder();
  const project = projects.find((item) => item.id === projectId);

  if (!project) {
    return <ScreenContainer className="items-center justify-center px-6"><Text style={styles.missing}>未找到该录音任务。</Text><TouchableOpacity onPress={() => router.replace("/" as never)}><Text style={styles.link}>返回主页</Text></TouchableOpacity></ScreenContainer>;
  }

  const speaker = speakers.find((item) => item.id === project.speakerId);
  const recorded = project.sentences.filter((sentence) => sentence.recordingUri).length;
  const firstPending = project.sentences.findIndex((sentence) => !sentence.recordingUri);
  const openSentence = (index: number) => router.push(`/record/${project.id}?sentence=${index}` as never);
  const shareSentence = async (uri?: string) => {
    if (!uri) { Alert.alert("该句尚未录制", "完成录制后即可使用系统分享面板发送音频文件。"); return; }
    if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) { Alert.alert("当前不可分享", "请在 Android 设备上使用文件分享功能。"); return; }
    await Sharing.shareAsync(uri, { mimeType: "audio/mp4", dialogTitle: "分享单句录音" });
  };
  const sharePackage = async () => {
    if (!speaker) return;
    try {
      const archive = await createRecordingArchive(project, speaker);
      if (!(await Sharing.isAvailableAsync())) throw new Error("当前设备不可使用系统分享。");
      await Sharing.shareAsync(archive, { mimeType: "application/zip", dialogTitle: "分享完整录音包" });
    } catch (error) { Alert.alert("打包失败", error instanceof Error ? error.message : "无法创建录音包。"); }
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}><MaterialIcons color="#2F4DA0" name="arrow-back" size={23} /></TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>任务详情</Text>
        <TouchableOpacity style={styles.back} onPress={sharePackage}><MaterialIcons color="#2F4DA0" name="ios-share" size={22} /></TouchableOpacity>
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryTop}><View style={styles.fileBadge}><MaterialIcons color="#2F4DA0" name="description" size={23} /></View><View style={styles.summaryCopy}><Text numberOfLines={1} style={styles.projectName}>{project.name}</Text><Text style={styles.projectMeta}>{speaker ? `${speaker.name} · ${speaker.gender} · ${speaker.age} 岁` : "发音人信息缺失"}</Text></View></View>
        <View style={styles.summaryBottom}><View><Text style={styles.percent}>{project.sentences.length ? Math.round((recorded / project.sentences.length) * 100) : 0}%</Text><Text style={styles.percentLabel}>已完成</Text></View><View style={styles.track}><View style={[styles.progress, { width: `${project.sentences.length ? (recorded / project.sentences.length) * 100 : 0}%` }]} /></View><Text style={styles.counter}>{recorded}/{project.sentences.length}</Text></View>
      </View>
      <TouchableOpacity style={styles.continueButton} onPress={() => openSentence(Math.max(0, firstPending))}><MaterialIcons color="#FFFFFF" name="mic" size={20} /><Text style={styles.continueText}>{recorded === project.sentences.length ? "查看并重录" : recorded ? "继续录制" : "开始录制"}</Text></TouchableOpacity>
      <View style={styles.listHeader}><Text style={styles.listTitle}>句子清单</Text><Text style={styles.listHint}>点击跳转 · 右侧分享</Text></View>
      <FlatList
        data={project.sentences}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.sentence}>
            <TouchableOpacity style={styles.sentenceMain} onPress={() => openSentence(index)}>
              <View style={[styles.status, item.recordingUri ? styles.statusDone : styles.statusPending]}><MaterialIcons color={item.recordingUri ? "#2F855A" : "#9AA5BC"} name={item.recordingUri ? "check" : "more-horiz"} size={17} /></View>
              <View style={styles.sentenceCopy}><Text numberOfLines={1} style={styles.lineText}>{item.rawText}</Text>{item.prompt ? <Text numberOfLines={1} style={styles.prompt}>{item.prompt}</Text> : null}</View>
              <Text style={styles.index}>{String(item.index).padStart(2, "0")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.share} onPress={() => shareSentence(item.recordingUri)}><MaterialIcons color={item.recordingUri ? "#2F4DA0" : "#B7C0D4"} name="share" size={20} /></TouchableOpacity>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18, paddingTop: 8 }, back: { alignItems: "center", height: 38, justifyContent: "center", width: 38 }, headerTitle: { color: "#182033", fontSize: 20, fontWeight: "800", maxWidth: 210 }, summary: { backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 18, borderWidth: 1, padding: 16 }, summaryTop: { alignItems: "center", flexDirection: "row", gap: 12 }, fileBadge: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 13, height: 46, justifyContent: "center", width: 46 }, summaryCopy: { flex: 1 }, projectName: { color: "#182033", fontSize: 17, fontWeight: "800" }, projectMeta: { color: "#65708A", fontSize: 13, marginTop: 5 }, summaryBottom: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 18 }, percent: { color: "#2F855A", fontSize: 19, fontWeight: "800" }, percentLabel: { color: "#65708A", fontSize: 11, marginTop: 1 }, track: { backgroundColor: "#E8EBF3", borderRadius: 99, flex: 1, height: 7, overflow: "hidden" }, progress: { backgroundColor: "#2F855A", borderRadius: 99, height: "100%" }, counter: { color: "#65708A", fontSize: 13, fontWeight: "700" }, continueButton: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 15, paddingVertical: 15 }, continueText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, listHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 23 }, listTitle: { color: "#182033", fontSize: 17, fontWeight: "800" }, listHint: { color: "#8A95AA", fontSize: 12 }, list: { gap: 9, paddingBottom: 10 }, sentence: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, flexDirection: "row", minHeight: 66, paddingLeft: 12 }, sentenceMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10, paddingVertical: 10 }, status: { alignItems: "center", borderRadius: 11, height: 27, justifyContent: "center", width: 27 }, statusDone: { backgroundColor: "#E3F4E9" }, statusPending: { backgroundColor: "#F0F2F6" }, sentenceCopy: { flex: 1 }, lineText: { color: "#26314A", fontSize: 15, fontWeight: "700" }, prompt: { color: "#7C879C", fontSize: 12, marginTop: 4 }, index: { color: "#9AA5BC", fontSize: 12, fontWeight: "800", marginRight: 8 }, share: { alignItems: "center", alignSelf: "stretch", borderLeftColor: "#EDF0F5", borderLeftWidth: 1, justifyContent: "center", width: 47 }, missing: { color: "#65708A", fontSize: 16 }, link: { color: "#2F4DA0", fontWeight: "800", marginTop: 12 },
});

