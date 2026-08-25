import type { SyncDevice } from "@/lib/lan-sync-protocol";

export type SyncDeviceIndicator = "recording-screen" | "waiting" | "offline";

export function isSyncDeviceOnline(device: Pick<SyncDevice, "detail" | "state">) {
  return device.detail !== "offline" && device.state !== "error";
}

export function getSyncDeviceIndicator(device: Pick<SyncDevice, "detail" | "state">): SyncDeviceIndicator {
  if (!isSyncDeviceOnline(device)) return "offline";
  return device.state === "idle" ? "waiting" : "recording-screen";
}

export function getSyncDeviceInitial(name: string) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";
}
