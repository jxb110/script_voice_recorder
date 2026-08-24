import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { GlassSurface } from "@/components/liquid-glass";
import { useSyncRoom } from "@/lib/sync-room-context";
import type { SyncRecordingState } from "@/lib/lan-sync-protocol";

type SyncRoomPanelProps = { projectSyncKey: string; language: "zh" | "en"; onOpenRecording: () => void };

const copyByLanguage = {
  zh: {
    title: "多设备同步录音", subtitle: "同一 Wi‑Fi / 主控热点 · 仅局域网", deviceName: "设备名称", create: "创建主控房间", join: "加入已有房间", address: "主控地址", roomCode: "房间口令", waiting: "已连接主控，等待同步指令", hostReady: "主控房间已就绪", open: "进入同步录制", leave: "关闭同步", invalidRoom: "当前任务与已连接房间不匹配。请先关闭原有同步会话。", hostHint: "让其他设备在同一任务中输入下方地址和口令即可加入。", joinHint: "每台客户端均需先创建同一录音脚本任务。", connected: "在线", disconnected: "离线", latency: "延迟", error: "同步连接失败", copyAddress: "地址已复制", share: "共享地址", status: "设备状态", state: { idle: "等待指令", leading: "首端静音", recording: "录制中", trailing: "尾端静音", saving: "保存中", playing: "播放中", error: "异常" },
  },
  en: {
    title: "Multi-device sync", subtitle: "Same Wi-Fi / controller hotspot · LAN only", deviceName: "Device name", create: "Create controller room", join: "Join controller room", address: "Controller address", roomCode: "Room code", waiting: "Connected to controller. Waiting for commands.", hostReady: "Controller room is ready", open: "Open sync recording", leave: "Stop sync", invalidRoom: "This task does not match the connected room. Stop the active sync session first.", hostHint: "On the same task, enter the address and room code below on each client device.", joinHint: "Each client must first create a task from the same recording script.", connected: "Online", disconnected: "Offline", latency: "Latency", error: "Unable to connect sync room", copyAddress: "Address copied", share: "Share address", status: "Device status", state: { idle: "Waiting", leading: "Leading silence", recording: "Recording", trailing: "Trailing silence", saving: "Saving", playing: "Playing", error: "Error" },
  },
} as const;

type SyncPanelCopy = (typeof copyByLanguage)[keyof typeof copyByLanguage];

export function SyncRoomPanel({ projectSyncKey, language, onOpenRecording }: SyncRoomPanelProps) {
  const copy = copyByLanguage[language];
  const { status, hostRoom, joinRoom, leaveRoom } = useSyncRoom();
  const [deviceName, setDeviceName] = useState(language === "zh" ? "录音设备" : "Recording device");
  const [showJoin, setShowJoin] = useState(false);
  const [address, setAddress] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [working, setWorking] = useState(false);
  const activeForProject = status.mode !== "idle" && status.projectId === projectSyncKey;
  const activeElsewhere = status.mode !== "idle" && !activeForProject;

  const startHost = async () => {
    setWorking(true);
    try { await hostRoom({ projectId: projectSyncKey, deviceName }); }
    catch (error) { Alert.alert(copy.error, error instanceof Error ? error.message : copy.error); }
    finally { setWorking(false); }
  };
  const join = async () => {
    setWorking(true);
    try { await joinRoom({ address, roomCode, projectId: projectSyncKey, deviceName }); }
    catch (error) { Alert.alert(copy.error, error instanceof Error ? error.message : copy.error); }
    finally { setWorking(false); }
  };

  return (
    <GlassSurface intensity={34} style={styles.card}>
      <View style={styles.heading}><View style={styles.icon}><MaterialIcons color="#4669DE" name="sensors" size={21} /></View><View style={styles.headingCopy}><Text style={styles.title}>{copy.title}</Text><Text style={styles.subtitle}>{copy.subtitle}</Text></View><View style={[styles.modeBadge, status.mode === "host" ? styles.hostBadge : status.mode === "client" ? styles.clientBadge : styles.idleBadge]}><Text style={styles.modeBadgeText}>{status.mode === "host" ? "HOST" : status.mode === "client" ? "CLIENT" : "LAN"}</Text></View></View>
      {activeElsewhere ? <Text style={styles.notice}>{copy.invalidRoom}</Text> : activeForProject ? <ActiveRoom copy={copy} onLeave={leaveRoom} onOpenRecording={onOpenRecording} status={status} /> : <>
        <TextInput editable={!working} onChangeText={setDeviceName} placeholder={copy.deviceName} placeholderTextColor="#8290AB" style={styles.input} value={deviceName} />
        {showJoin ? <View style={styles.joinFields}><TextInput autoCapitalize="none" editable={!working} onChangeText={setAddress} placeholder={copy.address} placeholderTextColor="#8290AB" style={styles.input} value={address} /><TextInput autoCapitalize="characters" editable={!working} maxLength={6} onChangeText={setRoomCode} placeholder={copy.roomCode} placeholderTextColor="#8290AB" style={styles.input} value={roomCode} /></View> : null}
        <View style={styles.actionRow}><TouchableOpacity disabled={working} onPress={startHost} style={[styles.primaryButton, working && styles.disabled]}><MaterialIcons color="#FFFFFF" name="wifi-tethering" size={18} /><Text style={styles.primaryText}>{copy.create}</Text></TouchableOpacity><TouchableOpacity disabled={working} onPress={() => showJoin ? void join() : setShowJoin(true)} style={[styles.secondaryButton, working && styles.disabled]}><MaterialIcons color="#4669DE" name={showJoin ? "login" : "add-link"} size={18} /><Text style={styles.secondaryText}>{copy.join}</Text></TouchableOpacity></View>
        <Text style={styles.hint}>{showJoin ? copy.joinHint : copy.hostHint}</Text>
      </>}
    </GlassSurface>
  );
}

function ActiveRoom({ copy, status, onOpenRecording, onLeave }: { copy: SyncPanelCopy; status: ReturnType<typeof useSyncRoom>["status"]; onOpenRecording: () => void; onLeave: () => void }) {
  const isHost = status.mode === "host";
  return <><View style={styles.statusLine}><View style={styles.statusDot} /><Text style={styles.statusText}>{isHost ? copy.hostReady : copy.waiting}</Text></View>{isHost ? <><View style={styles.connectionCard}><Text style={styles.connectionLabel}>{copy.address}</Text><Text selectable style={styles.connectionValue}>{status.address}</Text><Text style={styles.connectionLabel}>{copy.roomCode}</Text><Text selectable style={styles.roomCode}>{status.roomCode}</Text></View><Text style={styles.hint}>{copy.hostHint}</Text></> : <Text style={styles.hint}>{copy.joinHint}</Text>}<View style={styles.deviceTitleRow}><Text style={styles.deviceTitle}>{copy.status}</Text><Text style={styles.deviceCount}>{status.devices.length}</Text></View>{status.devices.map((device) => { const offline = device.detail === "offline"; return <View key={device.id} style={styles.device}><View style={[styles.deviceDot, offline || device.state === "error" ? styles.errorDot : styles.onlineDot]} /><View style={styles.deviceCopy}><Text style={styles.deviceName}>{device.name}{device.role === "host" ? " · HOST" : ""}</Text><Text style={styles.deviceState}>{offline ? copy.disconnected : copy.state[device.state as SyncRecordingState]} · #{String(device.sentenceIndex + 1).padStart(3, "0")}{device.latencyMs !== undefined ? ` · ${copy.latency} ${device.latencyMs}ms` : ""}</Text></View><Text style={[styles.onlineText, (offline || device.state === "error") && styles.errorText]}>{offline ? copy.disconnected : device.state === "error" ? copy.state.error : copy.connected}</Text></View>; })}{isHost ? <TouchableOpacity onPress={onOpenRecording} style={styles.openButton}><MaterialIcons color="#FFFFFF" name="mic" size={19} /><Text style={styles.primaryText}>{copy.open}</Text></TouchableOpacity> : null}<TouchableOpacity onPress={onLeave} style={styles.leaveButton}><Text style={styles.leaveText}>{copy.leave}</Text></TouchableOpacity></>;
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 14 }, heading: { alignItems: "center", flexDirection: "row" }, icon: { alignItems: "center", backgroundColor: "rgba(218,231,255,0.88)", borderRadius: 13, height: 40, justifyContent: "center", width: 40 }, headingCopy: { flex: 1, marginLeft: 10 }, title: { color: "#182B55", fontSize: 16, fontWeight: "800" }, subtitle: { color: "#6C7E9E", fontSize: 11, marginTop: 2 }, modeBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }, idleBadge: { backgroundColor: "rgba(116,137,176,0.14)" }, hostBadge: { backgroundColor: "rgba(70,105,222,0.17)" }, clientBadge: { backgroundColor: "rgba(72,174,123,0.16)" }, modeBadgeText: { color: "#4669DE", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }, notice: { color: "#9A5B25", fontSize: 12, lineHeight: 18, marginTop: 13 }, input: { backgroundColor: "rgba(255,255,255,0.56)", borderColor: "rgba(255,255,255,0.9)", borderRadius: 12, borderWidth: 1, color: "#263D70", fontSize: 14, fontWeight: "700", marginTop: 12, paddingHorizontal: 12, paddingVertical: 10 }, joinFields: { gap: 0 }, actionRow: { flexDirection: "row", gap: 8, marginTop: 10 }, primaryButton: { alignItems: "center", backgroundColor: "#4B6FE6", borderRadius: 13, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 11 }, secondaryButton: { alignItems: "center", backgroundColor: "rgba(224,235,255,0.74)", borderColor: "rgba(255,255,255,0.88)", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 11 }, disabled: { opacity: 0.55 }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, secondaryText: { color: "#4669DE", fontSize: 13, fontWeight: "800" }, hint: { color: "#6E7E9E", fontSize: 11, lineHeight: 16, marginTop: 10 }, statusLine: { alignItems: "center", backgroundColor: "rgba(222,246,234,0.68)", borderRadius: 10, flexDirection: "row", marginTop: 12, paddingHorizontal: 10, paddingVertical: 8 }, statusDot: { backgroundColor: "#43B77B", borderRadius: 5, height: 9, marginRight: 7, width: 9 }, statusText: { color: "#24734D", flex: 1, fontSize: 12, fontWeight: "800" }, connectionCard: { backgroundColor: "rgba(255,255,255,0.48)", borderColor: "rgba(255,255,255,0.82)", borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 11 }, connectionLabel: { color: "#7182A1", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginTop: 4 }, connectionValue: { color: "#273E74", fontSize: 13, fontWeight: "800", marginTop: 2 }, roomCode: { color: "#4669DE", fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "900", letterSpacing: 3, marginTop: 2 }, deviceTitleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 13 }, deviceTitle: { color: "#263D70", fontSize: 13, fontWeight: "800" }, deviceCount: { backgroundColor: "rgba(70,105,222,0.13)", borderRadius: 9, color: "#4669DE", fontSize: 11, fontWeight: "900", minWidth: 24, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 3, textAlign: "center" }, device: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.76)", borderRadius: 11, borderWidth: 1, flexDirection: "row", marginTop: 7, paddingHorizontal: 10, paddingVertical: 9 }, deviceDot: { borderRadius: 5, height: 9, marginRight: 8, width: 9 }, onlineDot: { backgroundColor: "#43B77B" }, errorDot: { backgroundColor: "#D75C67" }, deviceCopy: { flex: 1 }, deviceName: { color: "#263D70", fontSize: 13, fontWeight: "800" }, deviceState: { color: "#7182A1", fontSize: 11, marginTop: 2 }, onlineText: { color: "#2D9561", fontSize: 10, fontWeight: "800" }, errorText: { color: "#C34F5A" }, openButton: { alignItems: "center", backgroundColor: "#4B6FE6", borderRadius: 13, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 12, paddingVertical: 12 }, leaveButton: { alignItems: "center", marginTop: 11, paddingVertical: 5 }, leaveText: { color: "#9B6573", fontSize: 12, fontWeight: "800" },
});
