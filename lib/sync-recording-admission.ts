import type { SyncDevice } from "@/lib/lan-sync-protocol";

export type SyncRecordingAdmission =
  | { allowed: true; onlineClientCount: number }
  | { allowed: false; reason: "no-online-client"; onlineClientCount: 0 }
  | { allowed: false; reason: "sentence-count-mismatch"; onlineClientCount: number; device: SyncDevice; hostSentenceCount: number; clientSentenceCount?: number };

export function getSyncRecordingAdmission(devices: SyncDevice[], hostSentenceCount?: number): SyncRecordingAdmission {
  const onlineClients = devices.filter((device) => device.role === "client" && device.detail !== "offline" && device.state !== "error");
  if (!onlineClients.length) return { allowed: false, reason: "no-online-client", onlineClientCount: 0 };
  if (hostSentenceCount !== undefined) {
    const mismatch = onlineClients.find((device) => device.sentenceCount !== hostSentenceCount);
    if (mismatch) return { allowed: false, reason: "sentence-count-mismatch", onlineClientCount: onlineClients.length, device: mismatch, hostSentenceCount, clientSentenceCount: mismatch.sentenceCount };
  }
  return { allowed: true, onlineClientCount: onlineClients.length };
}
