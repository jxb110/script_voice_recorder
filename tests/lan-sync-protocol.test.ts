import { describe, expect, it, vi } from "vitest";

import { LAN_SYNC_EXECUTION_LEAD_MS, LAN_SYNC_NATIVE_PROTOCOL, createLanSyncAddress, createProjectSyncKey, createRoomCode, createSyncCommand, createSyncRoomInvite, getSyncProjectSentenceCount, normalizeLanSocketChunk, parseSyncMessage, parseSyncRoomInvite } from "@/lib/lan-sync-protocol";

describe("LAN sync protocol", () => {
  it("normalizes Android decimal byte-list socket payloads before parsing handshake responses", () => {
    expect(new TextDecoder().decode(normalizeLanSocketChunk("72,84,84,80,47,49,46,49,32,49,48,49"))).toBe("HTTP/1.1 101");
    expect(new TextDecoder().decode(normalizeLanSocketChunk("HTTP/1.1 101"))).toBe("HTTP/1.1 101");
    expect(new TextDecoder().decode(normalizeLanSocketChunk({ type: "Buffer", data: [72, 84, 84, 80] }))).toBe("HTTP");
    expect(new TextDecoder().decode(normalizeLanSocketChunk({ data: "72,84,84,80" }))).toBe("HTTP");
    expect(new TextDecoder().decode(normalizeLanSocketChunk("[72, 84, 84, 80]"))).toBe("HTTP");
    expect(new TextDecoder().decode(normalizeLanSocketChunk({ 0: 72, 1: 84, 2: 84, 3: 80 }))).toBe("HTTP");
  });

  it("uses one explicit native TCP protocol marker for both room peers", () => {
    expect(LAN_SYNC_NATIVE_PROTOCOL).toBe("SCRIPT-RECORDER-SYNC/1");
  });

  it("creates a short local room code", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    expect(createRoomCode()).toHaveLength(6);
    vi.restoreAllMocks();
  });

  it("adds a lead time for timestamped commands", () => {
    const command = createSyncCommand({ name: "jump", projectId: "project_a", sentenceIndex: 4 }, 1_000);
    expect(command.executeAt).toBe(1_000 + LAN_SYNC_EXECUTION_LEAD_MS);
    expect(command.issuedAt).toBe(1_000);
  });

  it("derives the same room key from matching scripts on different devices", () => {
    const sentences = [{ rawText: "你好", tokens: [{ char: "你" }, { char: "好" }] }, { rawText: "再见", tokens: [{ char: "再" }, { char: "见" }] }];
    expect(createProjectSyncKey("sample.txt", sentences)).toBe(createProjectSyncKey(" SAMPLE.TXT ", sentences));
  });

  it("normalizes all common line endings before deriving a room key", () => {
    const tokens = [{ char: "你" }, { char: "好" }];
    const keys = ["第一句\n第二句", "第一句\r\n第二句", "第一句\r第二句"].map((rawText) => createProjectSyncKey("sample.txt", [{ rawText, tokens }]));
    expect(new Set(keys).size).toBe(1);
  });

  it("extracts sentence count without requiring matching name or content checksum", () => {
    expect(getSyncProjectSentenceCount("v3|host-script.txt|120|aabbccdd")).toBe(120);
    expect(getSyncProjectSentenceCount("v3|other-script.txt|120|11223344")).toBe(120);
    expect(getSyncProjectSentenceCount("invalid-key")).toBeUndefined();
  });

  it("accepts complete commands and rejects malformed network payloads", () => {
    expect(parseSyncMessage(JSON.stringify({ type: "command", command: { id: "command_1", name: "complete", projectId: "project_a", sentenceIndex: 2, executeAt: 1_850, issuedAt: 1_000 } }))).toMatchObject({ type: "command", command: { name: "complete" } });
    expect(parseSyncMessage(JSON.stringify({ type: "command", command: { id: "command_2", name: "cancel", projectId: "project_a", sentenceIndex: 2, executeAt: 1_850, issuedAt: 1_000 } }))).toMatchObject({ type: "command", command: { name: "cancel" } });
    expect(parseSyncMessage(JSON.stringify({ type: "command", command: { id: "command_3", name: "open", projectId: "project_a", sentenceIndex: 2, executeAt: 1_850, issuedAt: 1_000 } }))).toMatchObject({ type: "command", command: { name: "open" } });
    expect(parseSyncMessage(JSON.stringify({ type: "command", command: { id: "command_1", name: "erase-all" } }))).toBeNull();
    expect(parseSyncMessage("not json")).toBeNull();
  });

  it("accepts a ready device state from a recording screen", () => {
    expect(parseSyncMessage(JSON.stringify({ type: "device-state", device: { id: "device_a", name: "录音设备 A", state: "ready", sentenceIndex: 3, updatedAt: 2_000 }, sentAt: 2_000 }))).toMatchObject({ type: "device-state", device: { state: "ready" } });
  });

  it("accepts a hello payload carrying the client sentence count", () => {
    const hello = { type: "hello", roomCode: "AB12CD", projectId: "v3|other.txt|3|ff00aa11", deviceId: "device_a", deviceName: "设备 A", sentenceCount: 3, sentAt: 2_000 };
    expect(parseSyncMessage(JSON.stringify(hello))).toMatchObject({ type: "hello", sentenceCount: 3 });
    expect(parseSyncMessage(JSON.stringify({ ...hello, sentenceCount: undefined }))).toBeNull();
  });

  it("creates a WebSocket endpoint from a separate host and port", () => {
    expect(createLanSyncAddress("192.168.1.20", "35679")).toBe("ws://192.168.1.20:35679");
    expect(createLanSyncAddress("ws://192.168.1.20:35679", "")).toBe("ws://192.168.1.20:35679");
    expect(() => createLanSyncAddress("192.168.1.20", "70000")).toThrow("1 到 65535");
  });

  it("round-trips a QR room invitation with the host sync task key", () => {
    const invite = createSyncRoomInvite("192.168.1.20:35679", "AB12CD", "sample.txt|4|first|last");
    expect(parseSyncRoomInvite(invite)).toEqual({ host: "192.168.1.20", port: 35679, roomCode: "AB12CD", projectSyncKey: "sample.txt|4|first|last", version: 2 });
    expect(parseSyncRoomInvite("not-an-invite")).toBeNull();
  });
});
