import { describe, expect, it } from "vitest";

import { getSyncRecordingAdmission } from "@/lib/sync-recording-admission";

const device = (sentenceCount: number, detail?: string) => ({ id: `client_${sentenceCount}`, name: "设备 A", role: "client" as const, state: "idle" as const, sentenceIndex: 0, connectedAt: 1, updatedAt: 1, sentenceCount, detail });

describe("同步录制准入", () => {
  it("允许在线且句数一致的不同脚本设备进入同步录制", () => {
    expect(getSyncRecordingAdmission([device(120)], 120)).toMatchObject({ allowed: true, onlineClientCount: 1 });
  });

  it("区分无在线客户端和句数不一致", () => {
    expect(getSyncRecordingAdmission([device(120, "offline")], 120)).toMatchObject({ allowed: false, reason: "no-online-client" });
    expect(getSyncRecordingAdmission([device(118)], 120)).toMatchObject({ allowed: false, reason: "sentence-count-mismatch", hostSentenceCount: 120, clientSentenceCount: 118 });
  });
});
