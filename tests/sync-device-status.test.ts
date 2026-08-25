import { describe, expect, it } from "vitest";

import { getSyncDeviceIndicator, getSyncDeviceInitial, isSyncDeviceOnline } from "@/lib/sync-device-status";

describe("同步设备在线状态", () => {
  it("仅将离线或异常设备显示为灰色", () => {
    expect(isSyncDeviceOnline({ state: "recording" })).toBe(true);
    expect(isSyncDeviceOnline({ state: "idle", detail: "offline" })).toBe(false);
    expect(isSyncDeviceOnline({ state: "error" })).toBe(false);
  });

  it("区分录制页、在线等待和离线三种设备圆点状态", () => {
    expect(getSyncDeviceIndicator({ state: "ready" })).toBe("recording-screen");
    expect(getSyncDeviceIndicator({ state: "idle" })).toBe("waiting");
    expect(getSyncDeviceIndicator({ state: "error" })).toBe("offline");
    expect(getSyncDeviceInitial("录音设备 A")).toBe("录");
    expect(getSyncDeviceInitial("  device A")).toBe("D");
  });
});
