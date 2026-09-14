const { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const QRCode = require("qrcode");

const { getRecordingTarget } = require("./core/recording-paths.cjs");
const { SyncRoom } = require("./core/sync-room.cjs");
const { createDesktopSyncRoomInvite } = require("./core/sync-invite.cjs");
const { collectTaskOutputs } = require("./core/task-recordings.cjs");
const { normalizeTaskWorkspace } = require("./core/task-workspace.cjs");
const { DEFAULT_DESKTOP_UI, normalizeDesktopUiPreferences } = require("./core/ui-preferences.cjs");
const { normalizeMicrophoneIds, resolveMicrophoneRecordingPlan } = require("./renderer/multi-microphone.js");

let mainWindow = null;
let syncRoom = null;
let desktopState = { settings: { sampleRate: 48000, bitDepth: 16, channelMode: "single", channels: 1, microphoneIds: [], leadingSilenceMs: 500, trailingSilenceMs: 500, recordingRoot: path.join(os.homedir(), "Documents"), ui: DEFAULT_DESKTOP_UI }, outputs: {}, taskWorkspace: { current: undefined, archive: [] } };

const statePath = () => path.join(app.getPath("userData"), "desktop-state.json");
const safeError = (error) => error instanceof Error ? error.message : "发生未知错误。";
const allowedBitDepth = new Set([16, 32]);
const allowedSampleRates = new Set([16000, 22050, 24000, 44100, 48000]);

async function loadState() {
  try {
    const saved = JSON.parse(await fs.readFile(statePath(), "utf8"));
    desktopState = {
      ...desktopState,
      ...saved,
      settings: validateSettings({ ...desktopState.settings, ...(saved.settings || {}), ui: normalizeDesktopUiPreferences(saved.settings?.ui) }),
      outputs: saved.outputs && typeof saved.outputs === "object" ? saved.outputs : {},
      taskWorkspace: normalizeTaskWorkspace(saved.taskWorkspace),
    };
  }
  catch { /* first start */ }
}

async function saveState() {
  await fs.mkdir(path.dirname(statePath()), { recursive: true });
  await fs.writeFile(statePath(), JSON.stringify(desktopState, null, 2), "utf8");
}

function validateSettings(input) {
  const next = { ...desktopState.settings, ...input };
  if (!allowedSampleRates.has(Number(next.sampleRate))) throw new Error("采样率无效。");
  if (!allowedBitDepth.has(Number(next.bitDepth))) throw new Error("位深仅支持 16-bit 或 32-bit。");
  const microphoneIds = normalizeMicrophoneIds(next.microphoneIds?.length ? next.microphoneIds : next.microphone);
  const channelPlan = resolveMicrophoneRecordingPlan({ channelMode: next.channelMode, microphoneIds });
  for (const key of ["leadingSilenceMs", "trailingSilenceMs"]) if (!Number.isInteger(Number(next[key])) || Number(next[key]) < 0 || Number(next[key]) > 10000) throw new Error("首尾静音必须是 0 到 10000 毫秒之间的整数。");
  if (typeof next.recordingRoot !== "string" || !path.isAbsolute(next.recordingRoot)) throw new Error("请选择有效的数据保存路径。");
  return { ...next, sampleRate: Number(next.sampleRate), bitDepth: Number(next.bitDepth), channelMode: channelPlan.channelMode, channels: channelPlan.channelCount, microphoneIds: channelPlan.microphoneIds, leadingSilenceMs: Number(next.leadingSilenceMs), trailingSilenceMs: Number(next.trailingSilenceMs), ui: normalizeDesktopUiPreferences(next.ui) };
}

function outputKey(project, speaker, sentenceIndex) { return `${project.name}\u241E${speaker.name}\u241E${sentenceIndex}`; }

async function saveRecording(payload) {
  const { project, speaker, sentenceIndex, base64 } = payload ?? {};
  if (!project?.name || !speaker?.name || !Number.isInteger(sentenceIndex) || sentenceIndex < 1 || typeof base64 !== "string") throw new Error("录音保存参数无效。");
  const target = getRecordingTarget(desktopState.settings.recordingRoot, project, speaker, sentenceIndex);
  const key = outputKey(project, speaker, sentenceIndex);
  const oldPath = desktopState.outputs[key];
  await fs.mkdir(target.directory, { recursive: true });
  if (oldPath && oldPath !== target.path) await fs.rm(oldPath, { force: true });
  await fs.writeFile(target.path, Buffer.from(base64, "base64"));
  desktopState.outputs[key] = target.path;
  await saveState();
  return { path: target.path, fileName: target.fileName, directory: target.directory };
}

async function deleteTaskRecordings(payload) {
  const projectName = String(payload?.project?.name ?? "").trim();
  if (!projectName) throw new Error("任务名称无效，无法删除任务录音。");
  const entries = collectTaskOutputs(desktopState.outputs, projectName);
  for (const [key, recordingPath] of entries) {
    try { await fs.rm(recordingPath, { force: true }); }
    finally { delete desktopState.outputs[key]; }
  }
  await saveState();
  return { deletedCount: entries.length };
}

async function openTaskDirectory(payload) {
  const { project, speaker } = payload ?? {};
  if (!project?.name || !speaker?.name) throw new Error("任务或发音人信息无效，无法打开数据目录。 ");
  const target = getRecordingTarget(desktopState.settings.recordingRoot, project, speaker, 1);
  await fs.mkdir(target.directory, { recursive: true });
  const error = await shell.openPath(target.directory);
  if (error) throw new Error(`无法打开数据目录：${error}`);
  return { directory: target.directory };
}

function sendSyncEvent(event) { mainWindow?.webContents.send("sync:event", event); }

function createLanguageMenu() {
  const language = desktopState.settings.ui.language;
  Menu.setApplicationMenu(Menu.buildFromTemplate([{
    label: "Language",
    submenu: [
      { label: "中文", type: "radio", checked: language === "zh", click: () => setLanguage("zh") },
      { label: "English", type: "radio", checked: language === "en", click: () => setLanguage("en") },
    ],
  }]));
}

async function setLanguage(language) {
  desktopState.settings.ui = normalizeDesktopUiPreferences({ ...desktopState.settings.ui, language });
  await saveState();
  createLanguageMenu();
  mainWindow?.webContents.send("app:language", desktopState.settings.ui.language);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 680,
    backgroundColor: "#eef3f9",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === "media"));
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === "media");
}

app.whenReady().then(async () => {
  await loadState();
  configurePermissions();
  syncRoom = new SyncRoom(sendSyncEvent);
  createLanguageMenu();
  createWindow();
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on("window-all-closed", async () => { await syncRoom?.stop(); if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("settings:get", () => desktopState.settings);
ipcMain.handle("settings:save", async (_event, value) => { desktopState.settings = validateSettings(value); await saveState(); return desktopState.settings; });
ipcMain.handle("dialog:choose-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"] });
  return result.canceled ? undefined : result.filePaths[0];
});
ipcMain.handle("dialog:open-script", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"], filters: [{ name: "TXT 脚本", extensions: ["txt"] }] });
  if (result.canceled || !result.filePaths[0]) return undefined;
  const filePath = result.filePaths[0];
  return { name: path.basename(filePath), content: await fs.readFile(filePath, "utf8") };
});
ipcMain.handle("recording:save", async (_event, payload) => saveRecording(payload));
ipcMain.handle("recording:delete-task", async (_event, payload) => deleteTaskRecordings(payload));
ipcMain.handle("recording:open-task-directory", async (_event, payload) => openTaskDirectory(payload));
ipcMain.handle("recording:get", async (_event, payload) => {
  const { project, speaker, sentenceIndex } = payload ?? {};
  if (!project?.name || !speaker?.name || !Number.isInteger(sentenceIndex) || sentenceIndex < 1) return undefined;
  const key = outputKey(project, speaker, sentenceIndex);
  const recordingPath = desktopState.outputs[key];
  if (recordingPath) {
    try { await fs.access(recordingPath); }
    catch { delete desktopState.outputs[key]; await saveState(); return undefined; }
  }
  return recordingPath ? { path: recordingPath, url: pathToFileURL(recordingPath).href } : undefined;
});
ipcMain.handle("tasks:get-workspace", () => desktopState.taskWorkspace);
ipcMain.handle("tasks:save-workspace", async (_event, workspace) => {
  desktopState.taskWorkspace = normalizeTaskWorkspace(workspace);
  await saveState();
  return desktopState.taskWorkspace;
});
ipcMain.handle("sync:host", async (_event, input) => syncRoom.host(input));
ipcMain.handle("sync:join", async (_event, input) => syncRoom.join(input));
ipcMain.handle("sync:stop", async () => { await syncRoom.stop(); return syncRoom.snapshot(); });
ipcMain.handle("sync:status", () => syncRoom.snapshot());
ipcMain.handle("sync:remove-client", async (_event, deviceId) => syncRoom.removeClient(deviceId));
ipcMain.handle("sync:host-invite", async () => {
  const payload = createDesktopSyncRoomInvite(syncRoom.snapshot());
  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 264,
    color: { dark: "#183050", light: "#FFFFFF" },
  });
  return { payload, qrDataUrl };
});
ipcMain.handle("sync:command", (_event, name, sentenceIndex) => syncRoom.sendCommand(name, sentenceIndex));
ipcMain.handle("sync:state", (_event, update) => { syncRoom.reportState(update); return syncRoom.snapshot(); });
ipcMain.handle("system:device-name", () => os.hostname() || `Windows-${crypto.randomUUID().slice(0, 4)}`);
