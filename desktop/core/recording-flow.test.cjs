const test = require("node:test");
const assert = require("node:assert/strict");
const { getAutoAdvanceIndex } = require("./recording-flow.cjs");

test("单句保存后自动跳到下一句，最后一句保持当前句", () => {
  assert.equal(getAutoAdvanceIndex(0, 3), 1);
  assert.equal(getAutoAdvanceIndex(1, 3), 2);
  assert.equal(getAutoAdvanceIndex(2, 3), undefined);
});
