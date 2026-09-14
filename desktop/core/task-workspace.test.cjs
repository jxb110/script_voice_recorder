const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeTaskWorkspace } = require("./task-workspace.cjs");

test("任务工作区持久化保留发音人、录音映射和拼音标注", () => {
  const workspace = normalizeTaskWorkspace({
    current: {
      id: "task-a",
      project: { name: "普通话采集" },
      speaker: { name: "小林", gender: "女", age: 24 },
      sentences: [{ index: 1, tokens: [{ char: "你", pinyin: "nǐ" }, { char: "好", pinyin: "hǎo" }], prompt: "自然朗读" }],
      currentIndex: 0,
      recorded: [[0, "C:/record/普通话采集_小林_001.wav"]],
      scriptName: "demo.txt",
    },
  });
  assert.equal(workspace.current.project.name, "普通话采集");
  assert.equal(workspace.current.speaker.name, "小林");
  assert.equal(workspace.current.sentences[0].tokens[0].pinyin, "nǐ");
  assert.deepEqual(workspace.current.recorded, [[0, "C:/record/普通话采集_小林_001.wav"]]);
});
