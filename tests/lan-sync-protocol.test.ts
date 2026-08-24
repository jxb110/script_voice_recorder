import { describe, expect, it, vi } from "vitest";

import { LAN_SYNC_EXECUTION_LEAD_MS, createProjectSyncKey, createRoomCode, createSyncCommand, parseSyncMessage } from "@/lib/lan-sync-protocol";

describe("LAN sync protocol", () => {
  it("creates a short local room code", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    expect(createRoomCode()).toHaveLength(6);
    vi.restoreAllMocks();
  });

  it("adds a lead time for timestamped commands", () => {
    const command = createSyncCommand({ name: "start", projectId: "project_a", sentenceIndex: 4 }, 1_000);
    expect(command.executeAt).toBe(1_000 + LAN_SYNC_EXECUTION_LEAD_MS);
    expect(command.issuedAt).toBe(1_000);
  });

  it("derives the same room key from matching scripts on different devices", () => {
    const sentences = [{ rawText: "你好", tokens: [{ char: "你" }, { char: "好" }] }, { rawText: "再见", tokens: [{ char: "再" }, { char: "见" }] }];
    expect(createProjectSyncKey("sample.txt", sentences)).toBe(createProjectSyncKey(" SAMPLE.TXT ", sentences));
  });

  it("accepts complete commands and rejects malformed network payloads", () => {
    expect(parseSyncMessage(JSON.stringify({ type: "command", command: { id: "command_1", name: "stop", projectId: "project_a", sentenceIndex: 2, executeAt: 1_850, issuedAt: 1_000 } }))).toMatchObject({ type: "command", command: { name: "stop" } });
    expect(parseSyncMessage(JSON.stringify({ type: "command", command: { id: "command_1", name: "erase-all" } }))).toBeNull();
    expect(parseSyncMessage("not json")).toBeNull();
  });
});
