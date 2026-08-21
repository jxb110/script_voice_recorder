import type { ScriptProject } from "@/shared/recorder-types";

export function linkedProjectsForSpeaker(projects: ScriptProject[], speakerId: string) {
  return projects.filter((project) => project.speakerId === speakerId);
}

export function canDeleteSpeaker(projects: ScriptProject[], speakerId: string) {
  return linkedProjectsForSpeaker(projects, speakerId).length === 0;
}
