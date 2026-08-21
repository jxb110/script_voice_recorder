import { describe, expect, it } from "vitest";

import { canDeleteSpeaker, linkedProjectsForSpeaker } from "@/lib/speaker-rules";

describe("发音人删除保护规则", () => {
  const projects = [
    { id: "task-a", speakerId: "speaker-a", name: "A", sourceFileName: "a.txt", sentences: [], createdAt: "", updatedAt: "" },
    { id: "task-b", speakerId: "speaker-b", name: "B", sourceFileName: "b.txt", sentences: [], createdAt: "", updatedAt: "" },
  ];

  it("能列出关联到发音人的录音任务", () => {
    expect(linkedProjectsForSpeaker(projects, "speaker-a").map((project) => project.id)).toEqual(["task-a"]);
  });

  it("只允许删除没有关联任务的发音人", () => {
    expect(canDeleteSpeaker(projects, "speaker-a")).toBe(false);
    expect(canDeleteSpeaker(projects, "speaker-c")).toBe(true);
  });
});
