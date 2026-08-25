import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { getLanSyncStatus, joinLanSyncRoom, removeLanSyncClient, reportLanSyncState, sendLanSyncCommand, startLanSyncHost, stopLanSync, subscribeLanSync, subscribeLanSyncCommands, type LanSyncHostInput, type LanSyncJoinInput, type LanSyncStateUpdate, type LanSyncStatus } from "@/lib/lan-sync";
import type { SyncCommand, SyncCommandName } from "@/lib/lan-sync-protocol";

type SyncRoomContextValue = {
  status: LanSyncStatus;
  hostRoom: (input: LanSyncHostInput) => Promise<LanSyncStatus>;
  joinRoom: (input: LanSyncJoinInput) => Promise<LanSyncStatus>;
  leaveRoom: () => void;
  removeClient: (deviceId: string) => void;
  sendCommand: (name: SyncCommandName, sentenceIndex: number) => SyncCommand;
  reportState: (update: LanSyncStateUpdate) => void;
  subscribeCommands: (listener: (command: SyncCommand) => void) => () => void;
};

const SyncRoomContext = createContext<SyncRoomContextValue | null>(null);

export function SyncRoomProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState(getLanSyncStatus());
  const publishStatus = useCallback((next: LanSyncStatus = getLanSyncStatus()) => {
    setStatus({ ...next, devices: [...next.devices] });
  }, []);
  useEffect(() => subscribeLanSync(() => publishStatus()), [publishStatus]);
  const hostRoom = useCallback(async (input: LanSyncHostInput) => {
    const next = await startLanSyncHost(input);
    publishStatus(next);
    return next;
  }, [publishStatus]);
  const joinRoom = useCallback(async (input: LanSyncJoinInput) => {
    const next = await joinLanSyncRoom(input);
    publishStatus(next);
    return next;
  }, [publishStatus]);
  const leaveRoom = useCallback(() => {
    stopLanSync();
    publishStatus();
  }, [publishStatus]);
  const removeClient = useCallback((deviceId: string) => {
    removeLanSyncClient(deviceId);
    publishStatus();
  }, [publishStatus]);
  const sendCommand = useCallback((name: SyncCommandName, sentenceIndex: number) => sendLanSyncCommand(name, sentenceIndex), []);
  const reportState = useCallback((update: LanSyncStateUpdate) => reportLanSyncState(update), []);
  const subscribeCommands = useCallback((listener: (command: SyncCommand) => void) => subscribeLanSyncCommands(listener), []);
  const value = useMemo(() => ({ status, hostRoom, joinRoom, leaveRoom, removeClient, sendCommand, reportState, subscribeCommands }), [hostRoom, joinRoom, leaveRoom, removeClient, reportState, sendCommand, status, subscribeCommands]);
  return <SyncRoomContext.Provider value={value}>{children}</SyncRoomContext.Provider>;
}

export function useSyncRoom() {
  const context = useContext(SyncRoomContext);
  if (!context) throw new Error("useSyncRoom 必须在 SyncRoomProvider 内使用。");
  return context;
}
