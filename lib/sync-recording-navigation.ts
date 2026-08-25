import type { SyncCommand } from "@/lib/lan-sync-protocol";

type SyncMode = "idle" | "host" | "client";

export function isMatchingClientSync(mode: SyncMode, sessionProjectKey: string | undefined, projectKey: string) {
  return mode === "client" && Boolean(projectKey) && sessionProjectKey === projectKey;
}

export function shouldClientOpenSyncRecording(mode: SyncMode, sessionProjectKey: string | undefined, projectKey: string, command: SyncCommand) {
  return isMatchingClientSync(mode, sessionProjectKey, projectKey) && command.name === "open" && command.projectId === projectKey;
}
