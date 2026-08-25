import { describe, expect, it } from "vitest";

import { isSyncDeviceOnline } from "@/lib/sync-device-status";

describe("同步设备在线状态", () => {
  it("仅将离线或异常设备显示为灰色", () => {
    expect(isSyncDeviceOnline({ state: "recording" })).toBe(true);
    expect(isSyncDeviceOnline({ state: "idle", detail: "offline" })).toBe(false);
    expect(isSyncDeviceOnline({ state: "error" })).toBe(false);
  });
});
