import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { getLanSyncStatus, joinLanSyncRoom, reportLanSyncState, sendLanSyncCommand, startLanSyncHost, stopLanSync, subscribeLanSync, subscribeLanSyncCommands, type LanSyncHostInput, type LanSyncJoinInput, type LanSyncStateUpdate, type LanSyncStatus } from "@/lib/lan-sync";
import type { SyncCommand, SyncCommandName } from "@/lib/lan-sync-protocol";

type SyncRoomContextValue = {
  status: LanSyncStatus;
  hostRoom: (input: LanSyncHostInput) => Promise<LanSyncStatus>;
  joinRoom: (input: LanSyncJoinInput) => Promise<LanSyncStatus>;
  leaveRoom: () => void;
  sendCommand: (name: SyncCommandName, sentenceIndex: number) => SyncCommand;
  reportState: (update: LanSyncStateUpdate) => void;
  subscribeCommands: (listener: (command: SyncCommand) => void) => () => void;
};

const SyncRoomContext = createContext<SyncRoomContextValue | null>(null);

export function SyncRoomProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState(getLanSyncStatus());
  useEffect(() => subscribeLanSync(() => setStatus(getLanSyncStatus())), []);
  const hostRoom = useCallback((input: LanSyncHostInput) => startLanSyncHost(input), []);
  const joinRoom = useCallback((input: LanSyncJoinInput) => joinLanSyncRoom(input), []);
  const leaveRoom = useCallback(() => stopLanSync(), []);
  const sendCommand = useCallback((name: SyncCommandName, sentenceIndex: number) => sendLanSyncCommand(name, sentenceIndex), []);
  const reportState = useCallback((update: LanSyncStateUpdate) => reportLanSyncState(update), []);
  const subscribeCommands = useCallback((listener: (command: SyncCommand) => void) => subscribeLanSyncCommands(listener), []);
  const value = useMemo(() => ({ status, hostRoom, joinRoom, leaveRoom, sendCommand, reportState, subscribeCommands }), [hostRoom, joinRoom, leaveRoom, reportState, sendCommand, status, subscribeCommands]);
  return <SyncRoomContext.Provider value={value}>{children}</SyncRoomContext.Provider>;
}

export function useSyncRoom() {
  const context = useContext(SyncRoomContext);
  if (!context) throw new Error("useSyncRoom 必须在 SyncRoomProvider 内使用。");
  return context;
}
