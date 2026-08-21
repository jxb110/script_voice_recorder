function normalizePrompt(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim();
}

export function shouldAnimatePromptChange(previousPrompt: string | null, nextPrompt: string) {
  if (previousPrompt === null) return false;
  return normalizePrompt(previousPrompt) !== normalizePrompt(nextPrompt);
}
