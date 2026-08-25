import type { SyncDevice } from "@/lib/lan-sync-protocol";

export function isSyncDeviceOnline(device: Pick<SyncDevice, "detail" | "state">) {
  return device.detail !== "offline" && device.state !== "error";
}
