import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { GlassSurface } from "@/components/liquid-glass";
import { ScreenContainer } from "@/components/screen-container";
import { getLanFileTransferStatus, startLanFileTransfer, stopLanFileTransfer, updateLanFileTransferData, type LanTransferStatus } from "@/lib/lan-file-transfer";
import { useAppLanguage } from "@/lib/i18n";
import { useRecorder } from "@/lib/recorder-context";

const EMPTY_STATUS = getLanFileTransferStatus();

export default function FileTransferScreen() {
  const router = useRouter();
  const { projects, speakers } = useRecorder();
  const { language, t } = useAppLanguage();
  const [status, setStatus] = useState<LanTransferStatus>(() => getLanFileTransferStatus());
  const [starting, setStarting] = useState(false);
  const didAutoStart = useRef(false);
  const copy = language === "zh" ? {
    running: "局域网文件管理已开启", ready: "准备开启文件管理", opening: "正在请求文件权限并确认端口监听…", address: "在同一 Wi-Fi 的设备浏览器中打开", token: "读写口令", directory: "默认录音目录", notice: "浏览器可从默认录音目录进入手机共享存储并管理文件。首次使用请在系统设置中允许“管理所有文件”；受保护的 Android/data 等目录仍不可访问。地址含有读写口令，请勿发送给不受信任的人。", stop: "停止文件管理", startFailed: "无法启动文件管理。", errorTitle: "文件管理未开始监听", retry: "重新监听端口",
  } : {
    running: "Local file manager is running", ready: "Ready to start file manager", opening: "Requesting file access and confirming the listening port…", address: "Open this in a browser on the same Wi-Fi", token: "Read/write token", directory: "Default recordings directory", notice: "From the recordings directory, the browser can browse and manage shared storage. On first use, allow “manage all files” in Android Settings; protected paths such as Android/data remain unavailable. The address includes a read/write token; do not share it with untrusted devices.", stop: "Stop file manager", startFailed: "Unable to start file manager.", errorTitle: "File manager is not listening", retry: "Retry port",
  };

  const refresh = useCallback(() => setStatus(getLanFileTransferStatus()), []);
  const start = useCallback(async () => {
    try { setStarting(true); setStatus(await startLanFileTransfer(projects, speakers)); }
    catch (error) { setStatus(getLanFileTransferStatus()); Alert.alert(t("fileTransfer"), error instanceof Error ? error.message : copy.startFailed); }
    finally { setStarting(false); }
  }, [copy.startFailed, projects, speakers, t]);
  const stop = () => { stopLanFileTransfer(); setStatus(EMPTY_STATUS); };
  useEffect(() => { updateLanFileTransferData(projects, speakers); }, [projects, speakers]);
  useEffect(() => { if (!didAutoStart.current) { didAutoStart.current = true; void start(); } }, [start]);
  useEffect(() => { const interval = setInterval(refresh, 1100); return () => clearInterval(interval); }, [refresh]);

  return <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}>
    <View style={styles.page}>
      <View style={styles.header}><TouchableOpacity style={[styles.headerButton, glass.headerButton]} onPress={() => router.back()}><MaterialIcons color="#4669DE" name="arrow-back" size={23} /></TouchableOpacity><Text style={[styles.title, glass.title]}>{t("fileTransfer")}</Text><View style={styles.headerButton} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassSurface style={[styles.hero, glass.hero]} intensity={34}><View style={styles.heroIcon}><MaterialIcons color="#FFFFFF" name="wifi" size={30} /></View><Text style={[styles.heroTitle, glass.heroTitle]}>{status.running ? copy.running : copy.ready}</Text><Text style={[styles.heroText, glass.heroText]}>{t("fileTransferHint")}</Text></GlassSurface>
        {starting || status.starting ? <GlassSurface style={[styles.loading, glass.loading]} intensity={28}><ActivityIndicator color="#4669DE" /><Text style={[styles.loadingText, glass.loadingText]}>{copy.opening}</Text></GlassSurface> : status.running ? <>
          <GlassSurface style={[styles.addressCard, glass.addressCard]} intensity={34}><Text style={[styles.cardLabel, glass.cardLabel]}>{copy.address}</Text><Text selectable style={[styles.address, glass.address]}>{status.address}/?token={status.token}</Text><View style={styles.tokenRow}><MaterialIcons color="#1E8B61" name="verified-user" size={18} /><Text style={styles.tokenText}>{copy.token}: {status.token} · {status.port}</Text></View><View style={[styles.directoryRow, glass.directoryRow]}><MaterialIcons color="#4669DE" name="folder" size={17} /><View style={styles.directoryCopy}><Text style={[styles.directoryLabel, glass.directoryLabel]}>{copy.directory}</Text><Text selectable style={[styles.directoryPath, glass.directoryPath]}>/storage/emulated/0/{status.defaultDirectory}</Text></View></View></GlassSurface>
          <View style={[styles.notice, glass.notice]}><MaterialIcons color="#4669DE" name="info-outline" size={20} /><Text style={[styles.noticeText, glass.noticeText]}>{copy.notice}</Text></View>
          <TouchableOpacity style={[styles.stopButton, glass.stopButton]} onPress={stop}><MaterialIcons color="#C34F5A" name="stop-circle" size={20} /><Text style={styles.stopText}>{copy.stop}</Text></TouchableOpacity>
        </> : <>{status.error ? <View style={[styles.errorCard, glass.errorCard]}><MaterialIcons color="#C34F5A" name="error-outline" size={22} /><View style={styles.errorCopy}><Text style={styles.errorTitle}>{copy.errorTitle}</Text><Text style={styles.errorText}>{status.error}</Text></View></View> : null}<TouchableOpacity style={[styles.startButton, glass.startButton]} onPress={start}><MaterialIcons color="#FFFFFF" name="wifi" size={21} /><Text style={styles.startText}>{status.error ? copy.retry : t("openFileTransfer")}</Text></TouchableOpacity></>}
      </ScrollView>
    </View>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 8 }, headerButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 }, title: { color: "#182033", fontSize: 20, fontWeight: "800" }, content: { paddingBottom: 28 }, hero: { alignItems: "center", backgroundColor: "#EEF3FF", borderRadius: 20, marginTop: 20, paddingHorizontal: 20, paddingVertical: 24 }, heroIcon: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 19, height: 52, justifyContent: "center", width: 52 }, heroTitle: { color: "#1D315F", fontSize: 19, fontWeight: "800", marginTop: 13 }, heroText: { color: "#65708A", fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: "center" }, loading: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 16, padding: 18 }, loadingText: { color: "#65708A", fontSize: 14, fontWeight: "700" }, addressCard: { backgroundColor: "#FFFFFF", borderColor: "#C9D7F5", borderRadius: 16, borderWidth: 1, marginTop: 16, padding: 16 }, cardLabel: { color: "#65708A", fontSize: 12, fontWeight: "800" }, address: { color: "#2F4DA0", fontSize: 16, fontWeight: "800", lineHeight: 24, marginTop: 8 }, tokenRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 12 }, tokenText: { color: "#1E8B61", fontSize: 13, fontWeight: "800" }, directoryRow: { alignItems: "flex-start", backgroundColor: "#F3F6FE", borderRadius: 10, flexDirection: "row", gap: 7, marginTop: 12, padding: 10 }, directoryCopy: { flex: 1 }, directoryLabel: { color: "#52617B", fontSize: 11, fontWeight: "900" }, directoryPath: { color: "#2F4DA0", fontFamily: "monospace", fontSize: 12, lineHeight: 18, marginTop: 2 }, notice: { alignItems: "flex-start", backgroundColor: "#FFF8E8", borderRadius: 14, flexDirection: "row", gap: 9, marginTop: 12, padding: 13 }, noticeText: { color: "#6D5B2B", flex: 1, fontSize: 12, lineHeight: 19 }, errorCard: { alignItems: "flex-start", backgroundColor: "#FFF0F1", borderColor: "#F2C9CE", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 16, padding: 14 }, errorCopy: { flex: 1 }, errorTitle: { color: "#A13645", fontSize: 14, fontWeight: "800" }, errorText: { color: "#8C4A56", fontSize: 12, lineHeight: 18, marginTop: 3 }, sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 }, sectionTitle: { color: "#182033", fontSize: 17, fontWeight: "800" }, sectionHint: { color: "#65708A", fontSize: 12, marginTop: 3 }, count: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 14, height: 28, justifyContent: "center", minWidth: 28 }, countText: { color: "#2F4DA0", fontSize: 13, fontWeight: "800" }, scriptList: { gap: 9, marginTop: 13 }, script: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 11 }, scriptIcon: { alignItems: "center", backgroundColor: "#EAF0FF", borderRadius: 11, height: 38, justifyContent: "center", width: 38 }, scriptCopy: { flex: 1 }, scriptName: { color: "#26314A", fontSize: 14, fontWeight: "800" }, scriptMeta: { color: "#65708A", fontSize: 12, marginTop: 3 }, useButton: { backgroundColor: "#2F4DA0", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 }, useText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 15, borderStyle: "dashed", borderWidth: 1, gap: 8, marginTop: 13, padding: 24 }, emptyText: { color: "#65708A", fontSize: 13, lineHeight: 20, textAlign: "center" }, startButton: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 16, paddingVertical: 15 }, startText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, stopButton: { alignItems: "center", backgroundColor: "#FFF0F1", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 22, paddingVertical: 14 }, stopText: { color: "#C34F5A", fontSize: 15, fontWeight: "800" },
});

const glass = StyleSheet.create({
  headerButton: { backgroundColor: "rgba(255,255,255,0.58)", borderColor: "rgba(255,255,255,0.88)", borderRadius: 13, borderWidth: 1, elevation: 2, shadowColor: "#5977AE", shadowOpacity: 0.12, shadowRadius: 10 }, title: { color: "#182B55" },
  hero: { borderRadius: 24 }, heroTitle: { color: "#1F3A75" }, heroText: { color: "#61749E" }, loading: { borderRadius: 18 }, loadingText: { color: "#61749E" },
  addressCard: { borderRadius: 22 }, cardLabel: { color: "#61749E" }, address: { color: "#4669DE" }, directoryRow: { backgroundColor: "rgba(233,241,255,0.68)", borderColor: "rgba(255,255,255,0.8)", borderWidth: 1 }, directoryLabel: { color: "#526A9F" }, directoryPath: { color: "#4669DE" },
  notice: { backgroundColor: "rgba(255,247,220,0.64)", borderColor: "rgba(255,255,255,0.82)", borderWidth: 1 }, noticeText: { color: "#6D5B2B" }, errorCard: { backgroundColor: "rgba(255,239,243,0.72)", borderColor: "rgba(255,255,255,0.82)" }, stopButton: { backgroundColor: "rgba(255,238,242,0.72)", borderColor: "rgba(255,255,255,0.84)", borderWidth: 1 }, startButton: { backgroundColor: "#4B6FE6", borderColor: "rgba(255,255,255,0.78)", borderWidth: 1, shadowColor: "#3D5FAE", shadowOpacity: 0.23, shadowRadius: 16 },
});
