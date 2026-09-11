function getAutoAdvanceIndex(currentIndex, sentenceCount) {
  if (!Number.isInteger(currentIndex) || !Number.isInteger(sentenceCount) || sentenceCount < 1) return undefined;
  const nextIndex = currentIndex + 1;
  return nextIndex < sentenceCount ? nextIndex : undefined;
}

module.exports = { getAutoAdvanceIndex };
