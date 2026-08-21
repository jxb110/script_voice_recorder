import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { getLanFileTransferStatus, startLanFileTransfer, stopLanFileTransfer, updateLanFileTransferData, type LanTransferStatus, type TransferredScript } from "@/lib/lan-file-transfer";
import { useAppLanguage } from "@/lib/i18n";
import { useRecorder } from "@/lib/recorder-context";

const EMPTY_STATUS: LanTransferStatus = { running: false, scripts: [] };

export default function FileTransferScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { projects, speakers } = useRecorder();
  const { language, t } = useAppLanguage();
  const [status, setStatus] = useState<LanTransferStatus>(() => getLanFileTransferStatus());
  const [starting, setStarting] = useState(false);
  const copy = language === "zh" ? {
    running: "局域网文件快传已开启", ready: "准备开启文件快传", opening: "正在读取局域网地址…", address: "在同一 Wi-Fi 的设备浏览器中打开", token: "读写口令", notice: "快传仅在本页开启且手机应用保持前台时有效。地址含有读写口令，请勿发送给不受信任的人。", received: "已接收脚本", receivedHint: "在其他设备上传后，选择一个脚本继续。", use: "使用", empty: "暂未接收 TXT 脚本。请在其他设备浏览器打开上方地址上传。", stop: "停止文件快传", startFailed: "无法启动文件快传。",
  } : {
    running: "Local file transfer is running", ready: "Ready to start file transfer", opening: "Reading local network address…", address: "Open this in a browser on the same Wi-Fi", token: "Read/write token", notice: "Transfer works only while this page is open and the app stays in the foreground. The address includes a read/write token; do not share it with untrusted devices.", received: "Received scripts", receivedHint: "After uploading on another device, choose one script to continue.", use: "Use", empty: "No TXT script received yet. Open the address above in another device browser to upload.", stop: "Stop file transfer", startFailed: "Unable to start file transfer.",
  };

  const refresh = useCallback(() => setStatus(getLanFileTransferStatus()), []);
  const start = useCallback(async () => {
    try { setStarting(true); setStatus(await startLanFileTransfer(projects, speakers)); }
    catch (error) { Alert.alert(t("fileTransfer"), error instanceof Error ? error.message : copy.startFailed); }
    finally { setStarting(false); }
  }, [copy.startFailed, projects, speakers, t]);
  const stop = () => { stopLanFileTransfer(); setStatus(EMPTY_STATUS); };
  const selectScript = (script: TransferredScript) => {
    const query = `transferUri=${encodeURIComponent(script.uri)}&transferName=${encodeURIComponent(script.name)}`;
    router.replace((projectId ? `/replace-script/${projectId}?${query}` : `/new-project?${query}`) as never);
  };

  useEffect(() => { updateLanFileTransferData(projects, speakers); }, [projects, speakers]);
  useEffect(() => { void start(); }, [start]);
  useEffect(() => { const interval = setInterval(refresh, 1100); return () => clearInterval(interval); }, [refresh]);

  return <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}>
    <View style={styles.page}>
      <View style={styles.header}><TouchableOpacity style={styles.headerButton} onPress={() => router.back()}><MaterialIcons color="#2F4DA0" name="arrow-back" size={23} /></TouchableOpacity><Text style={styles.title}>{t("fileTransfer")}</Text><View style={styles.headerButton} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}><View style={styles.heroIcon}><MaterialIcons color="#FFFFFF" name="wifi" size={30} /></View><Text style={styles.heroTitle}>{status.running ? copy.running : copy.ready}</Text><Text style={styles.heroText}>{t("fileTransferHint")}</Text></View>
        {starting ? <View style={styles.loading}><ActivityIndicator color="#2F4DA0" /><Text style={styles.loadingText}>{copy.opening}</Text></View> : status.running ? <>
          <View style={styles.addressCard}><Text style={styles.cardLabel}>{copy.address}</Text><Text selectable style={styles.address}>{status.address}/?token={status.token}</Text><View style={styles.tokenRow}><MaterialIcons color="#1E8B61" name="verified-user" size={18} /><Text style={styles.tokenText}>{copy.token}: {status.token}</Text></View></View>
          <View style={styles.notice}><MaterialIcons color="#2F4DA0" name="info-outline" size={20} /><Text style={styles.noticeText}>{copy.notice}</Text></View>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{copy.received}</Text><Text style={styles.sectionHint}>{copy.receivedHint}</Text></View><View style={styles.count}><Text style={styles.countText}>{status.scripts.length}</Text></View></View>
          {status.scripts.length ? <View style={styles.scriptList}>{status.scripts.map((script) => <View key={script.id} style={styles.script}><View style={styles.scriptIcon}><MaterialIcons color="#2F4DA0" name="description" size={22} /></View><View style={styles.scriptCopy}><Text numberOfLines={1} style={styles.scriptName}>{script.name}</Text><Text style={styles.scriptMeta}>{t("transferredScript")}</Text></View><TouchableOpacity style={styles.useButton} onPress={() => selectScript(script)}><Text style={styles.useText}>{copy.use}</Text></TouchableOpacity></View>)}</View> : <View style={styles.empty}><MaterialIcons color="#9AA5BC" name="upload-file" size={28} /><Text style={styles.emptyText}>{copy.empty}</Text></View>}
          <TouchableOpacity style={styles.stopButton} onPress={stop}><MaterialIcons color="#C34F5A" name="stop-circle" size={20} /><Text style={styles.stopText}>{copy.stop}</Text></TouchableOpacity>
        </> : <TouchableOpacity style={styles.startButton} onPress={start}><MaterialIcons color="#FFFFFF" name="wifi" size={21} /><Text style={styles.startText}>{t("openFileTransfer")}</Text></TouchableOpacity>}
      </ScrollView>
    </View>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 8 }, headerButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 }, title: { color: "#182033", fontSize: 20, fontWeight: "800" }, content: { paddingBottom: 28 }, hero: { alignItems: "center", backgroundColor: "#EEF3FF", borderRadius: 20, marginTop: 20, paddingHorizontal: 20, paddingVertical: 24 }, heroIcon: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 19, height: 52, justifyContent: "center", width: 52 }, heroTitle: { color: "#1D315F", fontSize: 19, fontWeight: "800", marginTop: 13 }, heroText: { color: "#65708A", fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: "center" }, loading: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 16, padding: 18 }, loadingText: { color: "#65708A", fontSize: 14, fontWeight: "700" }, addressCard: { backgroundColor: "#FFFFFF", borderColor: "#C9D7F5", borderRadius: 16, borderWidth: 1, marginTop: 16, padding: 16 }, cardLabel: { color: "#65708A", fontSize: 12, fontWeight: "800" }, address: { color: "#2F4DA0", fontSize: 16, fontWeight: "800", lineHeight: 24, marginTop: 8 }, tokenRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 12 }, tokenText: { color: "#1E8B61", fontSize: 13, fontWeight: "800" }, notice: { alignItems: "flex-start", backgroundColor: "#FFF8E8", borderRadius: 14, flexDirection: "row", gap: 9, marginTop: 12, padding: 13 }, noticeText: { color: "#6D5B2B", flex: 1, fontSize: 12, lineHeight: 19 }, sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 }, sectionTitle: { color: "#182033", fontSize: 17, fontWeight: "800" }, sectionHint: { color: "#65708A", fontSize: 12, marginTop: 3 }, count: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 14, height: 28, justifyContent: "center", minWidth: 28 }, countText: { color: "#2F4DA0", fontSize: 13, fontWeight: "800" }, scriptList: { gap: 9, marginTop: 13 }, script: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 11 }, scriptIcon: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 11, height: 38, justifyContent: "center", width: 38 }, scriptCopy: { flex: 1 }, scriptName: { color: "#26314A", fontSize: 14, fontWeight: "800" }, scriptMeta: { color: "#65708A", fontSize: 12, marginTop: 3 }, useButton: { backgroundColor: "#2F4DA0", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 }, useText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 15, borderStyle: "dashed", borderWidth: 1, gap: 8, marginTop: 13, padding: 24 }, emptyText: { color: "#65708A", fontSize: 13, lineHeight: 20, textAlign: "center" }, startButton: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 16, paddingVertical: 15 }, startText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, stopButton: { alignItems: "center", backgroundColor: "#FFF0F1", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 22, paddingVertical: 14 }, stopText: { color: "#C34F5A", fontSize: 15, fontWeight: "800" },
});
