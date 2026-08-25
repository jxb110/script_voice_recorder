import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import QRCode from "react-native-qrcode-svg";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import { GlassSurface } from "@/components/liquid-glass";
import { SyncQrScanner } from "@/components/sync-qr-scanner";
import { LAN_SYNC_PORT, createSyncRoomInvite, type SyncRecordingState } from "@/lib/lan-sync-protocol";
import type { LanSyncStatus } from "@/lib/lan-sync";
import { useSyncRoom } from "@/lib/sync-room-context";

type SyncRoomPanelProps = { projectSyncKey: string; language: "zh" | "en"; onOpenRecording: () => void; onJoinIntentChange?: (joining: boolean) => void };

const copyByLanguage = {
  zh: { title: "多设备同步录音", subtitle: "同一 Wi‑Fi / 主控热点 · 仅局域网", deviceName: "设备名称", create: "创建主控房间", join: "加入已有房间", address: "主控 IP", port: "端口", roomCode: "房间口令", scan: "扫码填充", qrTitle: "同步房间二维码", qrHint: "点击二维码放大；客户端可扫码加入", waiting: "已连接主控，等待同步指令", hostReady: "主控房间已就绪", waitForClient: "请先等待至少一台客户端成功加入房间", open: "进入同步录制", leave: "关闭同步", close: "关闭", hostHint: "让其他设备在同一任务中输入上方 IP、端口和口令即可加入。", joinHint: "每台客户端均需先创建同一录音脚本任务。", connected: "在线", disconnected: "离线", latency: "延迟", error: "同步连接失败", status: "设备状态", removeDevice: "移除录音设备？", removeDeviceHint: (name: string) => `将“${name}”移出当前同步房间。`, remove: "移除", cancel: "取消", state: { idle: "等待指令", leading: "首端静音", recording: "录制中", trailing: "尾端静音", saving: "保存中", playing: "播放中", error: "异常" } },
  en: { title: "Multi-device sync", subtitle: "Same Wi-Fi / controller hotspot · LAN only", deviceName: "Device name", create: "Create controller room", join: "Join controller room", address: "Controller IP", port: "Port", roomCode: "Room code", scan: "Scan QR", qrTitle: "Sync room QR code", qrHint: "Tap to enlarge; clients can scan to join", waiting: "Connected to controller. Waiting for commands.", hostReady: "Controller room is ready", waitForClient: "Wait for at least one client to join this room.", open: "Open sync recording", leave: "Stop sync", close: "Close", hostHint: "On the same task, enter the IP, port and room code above on each client device.", joinHint: "Each client must first create a task from the same recording script.", connected: "Online", disconnected: "Offline", latency: "Latency", error: "Unable to connect sync room", status: "Device status", removeDevice: "Remove recording device?", removeDeviceHint: (name: string) => `Remove “${name}” from this sync room.`, remove: "Remove", cancel: "Cancel", state: { idle: "Waiting", leading: "Leading silence", recording: "Recording", trailing: "Trailing silence", saving: "Saving", playing: "Playing", error: "Error" } },
} as const;
type SyncPanelCopy = (typeof copyByLanguage)[keyof typeof copyByLanguage];

export function SyncRoomPanel({ projectSyncKey, language, onOpenRecording, onJoinIntentChange }: SyncRoomPanelProps) {
  const copy = copyByLanguage[language];
  const { height: windowHeight } = useWindowDimensions();
  const { status, hostRoom, joinRoom, leaveRoom, removeClient } = useSyncRoom();
  const [deviceName, setDeviceName] = useState(language === "zh" ? "录音设备" : "Recording device");
  const [showJoin, setShowJoin] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(String(LAN_SYNC_PORT));
  const [roomCode, setRoomCode] = useState("");
  const [inviteProjectSyncKey, setInviteProjectSyncKey] = useState("");
  const [inviteVersion, setInviteVersion] = useState<number | undefined>();
  const [working, setWorking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [hostSnapshot, setHostSnapshot] = useState<LanSyncStatus | null>(null);
  const roomProjectKey = inviteProjectSyncKey || projectSyncKey;
  const displayStatus = hostSnapshot?.mode === "host" ? hostSnapshot : status;
  const visibleMode = displayStatus.mode;
  const activeForProject = visibleMode !== "idle" && (displayStatus.projectId === roomProjectKey || visibleMode === "client");
  const invite = visibleMode === "host" && displayStatus.address && displayStatus.roomCode && displayStatus.projectId ? createSyncRoomInvite(displayStatus.address, displayStatus.roomCode, displayStatus.projectId) : null;
  const activeBodyMaxHeight = Math.max(250, windowHeight - 218);

  useEffect(() => { onJoinIntentChange?.(showJoin); }, [onJoinIntentChange, showJoin]);
  useEffect(() => {
    if (status.mode === "host") setHostSnapshot(status);
    else if (status.mode === "idle") setHostSnapshot(null);
  }, [status]);
  useEffect(() => { if (displayStatus.mode === "host") setExpanded(true); }, [displayStatus.mode]);

  const startHost = async () => {
    setHostSnapshot(null);
    setShowJoin(false);
    setHost("");
    setPort(String(LAN_SYNC_PORT));
    setRoomCode("");
    setInviteProjectSyncKey("");
    setInviteVersion(undefined);
    setShowQr(false);
    setShowScanner(false);
    onJoinIntentChange?.(false);
    setWorking(true);
    try {
      const next = await hostRoom({ projectId: projectSyncKey, deviceName });
      setHostSnapshot(next);
      setExpanded(true);
    } catch (error) {
      Alert.alert(copy.error, error instanceof Error ? error.message : copy.error);
    } finally {
      setWorking(false);
    }
  };
  const join = async () => {
    setWorking(true);
    try {
      await joinRoom({ host, port, roomCode, projectId: roomProjectKey, deviceName, inviteVersion });
      setExpanded(true);
    } catch (error) {
      Alert.alert(copy.error, error instanceof Error ? error.message : copy.error);
    } finally {
      setWorking(false);
    }
  };
  const closeRoom = () => {
    leaveRoom();
    setHostSnapshot(null);
    setShowJoin(false);
    setHost("");
    setPort(String(LAN_SYNC_PORT));
    setRoomCode("");
    setInviteProjectSyncKey("");
    setInviteVersion(undefined);
    setShowQr(false);
    setShowScanner(false);
    setExpanded(false);
    onJoinIntentChange?.(false);
  };
  const cancelJoin = () => { setShowJoin(false); setInviteProjectSyncKey(""); setInviteVersion(undefined); setExpanded(false); onJoinIntentChange?.(false); };
  const applyInvite = (next: { host: string; port: number; roomCode: string; projectSyncKey?: string; version: number }) => { setHost(next.host); setPort(String(next.port)); setRoomCode(next.roomCode); setInviteProjectSyncKey(next.projectSyncKey ?? ""); setInviteVersion(next.version); setShowJoin(true); setShowScanner(false); };

  return <><GlassSurface intensity={34} style={styles.card}>
    <TouchableOpacity activeOpacity={0.72} onPress={() => setExpanded((value) => !value)} style={styles.heading}>
      <View style={styles.icon}><MaterialIcons color="#4669DE" name="sensors" size={21} /></View><View style={styles.headingCopy}><Text style={styles.title}>{copy.title}</Text><Text numberOfLines={1} style={styles.subtitle}>{!expanded && activeForProject ? `${displayStatus.devices.filter((device) => device.role === "client").length} ${copy.status}` : copy.subtitle}</Text></View><View style={[styles.modeBadge, visibleMode === "host" ? styles.hostBadge : visibleMode === "client" ? styles.clientBadge : styles.idleBadge]}><Text style={styles.modeBadgeText}>{visibleMode === "host" ? "HOST" : visibleMode === "client" ? "CLIENT" : "LAN"}</Text></View><MaterialIcons color="#61749E" name={expanded ? "expand-less" : "expand-more"} size={22} style={styles.expandIcon} />
    </TouchableOpacity>
    {!expanded ? null : activeForProject ? <ScrollView nestedScrollEnabled persistentScrollbar showsVerticalScrollIndicator style={[styles.activeBody, { maxHeight: activeBodyMaxHeight }]} contentContainerStyle={styles.activeBodyContent}><ActiveRoom copy={copy} invite={invite} onLeave={closeRoom} onOpenRecording={onOpenRecording} onRemoveClient={removeClient} onShowQr={() => setShowQr(true)} status={displayStatus} /></ScrollView> : <>
      <TextInput editable={!working} onChangeText={setDeviceName} placeholder={copy.deviceName} placeholderTextColor="#8290AB" style={styles.input} value={deviceName} />
      {showJoin ? <View style={styles.joinFields}><View style={styles.endpointRow}><TextInput autoCapitalize="none" autoCorrect={false} editable={!working} keyboardType="decimal-pad" onChangeText={setHost} placeholder={copy.address} placeholderTextColor="#8290AB" style={[styles.input, styles.hostInput]} value={host} /><TextInput editable={!working} keyboardType="number-pad" maxLength={5} onChangeText={setPort} placeholder={copy.port} placeholderTextColor="#8290AB" style={[styles.input, styles.portInput]} value={port} /></View><TextInput autoCapitalize="characters" editable={!working} maxLength={6} onChangeText={setRoomCode} placeholder={copy.roomCode} placeholderTextColor="#8290AB" style={styles.input} value={roomCode} /><TouchableOpacity onPress={() => setShowScanner(true)} style={styles.scanButton}><MaterialIcons color="#4669DE" name="qr-code-scanner" size={19} /><Text style={styles.scanText}>{copy.scan}</Text></TouchableOpacity></View> : null}
      <View style={styles.actionRow}><TouchableOpacity disabled={working} onPress={startHost} style={[styles.primaryButton, working && styles.disabled]}><MaterialIcons color="#FFFFFF" name="wifi-tethering" size={18} /><Text style={styles.primaryText}>{copy.create}</Text></TouchableOpacity><TouchableOpacity disabled={working} onPress={() => showJoin ? void join() : setShowJoin(true)} style={[styles.secondaryButton, working && styles.disabled]}><MaterialIcons color="#4669DE" name={showJoin ? "login" : "add-link"} size={18} /><Text style={styles.secondaryText}>{copy.join}</Text></TouchableOpacity></View>
      <Text style={styles.hint}>{showJoin ? copy.joinHint : copy.hostHint}</Text>
      {showJoin ? <CloseSyncButton disabled={working} label={copy.leave} onPress={cancelJoin} /> : null}
      {displayStatus.error ? <Text style={styles.errorNotice}>{displayStatus.error}</Text> : null}
    </>}
  </GlassSurface><SyncQrScanner language={language} onClose={() => setShowScanner(false)} onInvite={applyInvite} visible={showScanner} /><QrPreview copy={copy} invite={invite} onClose={() => setShowQr(false)} visible={showQr} /></>;
}

function ActiveRoom({ copy, invite, status, onOpenRecording, onLeave, onRemoveClient, onShowQr }: { copy: SyncPanelCopy; invite: string | null; status: LanSyncStatus; onOpenRecording: () => void; onLeave: () => void; onRemoveClient: (deviceId: string) => void; onShowQr: () => void }) {
  const isHost = status.mode === "host";
  const onlineClients = useMemo(() => status.devices.filter((device) => device.role === "client" && device.detail !== "offline" && device.state !== "error"), [status.devices]);
  const visibleDevices = useMemo(() => isHost ? status.devices.filter((device) => device.role === "client") : status.devices.filter((device) => device.id !== status.self.id), [isHost, status.devices, status.self.id]);
  const canOpenRecording = onlineClients.length > 0;
  const confirmRemove = (device: LanSyncStatus["devices"][number]) => Alert.alert(copy.removeDevice, copy.removeDeviceHint(device.name), [{ text: copy.cancel, style: "cancel" }, { text: copy.remove, style: "destructive", onPress: () => { try { onRemoveClient(device.id); } catch (error) { Alert.alert(copy.error, error instanceof Error ? error.message : copy.error); } } }]);
  return <><View style={styles.statusLine}><View style={styles.statusDot} /><Text style={styles.statusText}>{isHost ? copy.hostReady : copy.waiting}</Text></View>
    {isHost ? <><View style={styles.connectionCard}><Text style={styles.connectionLabel}>{copy.address}</Text><Text selectable style={styles.connectionValue}>{status.address}</Text><Text style={styles.connectionLabel}>{copy.roomCode}</Text><Text selectable style={styles.roomCode}>{status.roomCode}</Text></View>{invite ? <TouchableOpacity activeOpacity={0.8} onPress={onShowQr} style={styles.inviteCard}><View style={styles.qrFrame}><QRCode backgroundColor="#FFFFFF" color="#274B9B" size={70} value={invite} /></View><View style={styles.inviteCopy}><Text style={styles.inviteTitle}>{copy.qrTitle}</Text><Text style={styles.inviteHint}>{copy.qrHint}</Text></View><MaterialIcons color="#4669DE" name="open-in-full" size={19} /></TouchableOpacity> : null}<Text style={styles.hint}>{copy.hostHint}</Text></> : <Text style={styles.hint}>{copy.joinHint}</Text>}
    <View style={styles.deviceTitleRow}><Text style={styles.deviceTitle}>{copy.status}</Text><Text style={styles.deviceCount}>{visibleDevices.length}</Text></View>{visibleDevices.map((device) => <DeviceRow copy={copy} device={device} key={device.id} onRemove={isHost && device.role === "client" ? () => confirmRemove(device) : undefined} />)}
    {isHost ? <><TouchableOpacity disabled={!canOpenRecording} onPress={onOpenRecording} style={[styles.openButton, !canOpenRecording && styles.openButtonDisabled]}><MaterialIcons color="#FFFFFF" name="mic" size={19} /><Text style={styles.primaryText}>{copy.open}</Text></TouchableOpacity>{!canOpenRecording ? <Text style={styles.waitingClientHint}>{copy.waitForClient}</Text> : null}</> : null}
    <CloseSyncButton label={copy.leave} onPress={onLeave} />
  </>;
}

function CloseSyncButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.leaveButton, disabled && styles.disabled]}><MaterialIcons color="#B54B58" name="link-off" size={17} /><Text style={styles.leaveText}>{label}</Text></TouchableOpacity>;
}

function DeviceRow({ copy, device, onRemove }: { copy: SyncPanelCopy; device: ReturnType<typeof useSyncRoom>["status"]["devices"][number]; onRemove?: () => void }) {
  const offline = device.detail === "offline";
  return <View style={styles.device}><View style={[styles.deviceDot, offline || device.state === "error" ? styles.errorDot : styles.onlineDot]} /><View style={styles.deviceCopy}><Text numberOfLines={1} style={styles.deviceName}>{device.name}</Text><Text numberOfLines={1} style={styles.deviceState}>{offline ? copy.disconnected : copy.state[device.state as SyncRecordingState]} · #{String(device.sentenceIndex + 1).padStart(3, "0")}{device.latencyMs !== undefined ? ` · ${copy.latency} ${device.latencyMs}ms` : ""}</Text></View><Text style={[styles.onlineText, (offline || device.state === "error") && styles.errorText]}>{offline ? copy.disconnected : device.state === "error" ? copy.state.error : copy.connected}</Text>{onRemove ? <TouchableOpacity accessibilityLabel={`${copy.remove} ${device.name}`} onPress={onRemove} style={styles.removeDevice}><MaterialIcons color="#C34F5A" name="delete-outline" size={20} /></TouchableOpacity> : null}</View>;
}

function QrPreview({ copy, invite, onClose, visible }: { copy: SyncPanelCopy; invite: string | null; onClose: () => void; visible: boolean }) {
  if (!invite) return null;
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}><View style={styles.modalBackdrop}><View style={styles.qrModal}><Text style={styles.qrModalTitle}>{copy.qrTitle}</Text><Text style={styles.qrModalHint}>{copy.qrHint}</Text><View style={styles.qrLarge}><QRCode backgroundColor="#FFFFFF" color="#274B9B" size={232} value={invite} /></View><TouchableOpacity onPress={onClose} style={styles.qrClose}><Text style={styles.qrCloseText}>{copy.close}</Text></TouchableOpacity></View></View></Modal>;
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 13 }, heading: { alignItems: "center", flexDirection: "row" }, icon: { alignItems: "center", backgroundColor: "rgba(218,231,255,0.88)", borderRadius: 13, height: 40, justifyContent: "center", width: 40 }, headingCopy: { flex: 1, marginLeft: 10 }, title: { color: "#182B55", fontSize: 16, fontWeight: "800" }, subtitle: { color: "#6C7E9E", fontSize: 11, marginTop: 2 }, expandIcon: { marginLeft: 3 }, modeBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }, idleBadge: { backgroundColor: "rgba(116,137,176,0.14)" }, hostBadge: { backgroundColor: "rgba(70,105,222,0.17)" }, clientBadge: { backgroundColor: "rgba(72,174,123,0.16)" }, modeBadgeText: { color: "#4669DE", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }, activeBody: { marginTop: 1 }, activeBodyContent: { paddingBottom: 2 }, errorNotice: { color: "#B34C57", fontSize: 11, lineHeight: 16, marginTop: 8 }, input: { backgroundColor: "rgba(255,255,255,0.56)", borderColor: "rgba(255,255,255,0.9)", borderRadius: 12, borderWidth: 1, color: "#263D70", fontSize: 14, fontWeight: "700", marginTop: 12, paddingHorizontal: 12, paddingVertical: 10 }, joinFields: { gap: 0 }, endpointRow: { flexDirection: "row", gap: 8 }, hostInput: { flex: 1 }, portInput: { width: 82 }, actionRow: { flexDirection: "row", gap: 8, marginTop: 10 }, primaryButton: { alignItems: "center", backgroundColor: "#4B6FE6", borderRadius: 13, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 11 }, secondaryButton: { alignItems: "center", backgroundColor: "rgba(224,235,255,0.74)", borderColor: "rgba(255,255,255,0.88)", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 11 }, scanButton: { alignItems: "center", backgroundColor: "rgba(232,240,255,0.7)", borderColor: "rgba(255,255,255,0.86)", borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 9, paddingVertical: 9 }, scanText: { color: "#4669DE", fontSize: 12, fontWeight: "900" }, disabled: { opacity: 0.55 }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, secondaryText: { color: "#4669DE", fontSize: 13, fontWeight: "800" }, hint: { color: "#6E7E9E", fontSize: 11, lineHeight: 16, marginTop: 10 }, statusLine: { alignItems: "center", backgroundColor: "rgba(222,246,234,0.68)", borderRadius: 10, flexDirection: "row", marginTop: 12, paddingHorizontal: 10, paddingVertical: 8 }, statusDot: { backgroundColor: "#43B77B", borderRadius: 5, height: 9, marginRight: 7, width: 9 }, statusText: { color: "#24734D", flex: 1, fontSize: 12, fontWeight: "800" }, connectionCard: { backgroundColor: "rgba(255,255,255,0.48)", borderColor: "rgba(255,255,255,0.82)", borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 11 }, connectionLabel: { color: "#7182A1", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginTop: 4 }, connectionValue: { color: "#273E74", fontSize: 13, fontWeight: "800", marginTop: 2 }, roomCode: { color: "#4669DE", fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "900", letterSpacing: 3, marginTop: 2 }, inviteCard: { alignItems: "center", backgroundColor: "rgba(233,241,255,0.66)", borderColor: "rgba(255,255,255,0.9)", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 10, padding: 9 }, qrFrame: { backgroundColor: "#FFFFFF", borderRadius: 10, padding: 5 }, inviteCopy: { flex: 1, marginLeft: 10 }, inviteTitle: { color: "#244681", fontSize: 12, fontWeight: "900" }, inviteHint: { color: "#607498", fontSize: 10, lineHeight: 14, marginTop: 3 }, deviceTitleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 13 }, deviceTitle: { color: "#263D70", fontSize: 13, fontWeight: "800" }, deviceCount: { backgroundColor: "rgba(70,105,222,0.13)", borderRadius: 9, color: "#4669DE", fontSize: 11, fontWeight: "900", minWidth: 24, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 3, textAlign: "center" }, device: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.76)", borderRadius: 11, borderWidth: 1, flexDirection: "row", marginTop: 7, paddingLeft: 10, paddingVertical: 9 }, deviceDot: { borderRadius: 5, height: 9, marginRight: 8, width: 9 }, onlineDot: { backgroundColor: "#43B77B" }, errorDot: { backgroundColor: "#D75C67" }, deviceCopy: { flex: 1, minWidth: 0 }, deviceName: { color: "#263D70", fontSize: 13, fontWeight: "800" }, deviceState: { color: "#7182A1", fontSize: 11, marginTop: 2 }, onlineText: { color: "#2D9561", fontSize: 10, fontWeight: "800", marginHorizontal: 8 }, errorText: { color: "#C34F5A" }, removeDevice: { alignItems: "center", alignSelf: "stretch", borderLeftColor: "rgba(112,137,182,0.17)", borderLeftWidth: 1, justifyContent: "center", width: 48 }, openButton: { alignItems: "center", backgroundColor: "#4B6FE6", borderRadius: 13, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 12, paddingVertical: 12 }, openButtonDisabled: { backgroundColor: "#A9B7DF", opacity: 0.72 }, waitingClientHint: { color: "#7B6B50", fontSize: 11, lineHeight: 16, marginTop: 7, textAlign: "center" }, leaveButton: { alignItems: "center", backgroundColor: "rgba(255,230,234,0.88)", borderColor: "rgba(203,91,108,0.22)", borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 12, paddingVertical: 10 }, leaveText: { color: "#B54B58", fontSize: 13, fontWeight: "900" }, modalBackdrop: { alignItems: "center", backgroundColor: "rgba(14,24,49,0.56)", flex: 1, justifyContent: "center", padding: 24 }, qrModal: { alignItems: "center", backgroundColor: "#F4F8FF", borderColor: "rgba(255,255,255,0.92)", borderRadius: 26, borderWidth: 1, maxWidth: 360, padding: 20, shadowColor: "#0A204E", shadowOpacity: 0.34, shadowRadius: 30, width: "100%" }, qrModalTitle: { color: "#172B55", fontSize: 18, fontWeight: "900" }, qrModalHint: { color: "#63759B", fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: "center" }, qrLarge: { backgroundColor: "#FFFFFF", borderRadius: 18, marginTop: 18, padding: 12 }, qrClose: { backgroundColor: "#4B6FE6", borderRadius: 13, marginTop: 18, paddingHorizontal: 28, paddingVertical: 11 }, qrCloseText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});
