function text(value, fallback = "") { return typeof value === "string" ? value.trim() || fallback : fallback; }

function normalizeSentence(sentence, fallbackIndex) {
  const tokens = Array.isArray(sentence?.tokens)
    ? sentence.tokens.filter((token) => token && typeof token.char !== "undefined").map((token) => ({ char: String(token.char), pinyin: typeof token.pinyin === "string" && token.pinyin.trim() ? token.pinyin.trim() : undefined }))
    : [];
  if (!tokens.length) return undefined;
  const index = Number.isInteger(Number(sentence?.index)) && Number(sentence.index) > 0 ? Number(sentence.index) : fallbackIndex;
  return { index, tokens, rawText: tokens.map((token) => token.char).join(""), prompt: text(sentence?.prompt) };
}

function normalizeTask(task, fallbackId) {
  const sentences = (Array.isArray(task?.sentences) ? task.sentences : []).map((sentence, index) => normalizeSentence(sentence, index + 1)).filter(Boolean);
  const recordings = new Map();
  for (const entry of Array.isArray(task?.recorded) ? task.recorded : []) {
    const [index, recordingPath] = Array.isArray(entry) ? entry : [];
    if (Number.isInteger(Number(index)) && Number(index) >= 0 && typeof recordingPath === "string" && recordingPath) recordings.set(Number(index), recordingPath);
  }
  const currentIndex = Math.min(Math.max(0, Number(task?.currentIndex) || 0), Math.max(0, sentences.length - 1));
  return {
    id: text(task?.id, fallbackId),
    project: { name: text(task?.project?.name, "未命名任务") },
    speaker: { name: text(task?.speaker?.name, "未命名"), gender: text(task?.speaker?.gender, "其他"), age: Math.min(120, Math.max(0, Number(task?.speaker?.age) || 0)) },
    sentences,
    currentIndex,
    recorded: [...recordings.entries()],
    scriptName: text(task?.scriptName),
  };
}

function normalizeTaskWorkspace(workspace) {
  const archive = (Array.isArray(workspace?.archive) ? workspace.archive : []).map((task, index) => normalizeTask(task, `desktop_archive_${index + 1}`));
  return { current: workspace?.current ? normalizeTask(workspace.current, "desktop_current") : undefined, archive };
}

module.exports = { normalizeTaskWorkspace };
