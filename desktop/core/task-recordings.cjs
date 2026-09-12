function collectTaskOutputs(outputs, projectName) {
  const prefix = `${String(projectName ?? "").trim()}\u241E`;
  if (!prefix || prefix === "\u241E") return [];
  return Object.entries(outputs ?? {}).filter(([key, filePath]) => key.startsWith(prefix) && typeof filePath === "string" && filePath.length > 0);
}

module.exports = { collectTaskOutputs };
