const bridge = window.desktopBridge;
const elementIds = [
  "workspace", "sidebarResizeHandle", "projectName", "speakerName", "speakerGender", "speakerAge", "scriptSummary", "sentenceList", "promptText", "promptCard", "readingText", "readingCard", "readingFontSize", "readingFontSizeValue", "progressText", "recordState", "recordMessage", "deviceDots", "deviceName", "hostIp", "hostPort", "roomCode", "hostInfo", "hostInvite", "hostQrImage", "deviceList", "syncSummary", "sampleRate", "channels", "bitDepth", "leadingSilenceMs", "trailingSilenceMs", "microphone", "recordingRoot", "waveCanvas", "waveCursor", "waveShell", "recordButton", "previousButton", "nextButton", "playButton", "completeButton", "openSyncButton", "closeSyncButton", "hostButton", "joinButton", "choosePathButton", "settingsActionButton", "importScriptButton", "newTaskButton", "openTaskDirectoryButton", "deleteTaskButton", "currentTaskCard", "taskArchive",
];
const elements = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));
const missingElement = elementIds.find((id) => !elements[id]);
if (missingElement) throw new Error(`桌面录音界面缺少必要元素：${missingElement}`);

const state = { sentences: [], currentIndex: 0, settings: null, sync: { mode: "idle", devices: [] }, audio: null, audioNode: null, analyser: null, mediaStream: null, chunks: [], playing: null, playbackFrame: 0, playbackProgress: 0, recorded: new Map(), wave: [], waveRenderFrame: 0, waveCaptureFrame: 0, waveLastSampleAt: 0, leadingTimer: null, phaseTimer: null, phase: "ready", phaseEndsAt: 0, phaseStartedAt: 0, scriptName: "", editingSettings: false, taskArchive: [], currentTaskId: "", ui: { readingFontSize: 20, sidebarWidth: 340, panelHeights: { prompt: 68, reading: 180, wave: 176 } }, resizingPanel: null, resizingSidebar: null };
const settingsFields = ["sampleRate", "channels", "bitDepth", "leadingSilenceMs", "trailingSilenceMs", "microphone", "recordingRoot"];
const taskIdentityFields = ["projectName", "speakerName", "speakerGender", "speakerAge"];
const TRANSLATIONS = {
  zh: { appTitle: "采音脚本", newTask: "+ 新建任务", taskAndSpeaker: "任务与发音人", taskName: "任务名称", speakerName: "发音人姓名", gender: "性别", female: "女", male: "男", other: "其他", age: "年龄", importScript: "导入 TXT 脚本", openDataDirectory: "打开数据目录", deleteTask: "删除当前任务", currentTake: "当前录音", ready: "待命", prompt: "提示词", readingText: "朗读文本", fontSize: "字号", previous: "上一句", next: "下一句", startRecording: "开始录制", stopRecording: "停止录制", play: "播放", completeTask: "完成任务", recordingSavedAsWav: "电脑端录音会保存为 WAV。", syncRecording: "多设备同步录音", syncSubtitle: "电脑可创建主控房间，或加入手机/电脑主控房间", deviceName: "设备名称", hostIp: "主控 IP", port: "端口", roomCode: "房间口令", hostRoom: "创建主控房间", joinRoom: "加入已有房间", enterSync: "进入同步录制", closeSync: "关闭同步", desktopSettings: "电脑录音配置", settingsSubtitle: "与手机端一致的 WAV 参数和目录结构", sampleRate: "采样率", channels: "声道", mono: "单声道", stereo: "双声道", bitDepth: "位深", microphone: "麦克风", loadingMicrophones: "正在读取麦克风…", leadingSilence: "首端静音（毫秒）", trailingSilence: "尾端静音（毫秒）", recordingPath: "数据保存路径", choose: "选择", settingsDescription: "修改配置后，新录制的 WAV 将使用新的采样率、声道与位深。", editSettings: "修改配置", saveSettings: "保存配置", noScript: "尚未导入脚本", importToShowPrompt: "导入脚本后显示提示词", importToShowReading: "请先导入 TXT 脚本", noPrompt: "无提示词", recorded: "已录", pending: "未录", sentence: "句", script: "脚本", continueRecording: "继续录制", singleWaiting: "单机录音 · 等待同步", hostRoomStatus: "主控房间", connectedHost: "已连接主控", clients: "台客户端", hostInfoIdle: "创建房间后显示本机 IP、端口与口令。", hostAddress: "主控地址", connectedToHost: "已连接主控", passcode: "口令", states: { ready: "待命", leading: "首端静音", recording: "正在录制", trailing: "尾端静音", saving: "正在保存", saved: "已保存", playing: "正在播放", complete: "任务已完成", error: "录制异常" }, unnamedTask: "未命名任务", unnamedSpeaker: "未命名" },
  en: { appTitle: "Script Recorder", newTask: "+ New task", taskAndSpeaker: "Task & Speaker", taskName: "Task name", speakerName: "Speaker name", gender: "Gender", female: "Female", male: "Male", other: "Other", age: "Age", importScript: "Import TXT script", openDataDirectory: "Open data folder", deleteTask: "Delete task", currentTake: "CURRENT TAKE", ready: "Ready", prompt: "Prompt", readingText: "Reading text", fontSize: "Size", previous: "Previous", next: "Next", startRecording: "Start recording", stopRecording: "Stop recording", play: "Play", completeTask: "Complete task", recordingSavedAsWav: "Desktop recordings are saved as WAV.", syncRecording: "Multi-device sync recording", syncSubtitle: "Create a host room or join a phone/desktop host", deviceName: "Device name", hostIp: "Host IP", port: "Port", roomCode: "Room code", hostRoom: "Create host room", joinRoom: "Join room", enterSync: "Enter sync recording", closeSync: "Close sync", desktopSettings: "Desktop recording settings", settingsSubtitle: "WAV settings and directory structure matching mobile", sampleRate: "Sample rate", channels: "Channels", mono: "Mono", stereo: "Stereo", bitDepth: "Bit depth", microphone: "Microphone", loadingMicrophones: "Loading microphones…", leadingSilence: "Leading silence (ms)", trailingSilence: "Trailing silence (ms)", recordingPath: "Recording path", choose: "Choose", settingsDescription: "New WAV recordings use the saved sample rate, channels and bit depth.", editSettings: "Edit settings", saveSettings: "Save settings", noScript: "No script imported", importToShowPrompt: "Import a script to show its prompt", importToShowReading: "Import a TXT script first", noPrompt: "No prompt", recorded: "Recorded", pending: "Pending", sentence: "lines", script: "Script", continueRecording: "Continue", singleWaiting: "Single-device recording · waiting for sync", hostRoomStatus: "Host room", connectedHost: "Connected to host", clients: "clients", hostInfoIdle: "Create a room to show this device's IP, port and code.", hostAddress: "Host", connectedToHost: "Connected to host", passcode: "Code", states: { ready: "Ready", leading: "Leading silence", recording: "Recording", trailing: "Trailing silence", saving: "Saving", saved: "Saved", playing: "Playing", complete: "Task complete", error: "Recording error" }, unnamedTask: "Untitled task", unnamedSpeaker: "Unnamed" },
};
Object.assign(TRANSLATIONS.zh, { scanToJoin: "手机扫码加入", scanToJoinHint: "使用手机端“加入已有房间”的扫码按钮，地址、端口和口令会自动填入。" });
Object.assign(TRANSLATIONS.en, { scanToJoin: "Scan to join on phone", scanToJoinHint: "Use the scanner in the phone app's Join Room. Host IP, port and code will be filled automatically." });

function cleanText(value) { return String(value ?? "").trim(); }
function t(key, values = {}) {
  const dictionary = TRANSLATIONS[state.ui?.language === "en" ? "en" : "zh"];
  const source = key.split(".").reduce((value, part) => value?.[part], dictionary) || key;
  return String(source).replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? ""));
}
function applyStaticTranslations() {
  document.documentElement.lang = state.ui?.language === "en" ? "en" : "zh-CN";
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => { element.title = t(element.dataset.i18nTitle); });
}
function applyLanguage() { applyStaticTranslations(); setSettingsEditMode(state.editingSettings); render(); }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Math.round(Number(value) || minimum))); }
function normalizeUiPreferences(value) {
  const panels = value?.panelHeights || {};
  return { readingFontSize: clamp(value?.readingFontSize, 15, 50), sidebarWidth: clamp(value?.sidebarWidth, 270, 560), panelHeights: { prompt: clamp(panels.prompt, 68, 220), reading: clamp(panels.reading, 116, 440), wave: clamp(panels.wave, 120, 500) } };
}
function createTaskId() { return `desktop_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function sentenceText(sentence) { return sentence?.tokens?.map((token) => token.char).join("") || sentence?.rawText || ""; }
function currentSentence() { return state.sentences[state.currentIndex]; }
function currentProject() { return { name: cleanText(elements.projectName.value) || t("unnamedTask") }; }
function currentSpeaker() { return { name: cleanText(elements.speakerName.value) || t("unnamedSpeaker"), gender: elements.speakerGender.value, age: Number(elements.speakerAge.value || 0) }; }
function projectKey() { return `desktop|${state.sentences.length}|${state.sentences.map(sentenceText).join("\u241E").length}`; }
function setMessage(message, error = false) { elements.recordMessage.textContent = message; elements.recordMessage.style.color = error ? "#bd3047" : ""; }
function requireSentences() { if (!state.sentences.length) throw new Error("请先导入 TXT 脚本。"); }
function taskHasRecordings(task) { return task?.recorded instanceof Map ? task.recorded.size > 0 : Array.isArray(task?.recorded) && task.recorded.length > 0; }
function taskLocked() { return state.recorded.size > 0; }
function serializeTask(task) { return { ...task, recorded: task.recorded instanceof Map ? [...task.recorded.entries()] : task.recorded || [] }; }
async function persistTaskWorkspace() { await bridge.saveTaskWorkspace({ current: serializeTask(captureCurrentTask()), archive: state.taskArchive.map(serializeTask) }); }
function getAutoNext(index, total) { return index + 1 < total ? index + 1 : undefined; }
function stopPlayback() {
  if (state.playbackFrame) cancelAnimationFrame(state.playbackFrame);
  state.playbackFrame = 0;
  if (state.playing) { state.playing.pause(); state.playing.currentTime = 0; state.playing = null; }
  state.playbackProgress = 0;
  scheduleWaveDraw();
}
function formatDuration(milliseconds) { const totalTenths = Math.max(0, Math.ceil(milliseconds / 100)); return `${Math.floor(totalTenths / 10)}.${totalTenths % 10}s`; }
function updateRecordPhase() {
  const labels = TRANSLATIONS[state.ui.language === "en" ? "en" : "zh"].states;
  const countdown = state.phase === "leading" || state.phase === "trailing" ? ` · ${formatDuration(state.phaseEndsAt - Date.now())}` : state.phase === "recording" ? ` · ${formatDuration(Date.now() - state.phaseStartedAt)}` : "";
  elements.recordState.textContent = `${labels[state.phase] || labels.ready}${countdown}`;
  elements.recordState.className = `record-state phase-${state.phase}`;
}
function setRecordPhase(phase, durationMs = 0) {
  if (state.phaseTimer) clearInterval(state.phaseTimer);
  state.phaseTimer = null;
  state.phase = phase;
  state.phaseStartedAt = Date.now();
  state.phaseEndsAt = durationMs ? state.phaseStartedAt + durationMs : 0;
  updateRecordPhase();
  if (phase === "leading" || phase === "trailing" || phase === "recording") state.phaseTimer = setInterval(updateRecordPhase, 100);
}

function parseScript(content) {
  const lines = String(content).replace(/^\uFEFF/, "").replace(/\r\n|\r|\n/g, "\n").split("\n").filter((line) => line.trim());
  if (!lines.length) throw new Error("脚本文件为空。");
  return lines.map((line, index) => {
    let parsed;
    try { parsed = JSON.parse(line); } catch { throw new Error(`第 ${index + 1} 行不是合法 JSON。`); }
    if (!Array.isArray(parsed)) throw new Error(`第 ${index + 1} 行必须是 JSON 数组。`);
    const tokens = parsed.filter((item) => item && typeof item === "object" && "char" in item).map((item) => ({ char: String(item.char), pinyin: item.pinyin ? String(item.pinyin) : undefined }));
    if (!tokens.length) throw new Error(`第 ${index + 1} 行缺少 char 字段。`);
    const marker = parsed.find((item) => item && typeof item === "object" && typeof item.Mark === "string");
    return { index: index + 1, tokens, rawText: tokens.map((item) => item.char).join(""), prompt: marker?.Mark?.trim?.() || "" };
  });
}

function setSettingsEditMode(editing) {
  state.editingSettings = editing;
  settingsFields.forEach((key) => { elements[key].disabled = !editing; });
  elements.choosePathButton.disabled = !editing;
  elements.settingsActionButton.textContent = editing ? t("saveSettings") : t("editSettings");
  elements.settingsActionButton.classList.toggle("primary", true);
}

function applyUiPreferences() {
  state.ui = normalizeUiPreferences(state.ui);
  const { readingFontSize, sidebarWidth, panelHeights } = state.ui;
  const pinyinSize = Math.max(11, Math.round(readingFontSize * 0.45));
  elements.promptCard.style.setProperty("--panel-height", `${panelHeights.prompt}px`);
  elements.workspace.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  elements.readingCard.style.setProperty("--panel-height", `${panelHeights.reading}px`);
  elements.waveShell.style.setProperty("--panel-height", `${panelHeights.wave}px`);
  elements.readingText.style.setProperty("--reading-font-size", `${readingFontSize}px`);
  elements.readingText.style.setProperty("--pinyin-font-size", `${pinyinSize}px`);
  elements.readingFontSize.value = String(readingFontSize);
  elements.readingFontSizeValue.value = String(readingFontSize);
  elements.readingFontSizeValue.textContent = String(readingFontSize);
  scheduleWaveDraw();
}

async function persistUiPreferences() { state.settings = await bridge.saveSettings({ ...state.settings, ui: state.ui }); }

function beginPanelResize(event) {
  event.preventDefault();
  const panel = event.currentTarget.dataset.resizePanel;
  const target = panel === "wave" ? elements.waveShell : elements[`${panel}Card`];
  const limits = { prompt: [68, 220], reading: [116, 440], wave: [120, 500] }[panel];
  if (!target || !limits) return;
  state.resizingPanel = { panel, startY: event.clientY, startHeight: target.getBoundingClientRect().height, limits };
  document.body.classList.add("resizing-panel");
}

function movePanelResize(event) {
  if (!state.resizingPanel) return;
  const { panel, startY, startHeight, limits } = state.resizingPanel;
  state.ui.panelHeights[panel] = clamp(startHeight + event.clientY - startY, limits[0], limits[1]);
  applyUiPreferences();
}

function endPanelResize() {
  if (!state.resizingPanel) return;
  state.resizingPanel = null;
  document.body.classList.remove("resizing-panel");
  persistUiPreferences().catch((error) => setMessage(error.message, true));
}

function beginSidebarResize(event) {
  event.preventDefault();
  state.resizingSidebar = { startX: event.clientX, startWidth: state.ui.sidebarWidth };
  document.body.classList.add("resizing-sidebar");
}

function moveSidebarResize(event) {
  if (!state.resizingSidebar) return;
  state.ui.sidebarWidth = clamp(state.resizingSidebar.startWidth + event.clientX - state.resizingSidebar.startX, 270, 560);
  applyUiPreferences();
}

function endSidebarResize() {
  if (!state.resizingSidebar) return;
  state.resizingSidebar = null;
  document.body.classList.remove("resizing-sidebar");
  persistUiPreferences().catch((error) => setMessage(error.message, true));
}

function setFold(card, folded) {
  card.classList.toggle("folded", folded);
  card.querySelector(".fold-trigger")?.setAttribute("aria-expanded", String(!folded));
}

function taskHasContent(task) {
  const defaultTaskNames = new Set([TRANSLATIONS.zh.unnamedTask, TRANSLATIONS.en.unnamedTask]);
  const defaultSpeakerNames = new Set([TRANSLATIONS.zh.unnamedSpeaker, TRANSLATIONS.en.unnamedSpeaker]);
  return task.sentences.length > 0 || taskHasRecordings(task) || !defaultTaskNames.has(task.project.name) || !defaultSpeakerNames.has(task.speaker.name);
}

function captureCurrentTask() {
  return { id: state.currentTaskId || createTaskId(), project: currentProject(), speaker: currentSpeaker(), sentences: state.sentences, currentIndex: state.currentIndex, recorded: new Map(state.recorded), scriptName: state.scriptName };
}

function restoreTask(task) {
  state.currentTaskId = task.id || createTaskId();
  elements.projectName.value = task.project.name;
  elements.speakerName.value = task.speaker.name;
  elements.speakerGender.value = task.speaker.gender;
  elements.speakerAge.value = String(task.speaker.age || 0);
  state.sentences = task.sentences;
  state.currentIndex = Math.min(Math.max(0, task.currentIndex), Math.max(0, task.sentences.length - 1));
  state.recorded = new Map(task.recorded instanceof Map ? task.recorded : task.recorded || []);
  state.scriptName = task.scriptName;
  state.wave = [];
  setRecordPhase("ready");
}

function renderTaskArchive() {
  const fragment = document.createDocumentFragment();
  state.taskArchive.forEach((task) => {
    const card = document.createElement("section"); card.className = "fold-card glass archived-task folded";
    const trigger = document.createElement("button"); trigger.className = "fold-trigger"; trigger.type = "button"; trigger.setAttribute("aria-expanded", "false");
    const summary = document.createElement("span"); const title = document.createElement("b"); title.textContent = task.project.name; const subtitle = document.createElement("small"); subtitle.textContent = `${task.speaker.name} · ${task.sentences.length} ${t("sentence")} · ${task.recorded.size} ${t("recorded")}`; summary.append(title, subtitle);
    const chevron = document.createElement("span"); chevron.className = "fold-chevron"; chevron.textContent = "⌄"; trigger.append(summary, chevron); trigger.onclick = () => setFold(card, !card.classList.contains("folded"));
    const content = document.createElement("div"); content.className = "fold-content";
    const meta = document.createElement("p"); meta.className = "archived-meta"; meta.textContent = task.scriptName ? `${t("script")}: ${task.scriptName}` : t("noScript");
    const actions = document.createElement("div"); actions.className = "archived-actions";
    const open = document.createElement("button"); open.className = "button secondary"; open.type = "button"; open.textContent = t("continueRecording"); open.onclick = async () => { const current = captureCurrentTask(); if (taskHasContent(current)) state.taskArchive.push(current); state.taskArchive = state.taskArchive.filter((item) => item.id !== task.id); restoreTask(task); setFold(elements.currentTaskCard, false); await persistTaskWorkspace(); render(); };
    const remove = document.createElement("button"); remove.className = "button danger"; remove.type = "button"; remove.textContent = t("deleteTask"); remove.onclick = async () => { if (!window.confirm(`确定删除桌面任务“${task.project.name}”吗？该任务已管理的 WAV 会一并删除。`)) return; try { const result = await bridge.deleteTask({ project: task.project }); state.taskArchive = state.taskArchive.filter((item) => item.id !== task.id); await persistTaskWorkspace(); setMessage(`已删除任务及 ${result.deletedCount} 条桌面 WAV 记录。`); render(); } catch (error) { setMessage(error.message, true); } };
    actions.append(open, remove); content.append(meta, actions); card.append(trigger, content); fragment.append(card);
  });
  elements.taskArchive.replaceChildren(fragment);
}

function renderSentenceList(clientLocked) {
  const fragment = document.createDocumentFragment();
  state.sentences.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = `sentence ${index === state.currentIndex ? "active" : ""}`;
    button.disabled = clientLocked;
    const heading = document.createElement("div"); heading.className = "sentence-heading";
    const title = document.createElement("strong"); title.textContent = `${String(item.index).padStart(3, "0")} · ${sentenceText(item)}`;
    const status = document.createElement("small"); const recorded = state.recorded.has(index); status.className = `sentence-status ${recorded ? "recorded" : "pending"}`; status.textContent = recorded ? t("recorded") : t("pending");
    const prompt = document.createElement("small"); prompt.textContent = item.prompt || t("noPrompt");
    heading.append(title, status); button.append(heading, prompt); button.onclick = () => jumpTo(index, state.sync.mode === "host"); fragment.append(button);
  });
  elements.sentenceList.replaceChildren(fragment);
}

function renderSync() {
  const devices = state.sync.devices || [];
  const clientLocked = state.sync.mode === "client";
  const onlineClients = devices.filter((device) => device.role === "client" && device.detail !== "offline");
  elements.syncSummary.textContent = state.sync.mode === "idle" ? t("singleWaiting") : `${state.sync.mode === "host" ? t("hostRoomStatus") : t("connectedHost")} · ${onlineClients.length} ${t("clients")}`;
  elements.hostInfo.textContent = state.sync.mode === "host" ? `${t("hostAddress")}: ${state.sync.address}　${t("port")}: 35679　${t("passcode")}: ${state.sync.roomCode}` : state.sync.mode === "client" ? `${t("connectedToHost")}: ${state.sync.address}　${t("passcode")}: ${state.sync.roomCode}` : t("hostInfoIdle");
  renderHostInvite();
  elements.openSyncButton.disabled = state.sync.mode !== "host" || !onlineClients.length;
  [elements.recordButton, elements.previousButton, elements.nextButton, elements.playButton, elements.completeButton].forEach((button) => { button.disabled = clientLocked; });
  const dots = document.createDocumentFragment();
  devices.forEach((device) => { const dot = document.createElement("button"); dot.className = `device-dot ${device.detail === "offline" ? "offline" : ["ready", "leading", "recording", "trailing", "saving"].includes(device.state) ? "online" : "waiting"}`; dot.textContent = (device.name || "?").slice(0, 1); dot.title = `${device.name} · ${device.detail === "offline" ? "离线" : device.state}`; dots.append(dot); });
  elements.deviceDots.replaceChildren(dots);
  elements.deviceDots.classList.toggle("empty", !devices.length);
  const rows = document.createDocumentFragment();
  devices.forEach((device) => { const row = document.createElement("div"); row.className = "device-row"; const name = document.createElement("strong"); name.textContent = device.name; const status = document.createElement("span"); status.textContent = device.detail === "offline" ? "离线" : device.state; row.append(name, status); rows.append(row); });
  elements.deviceList.replaceChildren(rows);
  renderSentenceList(clientLocked);
}

function renderHostInvite() {
  if (state.sync.mode !== "host") {
    state.hostInviteKey = "";
    elements.hostInvite.hidden = true;
    elements.hostQrImage.removeAttribute("src");
    return;
  }
  const key = `${state.sync.address || ""}|${state.sync.roomCode || ""}|${state.sync.projectId || ""}`;
  elements.hostInvite.hidden = false;
  if (state.hostInviteKey === key && elements.hostQrImage.src) return;
  state.hostInviteKey = key;
  elements.hostQrImage.removeAttribute("src");
  bridge.sync.getHostInvite().then((invite) => {
    if (state.sync.mode !== "host" || state.hostInviteKey !== key) return;
    elements.hostQrImage.src = invite.qrDataUrl;
  }).catch((error) => {
    if (state.hostInviteKey === key) setMessage(error.message, true);
  });
}

function render() {
  const sentence = currentSentence();
  const locked = taskLocked();
  taskIdentityFields.forEach((field) => { elements[field].disabled = locked; });
  elements.importScriptButton.disabled = locked;
  elements.importScriptButton.title = locked ? "任务已有录音，不能更换脚本或修改任务与发音人信息。" : "导入 TXT 脚本";
  elements.scriptSummary.textContent = state.sentences.length ? `${state.sentences.length} ${t("sentence")} · ${state.scriptName || t("noScript")}${locked ? ` · ${t("recorded")}` : ""}` : t("noScript");
  elements.progressText.textContent = sentence ? state.ui.language === "en" ? `Sentence ${state.currentIndex + 1} / ${state.sentences.length}` : `第 ${state.currentIndex + 1} / ${state.sentences.length} 句` : t("noScript");
  elements.promptText.textContent = sentence?.prompt || t("importToShowPrompt");
  renderReadingText(sentence);
  renderSync(); renderTaskArchive(); scheduleWaveDraw();
}

function renderReadingText(sentence) {
  const tokens = sentence?.tokens || [];
  if (!tokens.length) { elements.readingText.textContent = t("importToShowReading"); return; }
  const fragment = document.createDocumentFragment();
  tokens.forEach((token, index) => {
    const unit = document.createElement("span"); unit.className = "phonetic-token";
    const pinyin = document.createElement("small"); pinyin.className = "phonetic-pinyin"; pinyin.textContent = token.pinyin || " ";
    const character = document.createElement("strong"); character.className = "phonetic-character"; character.textContent = token.char;
    unit.append(pinyin, character); unit.dataset.tokenIndex = String(index); fragment.append(unit);
  });
  elements.readingText.replaceChildren(fragment);
}

async function listMicrophones() {
  try { const temporary = await navigator.mediaDevices.getUserMedia({ audio: true }); temporary.getTracks().forEach((track) => track.stop()); const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput"); elements.microphone.replaceChildren(...inputs.map((device, index) => new Option(device.label || `${t("microphone")} ${index + 1}`, device.deviceId))); }
  catch (error) { elements.microphone.replaceChildren(new Option("麦克风权限未授予", "")); setMessage(`无法读取麦克风：${error.message}`, true); }
}

const WAVE_SAMPLE_INTERVAL = 25;

function scheduleWaveDraw() { if (state.waveRenderFrame) return; state.waveRenderFrame = requestAnimationFrame(() => { state.waveRenderFrame = 0; drawWave(); }); }

function startPlaybackCursor() {
  if (state.playbackFrame) cancelAnimationFrame(state.playbackFrame);
  const advance = () => {
    const audio = state.playing;
    if (!audio) return;
    state.playbackProgress = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.min(1, Math.max(0, audio.currentTime / audio.duration)) : 0;
    scheduleWaveDraw();
    state.playbackFrame = requestAnimationFrame(advance);
  };
  state.playbackFrame = requestAnimationFrame(advance);
}

function getRealtimeAmplitude() {
  if (!state.analyser) return 0;
  const data = new Uint8Array(state.analyser.fftSize);
  state.analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let index = 0; index < data.length; index += 1) { const value = (data[index] - 128) / 128; sum += value * value; }
  return Math.min(1, Math.sqrt(sum / data.length) * 3.8);
}

function startRealtimeWaveform() {
  const capture = (timestamp) => {
    if (!state.audio || !state.analyser) return;
    state.waveCaptureFrame = requestAnimationFrame(capture);
    if (timestamp - state.waveLastSampleAt < WAVE_SAMPLE_INTERVAL) return;
    state.waveLastSampleAt = timestamp;
    state.wave.push(getRealtimeAmplitude());
    scheduleWaveDraw();
  };
  state.waveLastSampleAt = 0;
  state.waveCaptureFrame = requestAnimationFrame(capture);
}

function stopRealtimeWaveform() {
  if (state.waveCaptureFrame) cancelAnimationFrame(state.waveCaptureFrame);
  state.waveCaptureFrame = 0;
}

function calculateRmsAmplitude(samples, start, end) {
  let sum = 0;
  for (let index = start; index < end; index += 1) { const value = samples[index] || 0; sum += value * value; }
  return Math.min(1, Math.sqrt(sum / Math.max(1, end - start)) * 3.8);
}

async function loadPlaybackWaveform(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法读取 WAV 波形：${response.status}`);
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData((await response.arrayBuffer()).slice(0));
    const samples = decoded.getChannelData(0);
    const samplesPerWindow = Math.max(1, Math.round(decoded.sampleRate * (WAVE_SAMPLE_INTERVAL / 1000)));
    const values = [];
    for (let start = 0; start < samples.length; start += samplesPerWindow) values.push(calculateRmsAmplitude(samples, start, Math.min(samples.length, start + samplesPerWindow)));
    state.wave = values;
    scheduleWaveDraw();
  } finally { await decoder.close(); }
}

function drawWave() {
  const canvas = elements.waveCanvas; const bounds = canvas.getBoundingClientRect(); const pixelRatio = window.devicePixelRatio || 1; const width = Math.max(1, Math.floor(bounds.width)); const height = Math.max(1, Math.floor(bounds.height));
  if (canvas.width !== width * pixelRatio || canvas.height !== height * pixelRatio) { canvas.width = width * pixelRatio; canvas.height = height * pixelRatio; }
  const context = canvas.getContext("2d"); context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); context.clearRect(0, 0, width, height); context.fillStyle = "#101113"; context.fillRect(0, 0, width, height);
  const center = height / 2; context.strokeStyle = "rgba(255,255,255,.10)"; context.lineWidth = 1; context.beginPath(); context.moveTo(0, center); context.lineTo(width, center); context.stroke();
  const isRecording = Boolean(state.audio); const isPlaying = Boolean(state.playing); const cursorRatio = isRecording ? 1 : isPlaying ? state.playbackProgress : 0;
  elements.waveCursor.classList.toggle("active", isRecording || isPlaying); elements.waveCursor.classList.toggle("playing", isPlaying); elements.waveCursor.style.left = `${Math.max(0, Math.min(width - 1, Math.round(cursorRatio * width)))}px`;
  if (!state.wave.length) return;
  const maxPoints = Math.max(1, Math.min(state.wave.length, Math.floor(width))); const step = state.wave.length / maxPoints; const maxHeight = height * .44; const points = [];
  for (let index = 0; index < maxPoints; index += 1) { const start = Math.floor(index * step); const end = Math.max(start + 1, Math.floor((index + 1) * step)); let amplitude = 0; for (let sample = start; sample < end && sample < state.wave.length; sample += 1) amplitude = Math.max(amplitude, state.wave[sample] || 0); points.push({ x: index * (width / maxPoints), amplitude: Math.max(amplitude, .015) }); }
  const upperPath = new Path2D(); const lowerPath = new Path2D(); upperPath.moveTo(0, center); points.forEach((point) => upperPath.lineTo(point.x, center - point.amplitude * maxHeight)); upperPath.lineTo(width, center); lowerPath.moveTo(width, center); points.slice().reverse().forEach((point) => lowerPath.lineTo(point.x, center + point.amplitude * maxHeight)); lowerPath.lineTo(0, center);
  const waveform = new Path2D(); waveform.addPath(upperPath); waveform.addPath(lowerPath); context.fillStyle = "#42d66b"; context.fill(waveform); context.globalAlpha = .15; context.fillStyle = "#ffffff"; context.fill(upperPath); context.globalAlpha = 1;
}

async function startRecording() {
  requireSentences(); if (state.audio) return;
  stopPlayback();
  const settings = state.settings; const constraints = { audio: { deviceId: elements.microphone.value ? { exact: elements.microphone.value } : undefined, channelCount: settings.channels, sampleRate: settings.sampleRate, echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
  state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints); const audio = new AudioContext({ sampleRate: settings.sampleRate }); const source = audio.createMediaStreamSource(state.mediaStream); const analyser = audio.createAnalyser(); const processor = audio.createScriptProcessor(4096, settings.channels, settings.channels); const silence = audio.createGain(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .75; silence.gain.value = 0;
  state.audio = audio; state.analyser = analyser; state.chunks = Array.from({ length: settings.channels }, () => []); state.wave = [];
  processor.onaudioprocess = (event) => { for (let channel = 0; channel < settings.channels; channel += 1) state.chunks[channel].push(new Float32Array(event.inputBuffer.getChannelData(Math.min(channel, event.inputBuffer.numberOfChannels - 1)))); };
  source.connect(analyser); source.connect(processor); processor.connect(silence); silence.connect(audio.destination); state.audioNode = { source, analyser, processor, silence }; startRealtimeWaveform(); scheduleWaveDraw();
  elements.recordButton.textContent = t("stopRecording"); setRecordPhase(settings.leadingSilenceMs ? "leading" : "recording", settings.leadingSilenceMs); await bridge.sync.state({ state: settings.leadingSilenceMs ? "leading" : "recording", sentenceIndex: state.currentIndex });
  if (settings.leadingSilenceMs) state.leadingTimer = setTimeout(() => { if (state.audio) { setRecordPhase("recording"); bridge.sync.state({ state: "recording", sentenceIndex: state.currentIndex }); } }, settings.leadingSilenceMs);
}

function flatten(channelChunks) { const length = channelChunks.reduce((total, chunk) => total + chunk.length, 0); const result = new Float32Array(length); let offset = 0; channelChunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; }); return result; }
function encodeWav(chunks, channels, sampleRate, bitDepth) { const data = chunks.map(flatten); const samples = data[0]?.length || 0; const bytesPerSample = bitDepth / 8; const blockAlign = channels * bytesPerSample; const buffer = new ArrayBuffer(44 + samples * blockAlign); const view = new DataView(buffer); const write = (offset, value) => view.setUint8(offset, value.charCodeAt(0)); ["RIFF", "WAVE", "fmt ", "data"].forEach((text, group) => text.split("").forEach((char, index) => write([0, 8, 12, 36][group] + index, char))); view.setUint32(4, 36 + samples * blockAlign, true); view.setUint32(16, 16, true); view.setUint16(20, bitDepth === 32 ? 3 : 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, bitDepth, true); view.setUint32(40, samples * blockAlign, true); let offset = 44; for (let sample = 0; sample < samples; sample += 1) for (let channel = 0; channel < channels; channel += 1) { const value = Math.max(-1, Math.min(1, data[channel][sample] || 0)); if (bitDepth === 16) { view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true); offset += 2; } else { view.setFloat32(offset, value, true); offset += 4; } } return new Uint8Array(buffer); }
function bytesToBase64(bytes) { let binary = ""; const size = 0x8000; for (let offset = 0; offset < bytes.length; offset += size) binary += String.fromCharCode(...bytes.subarray(offset, offset + size)); return btoa(binary); }

async function stopRecording() {
  if (!state.audio) return; const settings = state.settings; if (state.leadingTimer) clearTimeout(state.leadingTimer); state.leadingTimer = null; setRecordPhase(settings.trailingSilenceMs ? "trailing" : "saving", settings.trailingSilenceMs); await bridge.sync.state({ state: settings.trailingSilenceMs ? "trailing" : "saving", sentenceIndex: state.currentIndex }); if (settings.trailingSilenceMs) await new Promise((resolve) => setTimeout(resolve, settings.trailingSilenceMs)); setRecordPhase("saving");
  const audio = state.audio; const { source, analyser, processor, silence } = state.audioNode; stopRealtimeWaveform(); source.disconnect(); analyser.disconnect(); processor.disconnect(); silence.disconnect(); state.mediaStream.getTracks().forEach((track) => track.stop()); await audio.close(); state.audio = null; state.analyser = null; state.audioNode = null; scheduleWaveDraw();
  const sentence = currentSentence(); const bytes = encodeWav(state.chunks, settings.channels, audio.sampleRate, settings.bitDepth); const result = await bridge.saveRecording({ project: currentProject(), speaker: currentSpeaker(), sentenceIndex: sentence.index, base64: bytesToBase64(bytes) }); state.recorded.set(state.currentIndex, result.path); await persistTaskWorkspace(); elements.recordButton.textContent = t("startRecording"); setRecordPhase("saved"); await bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex });
  const nextIndex = getAutoNext(state.currentIndex, state.sentences.length); if (nextIndex === undefined) setMessage(`已保存：${result.fileName}。全部句子已完成；选择目标句后再次录制即可覆盖旧文件。`); else { state.currentIndex = nextIndex; setMessage(`已保存：${result.fileName}。已自动跳到第 ${nextIndex + 1} 句。`); } render();
}

async function jumpTo(index, sendCommand = false) { if (index < 0 || index >= state.sentences.length) return; stopPlayback(); state.currentIndex = index; await persistTaskWorkspace(); if (sendCommand) await bridge.sync.command("jump", index); await bridge.sync.state({ state: state.sync.mode === "idle" ? "idle" : "ready", sentenceIndex: index }); render(); }
function waitForAudioMetadata(audio) {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => { audio.removeEventListener("loadedmetadata", ready); audio.removeEventListener("error", failed); };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("无法读取 WAV 播放时长。")); };
    audio.addEventListener("loadedmetadata", ready, { once: true });
    audio.addEventListener("error", failed, { once: true });
  });
}

async function playCurrent(startRatio = 0) {
  const saved = await bridge.getRecording({ project: currentProject(), speaker: currentSpeaker(), sentenceIndex: currentSentence()?.index });
  if (!saved?.url) { setMessage("当前句尚未录制。", true); return; }
  stopPlayback(); state.wave = []; scheduleWaveDraw();
  try { await loadPlaybackWaveform(saved.url); } catch (error) { console.warn("无法解析播放波形", error); }
  const audio = new Audio(saved.url); audio.preload = "auto"; await waitForAudioMetadata(audio);
  const ratio = Math.min(1, Math.max(0, Number(startRatio) || 0));
  audio.currentTime = Number.isFinite(audio.duration) ? ratio * audio.duration : 0;
  state.playing = audio; state.playbackProgress = ratio; setRecordPhase("playing"); setMessage(`播放：${saved.path}`);
  audio.onended = () => { if (state.playing === audio) { state.playing = null; state.playbackProgress = 0; if (state.playbackFrame) cancelAnimationFrame(state.playbackFrame); state.playbackFrame = 0; setRecordPhase("ready"); scheduleWaveDraw(); } };
  audio.onerror = () => { if (state.playing === audio) { stopPlayback(); setRecordPhase("error"); setMessage("无法播放当前 WAV 文件。", true); } };
  await audio.play(); startPlaybackCursor();
}

function playFromWaveform(event) {
  if (state.audio || state.sync.mode === "client") return;
  const bounds = elements.waveCanvas.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
  playCurrent(ratio).catch((error) => setMessage(error.message, true));
}
async function requestRecordToggle() { if (state.sync.mode === "client") return; if (state.sync.mode === "host") await bridge.sync.command(state.audio ? "stop" : "start", state.currentIndex); else if (state.audio) await stopRecording(); else await startRecording(); }
async function requestJump(delta) { const target = Math.min(state.sentences.length - 1, Math.max(0, state.currentIndex + delta)); if (target === state.currentIndex || state.sync.mode === "client") return; if (state.sync.mode === "host") await bridge.sync.command(delta < 0 ? "previous" : "next", target); else await jumpTo(target); }
async function enterSyncRecording() { if (state.sync.mode !== "host") return; await bridge.sync.command("open", state.currentIndex); await bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); setMessage("已通知所有在线设备进入同步录制。"); }
function schedule(command, callback) { const rawDelay = Number(command.executeAt || Date.now()) - Date.now(); setTimeout(callback, rawDelay > 0 && rawDelay <= 2_000 ? rawDelay : 0); }
function remoteSentenceIndex(value) { const index = Number(value); return Number.isInteger(index) ? Math.min(state.sentences.length - 1, Math.max(0, index)) : state.currentIndex; }
function applyRemoteSentence(command, message) { state.currentIndex = remoteSentenceIndex(command.sentenceIndex); setMessage(message); bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); render(); }
async function handleCommand(command) { if (command.name === "open") return schedule(command, () => applyRemoteSentence(command, "主控已进入同步录制。")); if (command.name === "start") return schedule(command, () => startRecording().catch((error) => setMessage(error.message, true))); if (command.name === "stop") return schedule(command, () => stopRecording().catch((error) => setMessage(error.message, true))); if (command.name === "cancel") return schedule(command, () => { if (state.audio) stopRecording().catch((error) => setMessage(error.message, true)); else { setRecordPhase("ready"); bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); } }); if (command.name === "previous" || command.name === "next" || command.name === "jump" || command.name === "rerecord") return schedule(command, () => applyRemoteSentence(command, `主控已跳转到第 ${remoteSentenceIndex(command.sentenceIndex) + 1} 句。`)); if (command.name === "play") return schedule(command, () => playCurrent().catch((error) => setMessage(error.message, true))); if (command.name === "complete") return schedule(command, () => completeCurrentTask("主控已完成同步任务，当前录音已保留。点击左侧任务模块可继续查看或重录。").catch((error) => setMessage(error.message, true))); }

async function completeCurrentTask(message = "任务已完成。点击左侧任务与发音人模块可继续查看或重录。") {
  if (state.audio) await stopRecording();
  setRecordPhase("complete");
  setMessage(message);
  setFold(elements.currentTaskCard, true);
  await persistTaskWorkspace();
  render();
}

async function hydrateRecordedState({ persist = true } = {}) { if (!state.sentences.length) { state.recorded.clear(); render(); if (persist) await persistTaskWorkspace(); return; } const project = currentProject(); const speaker = currentSpeaker(); const saved = await Promise.all(state.sentences.map((sentence, index) => bridge.getRecording({ project, speaker, sentenceIndex: sentence.index }).then((recording) => ({ index, recording })))); state.recorded.clear(); saved.forEach(({ index, recording }) => { if (recording?.path) state.recorded.set(index, recording.path); }); render(); if (persist) await persistTaskWorkspace(); }
async function resetCurrentTask({ resetIdentity }) {
  if (state.audio) throw new Error("请先停止当前录制，再新建或删除任务。");
  stopPlayback();
  if (state.sync.mode !== "idle") state.sync = await bridge.sync.stop();
  state.sentences = []; state.currentIndex = 0; state.scriptName = ""; state.recorded.clear(); state.wave = []; state.currentTaskId = createTaskId();
  if (resetIdentity) { elements.projectName.value = t("unnamedTask"); elements.speakerName.value = t("unnamedSpeaker"); elements.speakerGender.value = "其他"; elements.speakerAge.value = "0"; }
  setRecordPhase("ready"); render();
}
elements.importScriptButton.onclick = async () => { try { if (taskLocked()) throw new Error("任务已有录音，不能更换脚本。请新建任务，或先删除当前任务。 "); const file = await bridge.openScript(); if (!file) return; state.sentences = parseScript(file.content); state.scriptName = file.name; state.currentIndex = 0; state.recorded.clear(); await hydrateRecordedState({ persist: false }); await persistTaskWorkspace(); setMessage(`已导入 ${state.sentences.length} 句脚本。`); render(); } catch (error) { setMessage(error.message, true); } };
elements.newTaskButton.onclick = async () => { try { if (!window.confirm("新建任务会关闭当前同步会话。当前任务会保留为可展开模块，已保存 WAV 文件不会删除。是否继续？")) return; const previous = captureCurrentTask(); if (taskHasContent(previous)) state.taskArchive.push(previous); await resetCurrentTask({ resetIdentity: true }); setFold(elements.currentTaskCard, false); await persistTaskWorkspace(); setMessage("已新建空任务，现在可以立即填写任务与发音人信息，再导入 TXT 脚本。"); } catch (error) { setMessage(error.message, true); } };
elements.deleteTaskButton.onclick = async () => { try { const project = currentProject(); if (!window.confirm(`确定删除桌面任务“${project.name}”吗？该任务已管理的 WAV 文件会一并删除，此操作不可恢复。`)) return; const result = await bridge.deleteTask({ project }); await resetCurrentTask({ resetIdentity: true }); await persistTaskWorkspace(); setMessage(`已删除任务及 ${result.deletedCount} 条桌面 WAV 记录。`); } catch (error) { setMessage(error.message, true); } };
elements.settingsActionButton.onclick = async () => { try { if (!state.editingSettings) { setSettingsEditMode(true); setMessage("现在可以修改电脑录音配置。修改后请保存。"); return; } state.settings = await bridge.saveSettings({ sampleRate: Number(elements.sampleRate.value), channels: Number(elements.channels.value), bitDepth: Number(elements.bitDepth.value), leadingSilenceMs: Number(elements.leadingSilenceMs.value), trailingSilenceMs: Number(elements.trailingSilenceMs.value), recordingRoot: elements.recordingRoot.value }); setSettingsEditMode(false); setMessage("电脑录音配置已保存。新录制将使用此配置。"); } catch (error) { setMessage(error.message, true); } };
elements.choosePathButton.onclick = async () => { const directory = await bridge.chooseDirectory(); if (directory) elements.recordingRoot.value = directory; };
elements.openTaskDirectoryButton.onclick = async () => { try { const result = await bridge.openTaskDirectory({ project: currentProject(), speaker: currentSpeaker() }); setMessage(`已打开数据目录：${result.directory}`); } catch (error) { setMessage(error.message, true); } };
elements.waveCanvas.addEventListener("click", playFromWaveform);
elements.recordButton.onclick = () => requestRecordToggle().catch((error) => setMessage(error.message, true)); elements.previousButton.onclick = () => requestJump(-1).catch((error) => setMessage(error.message, true)); elements.nextButton.onclick = () => requestJump(1).catch((error) => setMessage(error.message, true)); elements.playButton.onclick = () => { if (state.sync.mode === "host") bridge.sync.command("play", state.currentIndex); else playCurrent().catch((error) => setMessage(error.message, true)); }; elements.completeButton.onclick = () => { if (state.sync.mode === "host") bridge.sync.command("complete", state.currentIndex); else completeCurrentTask().catch((error) => setMessage(error.message, true)); };
elements.hostButton.onclick = async () => { try { requireSentences(); state.sync = await bridge.sync.host({ projectId: projectKey(), sentenceCount: state.sentences.length, deviceName: elements.deviceName.value }); elements.roomCode.value = state.sync.roomCode; render(); } catch (error) { setMessage(error.message, true); } }; elements.joinButton.onclick = async () => { try { requireSentences(); state.sync = await bridge.sync.join({ host: elements.hostIp.value.trim(), port: Number(elements.hostPort.value), roomCode: elements.roomCode.value, projectId: projectKey(), sentenceCount: state.sentences.length, deviceName: elements.deviceName.value }); render(); } catch (error) { setMessage(error.message, true); } }; elements.closeSyncButton.onclick = async () => { state.sync = await bridge.sync.stop(); render(); }; elements.openSyncButton.onclick = enterSyncRecording;
document.querySelectorAll(".fold-card").forEach((card) => card.querySelector(".fold-trigger").onclick = () => setFold(card, !card.classList.contains("folded")));
taskIdentityFields.forEach((field) => { elements[field].oninput = () => { if (!taskLocked()) persistTaskWorkspace().catch((error) => setMessage(error.message, true)); }; });
elements.readingFontSize.oninput = () => { state.ui.readingFontSize = clamp(elements.readingFontSize.value, 15, 50); applyUiPreferences(); };
elements.readingFontSize.onchange = () => { persistUiPreferences().catch((error) => setMessage(error.message, true)); };
document.querySelectorAll("[data-resize-panel]").forEach((handle) => handle.addEventListener("pointerdown", beginPanelResize));
elements.sidebarResizeHandle.addEventListener("pointerdown", beginSidebarResize);
window.addEventListener("pointermove", movePanelResize);
window.addEventListener("pointerup", endPanelResize);
window.addEventListener("pointermove", moveSidebarResize);
window.addEventListener("pointerup", endSidebarResize);
elements.projectName.onchange = () => { if (!taskLocked()) hydrateRecordedState().catch((error) => setMessage(error.message, true)); }; elements.speakerName.onchange = () => { if (!taskLocked()) hydrateRecordedState().catch((error) => setMessage(error.message, true)); }; elements.speakerGender.onchange = () => { if (!taskLocked()) persistTaskWorkspace().catch((error) => setMessage(error.message, true)); }; elements.speakerAge.onchange = () => { if (!taskLocked()) persistTaskWorkspace().catch((error) => setMessage(error.message, true)); };
bridge.sync.onEvent((event) => { state.sync = event.session || state.sync; if (event.type === "command" && event.payload) handleCommand(event.payload); render(); });
bridge.onLanguage((language) => { state.ui.language = language === "en" ? "en" : "zh"; applyLanguage(); if (state.settings) persistUiPreferences().catch((error) => setMessage(error.message, true)); });
window.addEventListener("resize", scheduleWaveDraw);
(async () => { state.settings = await bridge.getSettings(); state.ui = normalizeUiPreferences(state.settings.ui); for (const key of ["sampleRate", "channels", "bitDepth", "leadingSilenceMs", "trailingSilenceMs", "recordingRoot"]) elements[key].value = state.settings[key]; const workspace = await bridge.getTaskWorkspace(); state.taskArchive = (workspace.archive || []).map((task) => ({ ...task, recorded: new Map(task.recorded || []) })); if (workspace.current) restoreTask({ ...workspace.current, recorded: new Map(workspace.current.recorded || []) }); else await resetCurrentTask({ resetIdentity: true }); elements.deviceName.value = await bridge.getDeviceName(); state.sync = await bridge.sync.status(); await listMicrophones(); setSettingsEditMode(false); applyUiPreferences(); applyStaticTranslations(); await hydrateRecordedState({ persist: true }); render(); })().catch((error) => setMessage(error.message, true));
