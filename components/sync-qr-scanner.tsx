import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { parseSyncRoomInvite, type SyncRoomInvite } from "@/lib/lan-sync-protocol";

type SyncQrScannerProps = { visible: boolean; language: "zh" | "en"; onClose: () => void; onInvite: (invite: SyncRoomInvite) => void };

export function SyncQrScanner({ visible, language, onClose, onInvite }: SyncQrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);
  const zh = language === "zh";
  const copy = zh ? { title: "扫码加入同步房间", hint: "将取景框对准主控设备显示的二维码", grant: "允许使用相机", cancel: "取消", invalid: "无效二维码", invalidHint: "这不是采音脚本同步房间二维码。" } : { title: "Scan to join sync room", hint: "Point the camera at the controller QR code", grant: "Allow camera", cancel: "Cancel", invalid: "Invalid QR code", invalidHint: "This is not a Script Recorder sync room code." };

  useEffect(() => { if (visible) setHandled(false); }, [visible]);
  if (!visible) return null;

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (handled) return;
    setHandled(true);
    const invite = parseSyncRoomInvite(data);
    if (!invite) {
      Alert.alert(copy.invalid, copy.invalidHint, [{ text: "OK", onPress: () => setHandled(false) }]);
      return;
    }
    onInvite(invite);
  };

  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.titleRow}><Text style={styles.title}>{copy.title}</Text><TouchableOpacity accessibilityLabel={copy.cancel} onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></TouchableOpacity></View><Text style={styles.hint}>{copy.hint}</Text>{!permission ? <View style={styles.placeholder} /> : permission.granted ? <View style={styles.cameraWrap}><CameraView barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handled ? undefined : handleScan} style={styles.camera} /><View pointerEvents="none" style={styles.scanFrame} /></View> : <View style={styles.permission}><Text style={styles.permissionText}>{copy.hint}</Text><TouchableOpacity onPress={requestPermission} style={styles.grant}><Text style={styles.grantText}>{copy.grant}</Text></TouchableOpacity></View>}<TouchableOpacity onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>{copy.cancel}</Text></TouchableOpacity></View></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { alignItems: "center", backgroundColor: "rgba(14,24,49,0.56)", flex: 1, justifyContent: "center", padding: 24 }, sheet: { backgroundColor: "#F4F8FF", borderColor: "rgba(255,255,255,0.92)", borderRadius: 26, borderWidth: 1, maxWidth: 420, padding: 18, shadowColor: "#0A204E", shadowOpacity: 0.34, shadowRadius: 30, width: "100%" }, titleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, title: { color: "#172B55", fontSize: 18, fontWeight: "900" }, close: { alignItems: "center", backgroundColor: "rgba(222,232,252,0.8)", borderRadius: 15, height: 30, justifyContent: "center", width: 30 }, closeText: { color: "#4062BD", fontSize: 24, fontWeight: "400", lineHeight: 27 }, hint: { color: "#63759B", fontSize: 12, lineHeight: 18, marginTop: 7 }, cameraWrap: { borderRadius: 20, height: 300, marginTop: 16, overflow: "hidden", position: "relative", width: "100%" }, camera: { flex: 1 }, scanFrame: { borderColor: "rgba(255,255,255,0.94)", borderRadius: 18, borderWidth: 3, bottom: "17%", left: "17%", position: "absolute", right: "17%", top: "17%" }, placeholder: { height: 300, marginTop: 16 }, permission: { alignItems: "center", backgroundColor: "rgba(224,235,255,0.72)", borderRadius: 18, marginTop: 16, padding: 24 }, permissionText: { color: "#40587F", fontSize: 13, textAlign: "center" }, grant: { backgroundColor: "#4B6FE6", borderRadius: 14, marginTop: 14, paddingHorizontal: 18, paddingVertical: 11 }, grantText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, cancel: { alignItems: "center", marginTop: 13, paddingVertical: 5 }, cancelText: { color: "#677A9D", fontSize: 13, fontWeight: "800" },
});
