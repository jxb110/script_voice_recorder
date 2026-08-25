import { describe, expect, it } from "vitest";

import { shouldClientOpenSyncRecording } from "@/lib/sync-recording-navigation";
import type { SyncCommand } from "@/lib/lan-sync-protocol";

const command = (name: SyncCommand["name"], projectId = "v3|sample.txt|2|abc12345"): SyncCommand => ({ id: "cmd_1", name, projectId, sentenceIndex: 1, issuedAt: 1_000, executeAt: 1_850 });

describe("同步客户端录制导航", () => {
  it("仅在同一任务收到主控 open 指令时进入同步录制", () => {
    expect(shouldClientOpenSyncRecording("client", "v3|sample.txt|2|abc12345", "v3|sample.txt|2|abc12345", command("open"))).toBe(true);
    expect(shouldClientOpenSyncRecording("host", "v3|sample.txt|2|abc12345", "v3|sample.txt|2|abc12345", command("open"))).toBe(false);
    expect(shouldClientOpenSyncRecording("client", "v3|sample.txt|2|abc12345", "v3|sample.txt|2|abc12345", command("start"))).toBe(false);
    expect(shouldClientOpenSyncRecording("client", "v3|sample.txt|2|abc12345", "v3|other.txt|2|abc12345", command("open"))).toBe(false);
  });
});
