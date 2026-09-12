const bridge = window.desktopBridge;
const elementIds = [
  "projectName", "speakerName", "speakerGender", "speakerAge", "scriptSummary", "sentenceList", "promptText", "readingText", "progressText", "recordState", "recordMessage", "deviceDots", "deviceName", "hostIp", "hostPort", "roomCode", "hostInfo", "deviceList", "syncSummary", "sampleRate", "channels", "bitDepth", "leadingSilenceMs", "trailingSilenceMs", "microphone", "recordingRoot", "waveCanvas", "recordButton", "previousButton", "nextButton", "playButton", "completeButton", "openSyncButton", "closeSyncButton", "hostButton", "joinButton", "choosePathButton", "settingsActionButton", "importScriptButton", "newTaskButton", "deleteTaskButton",
];
const elements = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));
const missingElement = elementIds.find((id) => !elements[id]);
if (missingElement) throw new Error(`桌面录音界面缺少必要元素：${missingElement}`);

const state = { sentences: [], currentIndex: 0, settings: null, sync: { mode: "idle", devices: [] }, audio: null, audioNode: null, mediaStream: null, chunks: [], playing: null, recorded: new Map(), wave: [], waveFrame: 0, leadingTimer: null, phaseTimer: null, phase: "ready", phaseEndsAt: 0, phaseStartedAt: 0, scriptName: "", editingSettings: false };
const settingsFields = ["sampleRate", "channels", "bitDepth", "leadingSilenceMs", "trailingSilenceMs", "microphone", "recordingRoot"];

function cleanText(value) { return String(value ?? "").trim(); }
function sentenceText(sentence) { return sentence?.tokens?.map((token) => token.char).join("") || sentence?.rawText || ""; }
function currentSentence() { return state.sentences[state.currentIndex]; }
function currentProject() { return { name: cleanText(elements.projectName.value) || "未命名任务" }; }
function currentSpeaker() { return { name: cleanText(elements.speakerName.value) || "未命名", gender: elements.speakerGender.value, age: Number(elements.speakerAge.value || 0) }; }
function projectKey() { return `desktop|${state.sentences.length}|${state.sentences.map(sentenceText).join("\u241E").length}`; }
function setMessage(message, error = false) { elements.recordMessage.textContent = message; elements.recordMessage.style.color = error ? "#bd3047" : ""; }
function requireSentences() { if (!state.sentences.length) throw new Error("请先导入 TXT 脚本。"); }
function getAutoNext(index, total) { return index + 1 < total ? index + 1 : undefined; }
function stopPlayback() { if (!state.playing) return; state.playing.pause(); state.playing.currentTime = 0; state.playing = null; }
function formatDuration(milliseconds) { const totalTenths = Math.max(0, Math.ceil(milliseconds / 100)); return `${Math.floor(totalTenths / 10)}.${totalTenths % 10}s`; }
function updateRecordPhase() {
  const labels = { ready: "待命", leading: "首端静音", recording: "正在录制", trailing: "尾端静音", saving: "正在保存", saved: "已保存", playing: "正在播放", complete: "任务已完成", error: "录制异常" };
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
  elements.settingsActionButton.textContent = editing ? "保存配置" : "修改配置";
  elements.settingsActionButton.classList.toggle("primary", true);
}

function setFold(card, folded) {
  card.classList.toggle("folded", folded);
  card.querySelector(".fold-trigger")?.setAttribute("aria-expanded", String(!folded));
}

function renderSentenceList(clientLocked) {
  const fragment = document.createDocumentFragment();
  state.sentences.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = `sentence ${index === state.currentIndex ? "active" : ""}`;
    button.disabled = clientLocked;
    const heading = document.createElement("div"); heading.className = "sentence-heading";
    const title = document.createElement("strong"); title.textContent = `${String(item.index).padStart(3, "0")} · ${sentenceText(item)}`;
    const status = document.createElement("small"); const recorded = state.recorded.has(index); status.className = `sentence-status ${recorded ? "recorded" : "pending"}`; status.textContent = recorded ? "已录" : "未录";
    const prompt = document.createElement("small"); prompt.textContent = item.prompt || "无提示词";
    heading.append(title, status); button.append(heading, prompt); button.onclick = () => jumpTo(index, state.sync.mode === "host"); fragment.append(button);
  });
  elements.sentenceList.replaceChildren(fragment);
}

function renderSync() {
  const devices = state.sync.devices || [];
  const clientLocked = state.sync.mode === "client";
  const onlineClients = devices.filter((device) => device.role === "client" && device.detail !== "offline");
  elements.syncSummary.textContent = state.sync.mode === "idle" ? "单机录音 · 等待同步" : `${state.sync.mode === "host" ? "主控房间" : "已连接主控"} · ${onlineClients.length} 台客户端`;
  elements.hostInfo.textContent = state.sync.mode === "host" ? `主控地址：${state.sync.address}　端口：35679　口令：${state.sync.roomCode}` : state.sync.mode === "client" ? `已连接主控：${state.sync.address}　口令：${state.sync.roomCode}` : "创建房间后显示本机 IP、端口与口令。";
  elements.openSyncButton.disabled = state.sync.mode !== "host" || !onlineClients.length;
  [elements.recordButton, elements.previousButton, elements.nextButton, elements.playButton, elements.completeButton].forEach((button) => { button.disabled = clientLocked; });
  const dots = document.createDocumentFragment();
  devices.forEach((device) => { const dot = document.createElement("button"); dot.className = `device-dot ${device.detail === "offline" ? "offline" : ["ready", "leading", "recording", "trailing", "saving"].includes(device.state) ? "online" : "waiting"}`; dot.textContent = (device.name || "?").slice(0, 1); dot.title = `${device.name} · ${device.detail === "offline" ? "离线" : device.state}`; dots.append(dot); });
  elements.deviceDots.replaceChildren(dots);
  const rows = document.createDocumentFragment();
  devices.forEach((device) => { const row = document.createElement("div"); row.className = "device-row"; const name = document.createElement("strong"); name.textContent = device.name; const status = document.createElement("span"); status.textContent = device.detail === "offline" ? "离线" : device.state; row.append(name, status); rows.append(row); });
  elements.deviceList.replaceChildren(rows);
  renderSentenceList(clientLocked);
}

function render() {
  const sentence = currentSentence();
  elements.scriptSummary.textContent = state.sentences.length ? `已导入 ${state.sentences.length} 句 · ${state.scriptName || "未命名脚本"}` : "尚未导入脚本";
  elements.progressText.textContent = sentence ? `第 ${state.currentIndex + 1} / ${state.sentences.length} 句` : "尚未导入脚本";
  elements.promptText.textContent = sentence?.prompt || "导入脚本后显示提示词";
  elements.readingText.textContent = sentenceText(sentence) || "请先导入 TXT 脚本";
  renderSync(); scheduleWaveDraw();
}

async function listMicrophones() {
  try { const temporary = await navigator.mediaDevices.getUserMedia({ audio: true }); temporary.getTracks().forEach((track) => track.stop()); const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput"); elements.microphone.replaceChildren(...inputs.map((device, index) => new Option(device.label || `麦克风 ${index + 1}`, device.deviceId))); }
  catch (error) { elements.microphone.replaceChildren(new Option("麦克风权限未授予", "")); setMessage(`无法读取麦克风：${error.message}`, true); }
}

function waveformFromSamples(samples) { let peak = 0; for (let index = 0; index < samples.length; index += 1) peak = Math.max(peak, Math.abs(samples[index])); return peak; }
function scheduleWaveDraw() { if (state.waveFrame) return; state.waveFrame = requestAnimationFrame(() => { state.waveFrame = 0; drawWave(); }); }
function drawWave() {
  const canvas = elements.waveCanvas; const bounds = canvas.getBoundingClientRect(); const pixelRatio = window.devicePixelRatio || 1; const width = Math.max(1, Math.floor(bounds.width)); const height = Math.max(1, Math.floor(bounds.height));
  if (canvas.width !== width * pixelRatio || canvas.height !== height * pixelRatio) { canvas.width = width * pixelRatio; canvas.height = height * pixelRatio; }
  const context = canvas.getContext("2d"); context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); context.clearRect(0, 0, width, height);
  const values = state.wave.slice(-180); const center = height / 2; const gap = 1; const lineWidth = 1; const stride = Math.max(lineWidth + gap, (width - gap * Math.max(values.length - 1, 0)) / Math.max(values.length, 1));
  const glow = context.createLinearGradient(0, 0, 0, height); glow.addColorStop(0, "rgba(45,124,242,.92)"); glow.addColorStop(.5, "rgba(59,176,217,.82)"); glow.addColorStop(1, "rgba(84,111,229,.92)"); context.strokeStyle = glow; context.lineWidth = lineWidth;
  values.forEach((value, index) => { const gated = Math.max(0, value - .008); const normalized = Math.min(1, Math.pow(gated / .26, .62)); const amplitude = Math.max(1, normalized * (height * .43)); const x = Math.min(width - .5, index * stride + .5); context.beginPath(); context.moveTo(x, center - amplitude); context.lineTo(x, center + amplitude); context.stroke(); });
  context.fillStyle = "rgba(255,255,255,.32)"; context.fillRect(0, center, width, 1);
}

async function startRecording() {
  requireSentences(); if (state.audio) return;
  stopPlayback();
  const settings = state.settings; const constraints = { audio: { deviceId: elements.microphone.value ? { exact: elements.microphone.value } : undefined, channelCount: settings.channels, sampleRate: settings.sampleRate, echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
  state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints); const audio = new AudioContext({ sampleRate: settings.sampleRate }); const source = audio.createMediaStreamSource(state.mediaStream); const processor = audio.createScriptProcessor(4096, settings.channels, settings.channels); const silence = audio.createGain(); silence.gain.value = 0;
  state.audio = audio; state.chunks = Array.from({ length: settings.channels }, () => []); state.wave = [];
  processor.onaudioprocess = (event) => { for (let channel = 0; channel < settings.channels; channel += 1) state.chunks[channel].push(new Float32Array(event.inputBuffer.getChannelData(Math.min(channel, event.inputBuffer.numberOfChannels - 1)))); const peak = waveformFromSamples(event.inputBuffer.getChannelData(0)); const previous = state.wave.at(-1) || 0; state.wave.push(Math.max(peak, previous * .82)); if (state.wave.length > 180) state.wave.shift(); scheduleWaveDraw(); };
  source.connect(processor); processor.connect(silence); silence.connect(audio.destination); state.audioNode = { source, processor, silence };
  elements.recordButton.textContent = "停止录制"; setRecordPhase(settings.leadingSilenceMs ? "leading" : "recording", settings.leadingSilenceMs); await bridge.sync.state({ state: settings.leadingSilenceMs ? "leading" : "recording", sentenceIndex: state.currentIndex });
  if (settings.leadingSilenceMs) state.leadingTimer = setTimeout(() => { if (state.audio) { setRecordPhase("recording"); bridge.sync.state({ state: "recording", sentenceIndex: state.currentIndex }); } }, settings.leadingSilenceMs);
}

function flatten(channelChunks) { const length = channelChunks.reduce((total, chunk) => total + chunk.length, 0); const result = new Float32Array(length); let offset = 0; channelChunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; }); return result; }
function encodeWav(chunks, channels, sampleRate, bitDepth) { const data = chunks.map(flatten); const samples = data[0]?.length || 0; const bytesPerSample = bitDepth / 8; const blockAlign = channels * bytesPerSample; const buffer = new ArrayBuffer(44 + samples * blockAlign); const view = new DataView(buffer); const write = (offset, value) => view.setUint8(offset, value.charCodeAt(0)); ["RIFF", "WAVE", "fmt ", "data"].forEach((text, group) => text.split("").forEach((char, index) => write([0, 8, 12, 36][group] + index, char))); view.setUint32(4, 36 + samples * blockAlign, true); view.setUint32(16, 16, true); view.setUint16(20, bitDepth === 32 ? 3 : 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, bitDepth, true); view.setUint32(40, samples * blockAlign, true); let offset = 44; for (let sample = 0; sample < samples; sample += 1) for (let channel = 0; channel < channels; channel += 1) { const value = Math.max(-1, Math.min(1, data[channel][sample] || 0)); if (bitDepth === 16) { view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true); offset += 2; } else { view.setFloat32(offset, value, true); offset += 4; } } return new Uint8Array(buffer); }
function bytesToBase64(bytes) { let binary = ""; const size = 0x8000; for (let offset = 0; offset < bytes.length; offset += size) binary += String.fromCharCode(...bytes.subarray(offset, offset + size)); return btoa(binary); }

async function stopRecording() {
  if (!state.audio) return; const settings = state.settings; if (state.leadingTimer) clearTimeout(state.leadingTimer); state.leadingTimer = null; setRecordPhase(settings.trailingSilenceMs ? "trailing" : "saving", settings.trailingSilenceMs); await bridge.sync.state({ state: settings.trailingSilenceMs ? "trailing" : "saving", sentenceIndex: state.currentIndex }); if (settings.trailingSilenceMs) await new Promise((resolve) => setTimeout(resolve, settings.trailingSilenceMs)); setRecordPhase("saving");
  const audio = state.audio; const { source, processor, silence } = state.audioNode; source.disconnect(); processor.disconnect(); silence.disconnect(); state.mediaStream.getTracks().forEach((track) => track.stop()); await audio.close(); state.audio = null; state.audioNode = null;
  const sentence = currentSentence(); const bytes = encodeWav(state.chunks, settings.channels, audio.sampleRate, settings.bitDepth); const result = await bridge.saveRecording({ project: currentProject(), speaker: currentSpeaker(), sentenceIndex: sentence.index, base64: bytesToBase64(bytes) }); state.recorded.set(state.currentIndex, result.path); elements.recordButton.textContent = "开始录制"; setRecordPhase("saved"); await bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex });
  const nextIndex = getAutoNext(state.currentIndex, state.sentences.length); if (nextIndex === undefined) setMessage(`已保存：${result.fileName}。全部句子已完成；选择目标句后再次录制即可覆盖旧文件。`); else { state.currentIndex = nextIndex; setMessage(`已保存：${result.fileName}。已自动跳到第 ${nextIndex + 1} 句。`); } render();
}

async function jumpTo(index, sendCommand = false) { if (index < 0 || index >= state.sentences.length) return; stopPlayback(); state.currentIndex = index; if (sendCommand) await bridge.sync.command("jump", index); await bridge.sync.state({ state: state.sync.mode === "idle" ? "idle" : "ready", sentenceIndex: index }); render(); }
async function playCurrent() { const saved = await bridge.getRecording({ project: currentProject(), speaker: currentSpeaker(), sentenceIndex: currentSentence()?.index }); if (!saved?.url) { setMessage("当前句尚未录制。", true); return; } stopPlayback(); const audio = new Audio(saved.url); state.playing = audio; setRecordPhase("playing"); setMessage(`播放：${saved.path}`); audio.onended = () => { if (state.playing === audio) { state.playing = null; setRecordPhase("ready"); } }; audio.onerror = () => { if (state.playing === audio) { state.playing = null; setRecordPhase("error"); setMessage("无法播放当前 WAV 文件。", true); } }; await audio.play(); }
async function requestRecordToggle() { if (state.sync.mode === "client") return; if (state.sync.mode === "host") await bridge.sync.command(state.audio ? "stop" : "start", state.currentIndex); else if (state.audio) await stopRecording(); else await startRecording(); }
async function requestJump(delta) { const target = Math.min(state.sentences.length - 1, Math.max(0, state.currentIndex + delta)); if (target === state.currentIndex || state.sync.mode === "client") return; if (state.sync.mode === "host") await bridge.sync.command(delta < 0 ? "previous" : "next", target); else await jumpTo(target); }
async function enterSyncRecording() { if (state.sync.mode !== "host") return; await bridge.sync.command("open", state.currentIndex); await bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); setMessage("已通知所有在线设备进入同步录制。"); }
function schedule(command, callback) { const rawDelay = Number(command.executeAt || Date.now()) - Date.now(); setTimeout(callback, rawDelay > 0 && rawDelay <= 2_000 ? rawDelay : 0); }
function remoteSentenceIndex(value) { const index = Number(value); return Number.isInteger(index) ? Math.min(state.sentences.length - 1, Math.max(0, index)) : state.currentIndex; }
function applyRemoteSentence(command, message) { state.currentIndex = remoteSentenceIndex(command.sentenceIndex); setMessage(message); bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); render(); }
async function handleCommand(command) { if (command.name === "open") return schedule(command, () => applyRemoteSentence(command, "主控已进入同步录制。")); if (command.name === "start") return schedule(command, () => startRecording().catch((error) => setMessage(error.message, true))); if (command.name === "stop") return schedule(command, () => stopRecording().catch((error) => setMessage(error.message, true))); if (command.name === "cancel") return schedule(command, () => { if (state.audio) stopRecording().catch((error) => setMessage(error.message, true)); else { setRecordPhase("ready"); bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); } }); if (command.name === "previous" || command.name === "next" || command.name === "jump" || command.name === "rerecord") return schedule(command, () => applyRemoteSentence(command, `主控已跳转到第 ${remoteSentenceIndex(command.sentenceIndex) + 1} 句。`)); if (command.name === "play") return schedule(command, () => playCurrent().catch((error) => setMessage(error.message, true))); if (command.name === "complete") return schedule(command, () => { if (state.audio) stopRecording().catch((error) => setMessage(error.message, true)); setRecordPhase("complete"); setMessage("主控已完成同步任务，当前录音已保留。"); }); }

async function hydrateRecordedState() { if (!state.sentences.length) return; const project = currentProject(); const speaker = currentSpeaker(); const saved = await Promise.all(state.sentences.map((sentence, index) => bridge.getRecording({ project, speaker, sentenceIndex: sentence.index }).then((recording) => ({ index, recording })))); state.recorded.clear(); saved.forEach(({ index, recording }) => { if (recording?.path) state.recorded.set(index, recording.path); }); render(); }
async function resetCurrentTask({ resetIdentity }) {
  if (state.audio) throw new Error("请先停止当前录制，再新建或删除任务。");
  stopPlayback();
  if (state.sync.mode !== "idle") state.sync = await bridge.sync.stop();
  state.sentences = []; state.currentIndex = 0; state.scriptName = ""; state.recorded.clear(); state.wave = [];
  if (resetIdentity) { elements.projectName.value = "未命名任务"; elements.speakerName.value = "未命名"; elements.speakerGender.value = "其他"; elements.speakerAge.value = "0"; }
  setRecordPhase("ready"); render();
}
elements.importScriptButton.onclick = async () => { try { const file = await bridge.openScript(); if (!file) return; state.sentences = parseScript(file.content); state.scriptName = file.name; state.currentIndex = 0; state.recorded.clear(); await hydrateRecordedState(); setMessage(`已导入 ${state.sentences.length} 句脚本。`); render(); } catch (error) { setMessage(error.message, true); } };
elements.newTaskButton.onclick = async () => { try { if (!window.confirm("新建任务会关闭当前同步会话并清空当前界面的脚本与录制状态，已保存 WAV 文件不会删除。是否继续？")) return; await resetCurrentTask({ resetIdentity: true }); setMessage("已新建空任务，请填写任务与发音人信息后导入 TXT 脚本。"); } catch (error) { setMessage(error.message, true); } };
elements.deleteTaskButton.onclick = async () => { try { const project = currentProject(); if (!window.confirm(`确定删除桌面任务“${project.name}”吗？该任务已管理的 WAV 文件会一并删除，此操作不可恢复。`)) return; const result = await bridge.deleteTask({ project }); await resetCurrentTask({ resetIdentity: true }); setMessage(`已删除任务及 ${result.deletedCount} 条桌面 WAV 记录。`); } catch (error) { setMessage(error.message, true); } };
elements.settingsActionButton.onclick = async () => { try { if (!state.editingSettings) { setSettingsEditMode(true); setMessage("现在可以修改电脑录音配置。修改后请保存。"); return; } state.settings = await bridge.saveSettings({ sampleRate: Number(elements.sampleRate.value), channels: Number(elements.channels.value), bitDepth: Number(elements.bitDepth.value), leadingSilenceMs: Number(elements.leadingSilenceMs.value), trailingSilenceMs: Number(elements.trailingSilenceMs.value), recordingRoot: elements.recordingRoot.value }); setSettingsEditMode(false); setMessage("电脑录音配置已保存。新录制将使用此配置。"); } catch (error) { setMessage(error.message, true); } };
elements.choosePathButton.onclick = async () => { const directory = await bridge.chooseDirectory(); if (directory) elements.recordingRoot.value = directory; };
elements.recordButton.onclick = () => requestRecordToggle().catch((error) => setMessage(error.message, true)); elements.previousButton.onclick = () => requestJump(-1).catch((error) => setMessage(error.message, true)); elements.nextButton.onclick = () => requestJump(1).catch((error) => setMessage(error.message, true)); elements.playButton.onclick = () => { if (state.sync.mode === "host") bridge.sync.command("play", state.currentIndex); else playCurrent().catch((error) => setMessage(error.message, true)); }; elements.completeButton.onclick = () => { if (state.sync.mode === "host") bridge.sync.command("complete", state.currentIndex); else setMessage("单机录音任务已完成。"); };
elements.hostButton.onclick = async () => { try { requireSentences(); state.sync = await bridge.sync.host({ projectId: projectKey(), sentenceCount: state.sentences.length, deviceName: elements.deviceName.value }); elements.roomCode.value = state.sync.roomCode; render(); } catch (error) { setMessage(error.message, true); } }; elements.joinButton.onclick = async () => { try { requireSentences(); state.sync = await bridge.sync.join({ host: elements.hostIp.value.trim(), port: Number(elements.hostPort.value), roomCode: elements.roomCode.value, projectId: projectKey(), sentenceCount: state.sentences.length, deviceName: elements.deviceName.value }); render(); } catch (error) { setMessage(error.message, true); } }; elements.closeSyncButton.onclick = async () => { state.sync = await bridge.sync.stop(); render(); }; elements.openSyncButton.onclick = enterSyncRecording;
document.querySelectorAll(".fold-card").forEach((card) => card.querySelector(".fold-trigger").onclick = () => setFold(card, !card.classList.contains("folded")));
elements.projectName.onchange = () => hydrateRecordedState().catch((error) => setMessage(error.message, true)); elements.speakerName.onchange = () => hydrateRecordedState().catch((error) => setMessage(error.message, true));
bridge.sync.onEvent((event) => { state.sync = event.session || state.sync; if (event.type === "command" && event.payload) handleCommand(event.payload); render(); });
window.addEventListener("resize", scheduleWaveDraw);
(async () => { state.settings = await bridge.getSettings(); for (const key of ["sampleRate", "channels", "bitDepth", "leadingSilenceMs", "trailingSilenceMs", "recordingRoot"]) elements[key].value = state.settings[key]; elements.deviceName.value = await bridge.getDeviceName(); state.sync = await bridge.sync.status(); await listMicrophones(); setSettingsEditMode(false); render(); })().catch((error) => setMessage(error.message, true));
