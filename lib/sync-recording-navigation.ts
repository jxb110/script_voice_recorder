import { getSyncProjectSentenceCount, type SyncCommand } from "@/lib/lan-sync-protocol";

type SyncMode = "idle" | "host" | "client";

export function isMatchingClientSync(mode: SyncMode, sessionProjectKey: string | undefined, projectKey: string) {
  const sessionCount = getSyncProjectSentenceCount(sessionProjectKey ?? "");
  const projectCount = getSyncProjectSentenceCount(projectKey);
  return mode === "client" && sessionCount !== undefined && sessionCount === projectCount;
}

export function shouldClientOpenSyncRecording(mode: SyncMode, sessionProjectKey: string | undefined, projectKey: string, command: SyncCommand) {
  return isMatchingClientSync(mode, sessionProjectKey, projectKey) && command.name === "open" && getSyncProjectSentenceCount(command.projectId) === getSyncProjectSentenceCount(projectKey);
}
