const path = require("node:path");

function cleanFileSegment(value) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 48);
  return cleaned || "未命名";
}

function formatRecordingTimestamp(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
}

function getSpeakerFolderName(speaker) {
  return `${cleanFileSegment(speaker.name)}_${speaker.gender || "其他"}_${speaker.age ?? 0}岁`;
}

function getRecordingFileName({ projectName, speakerName, sentenceIndex, timestamp = Date.now() }) {
  const paragraph = String(sentenceIndex).padStart(3, "0");
  return `${cleanFileSegment(projectName)}_${cleanFileSegment(speakerName)}_${paragraph}_${formatRecordingTimestamp(timestamp)}.wav`;
}

function getRecordingDirectory(rootDirectory, project, speaker) {
  return path.join(rootDirectory, "record_jxb", "wave", getSpeakerFolderName(speaker), cleanFileSegment(project.name));
}

function getRecordingTarget(rootDirectory, project, speaker, sentenceIndex, timestamp = Date.now()) {
  const directory = getRecordingDirectory(rootDirectory, project, speaker);
  return { directory, fileName: getRecordingFileName({ projectName: project.name, speakerName: speaker.name, sentenceIndex, timestamp }), path: path.join(directory, getRecordingFileName({ projectName: project.name, speakerName: speaker.name, sentenceIndex, timestamp })) };
}

module.exports = { cleanFileSegment, formatRecordingTimestamp, getSpeakerFolderName, getRecordingFileName, getRecordingDirectory, getRecordingTarget };
