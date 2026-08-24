import { describe, expect, it, vi } from "vitest";

import { LAN_SYNC_EXECUTION_LEAD_MS, createLanSyncAddress, createProjectSyncKey, createRoomCode, createSyncCommand, createSyncRoomInvite, parseSyncMessage, parseSyncRoomInvite } from "@/lib/lan-sync-protocol";

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

  it("creates a WebSocket endpoint from a separate host and port", () => {
    expect(createLanSyncAddress("192.168.1.20", "35679")).toBe("ws://192.168.1.20:35679");
    expect(createLanSyncAddress("ws://192.168.1.20:35679", "")).toBe("ws://192.168.1.20:35679");
    expect(() => createLanSyncAddress("192.168.1.20", "70000")).toThrow("1 到 65535");
  });

  it("round-trips a QR room invitation without exposing a WebSocket prefix", () => {
    const invite = createSyncRoomInvite("192.168.1.20:35679", "AB12CD");
    expect(parseSyncRoomInvite(invite)).toEqual({ host: "192.168.1.20", port: 35679, roomCode: "AB12CD" });
    expect(parseSyncRoomInvite("not-an-invite")).toBeNull();
  });
});
