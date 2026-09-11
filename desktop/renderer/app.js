const bridge = window.desktopBridge;
const elements = Object.fromEntries([
  "projectName", "speakerName", "speakerGender", "speakerAge", "scriptSummary", "sentenceList", "promptText", "readingText", "progressText", "recordState", "recordMessage", "deviceDots", "deviceName", "hostIp", "hostPort", "roomCode", "hostInfo", "deviceList", "sampleRate", "channels", "bitDepth", "leadingSilenceMs", "trailingSilenceMs", "microphone", "recordingRoot", "waveCanvas", "recordButton", "previousButton", "nextButton", "playButton", "rerecordButton", "cancelButton", "completeButton", "openSyncButton",
].map((id) => [id, document.getElementById(id)]));

const state = { sentences: [], currentIndex: 0, settings: null, sync: { mode: "idle", devices: [] }, audio: null, mediaStream: null, chunks: [], playing: null, recorded: new Map(), wave: [] };

function cleanText(value) { return String(value ?? "").trim(); }
function sentenceText(sentence) { return sentence.tokens?.map((token) => token.char).join("") || sentence.rawText || ""; }
function currentSentence() { return state.sentences[state.currentIndex]; }
function currentProject() { return { name: cleanText(elements.projectName.value) || "未命名任务" }; }
function currentSpeaker() { return { name: cleanText(elements.speakerName.value) || "未命名", gender: elements.speakerGender.value, age: Number(elements.speakerAge.value || 0) }; }
function projectKey() { return `desktop|${state.sentences.length}|${state.sentences.map(sentenceText).join("\u241E").length}`; }
function setMessage(message, error = false) { elements.recordMessage.textContent = message; elements.recordMessage.style.color = error ? "#bf3848" : ""; }
function requireSentences() { if (!state.sentences.length) throw new Error("请先导入 TXT 脚本。"); }

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

function render() {
  const sentence = currentSentence();
  elements.scriptSummary.textContent = state.sentences.length ? `已导入 ${state.sentences.length} 句 · ${state.scriptName || "未命名脚本"}` : "尚未导入脚本";
  elements.progressText.textContent = sentence ? `第 ${state.currentIndex + 1} / ${state.sentences.length} 句` : "尚未导入脚本";
  elements.promptText.textContent = sentence?.prompt || "导入脚本后显示提示词";
  elements.readingText.textContent = sentenceText(sentence) || "请先导入 TXT 脚本";
  elements.sentenceList.replaceChildren(...state.sentences.map((item, index) => {
    const button = document.createElement("button"); button.className = `sentence ${index === state.currentIndex ? "active" : ""}`;
    button.innerHTML = `<strong>${String(item.index).padStart(3, "0")} · ${sentenceText(item)}</strong><small>${item.prompt || "无提示词"}</small>`;
    button.onclick = () => jumpTo(index, state.sync.mode === "host");
    return button;
  }));
  renderSync();
  drawWave();
}

function renderSync() {
  const devices = state.sync.devices || [];
  elements.syncSummary.textContent = state.sync.mode === "idle" ? "未连接同步房间" : `${state.sync.mode === "host" ? "主控房间" : "已连接主控"} · ${devices.length} 台设备`;
  elements.hostInfo.textContent = state.sync.mode === "host" ? `主控地址：${state.sync.address}　端口：35679　口令：${state.sync.roomCode}` : state.sync.mode === "client" ? `已连接主控：${state.sync.address}　口令：${state.sync.roomCode}` : "创建房间后显示本机 IP、端口与口令。";
  elements.openSyncButton.disabled = state.sync.mode !== "host" || !devices.some((device) => device.role === "client" && device.detail !== "offline");
  const clientLocked = state.sync.mode === "client";
  [elements.recordButton, elements.previousButton, elements.nextButton, elements.playButton, elements.rerecordButton, elements.cancelButton, elements.completeButton].forEach((button) => { button.disabled = clientLocked; });
  elements.deviceDots.replaceChildren(...devices.map((device) => {
    const dot = document.createElement("button"); dot.className = `device-dot ${device.detail === "offline" ? "offline" : device.state === "ready" || device.state === "leading" || device.state === "recording" || device.state === "trailing" || device.state === "saving" ? "online" : "waiting"}`;
    dot.textContent = (device.name || "?").slice(0, 1); dot.title = `${device.name} · ${device.detail === "offline" ? "离线" : device.state}`; return dot;
  }));
  elements.deviceList.replaceChildren(...devices.map((device) => { const row = document.createElement("div"); row.className = "device-row"; row.innerHTML = `<strong>${device.name}</strong><span>${device.detail === "offline" ? "离线" : device.state}</span>`; return row; }));
}

async function listMicrophones() {
  try {
    const temporary = await navigator.mediaDevices.getUserMedia({ audio: true }); temporary.getTracks().forEach((track) => track.stop());
    const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
    elements.microphone.replaceChildren(...inputs.map((device, index) => new Option(device.label || `麦克风 ${index + 1}`, device.deviceId)));
  } catch (error) { elements.microphone.replaceChildren(new Option("麦克风权限未授予", "")); setMessage(`无法读取麦克风：${error.message}`, true); }
}

function waveformFromSamples(samples) { return Math.max(...samples.map((sample) => Math.abs(sample)), 0); }
function drawWave() { const canvas = elements.waveCanvas; const context = canvas.getContext("2d"); const { width, height } = canvas; context.clearRect(0, 0, width, height); context.fillStyle = "rgba(62,116,184,.08)"; context.fillRect(0, 0, width, height); context.strokeStyle = "rgba(49,112,194,.78)"; context.lineWidth = 1.5; context.beginPath(); const values = state.wave.slice(-160); values.forEach((value, index) => { const x = (index / Math.max(values.length - 1, 1)) * width; const amplitude = Math.max(2, value * (height * .46)); context.moveTo(x, height / 2 - amplitude); context.lineTo(x, height / 2 + amplitude); }); context.stroke(); }

async function startRecording() {
  requireSentences();
  if (state.audio) return;
  const settings = state.settings;
  const constraints = { audio: { deviceId: elements.microphone.value ? { exact: elements.microphone.value } : undefined, channelCount: settings.channels, sampleRate: settings.sampleRate, echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
  state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  state.audio = new AudioContext({ sampleRate: settings.sampleRate });
  const source = state.audio.createMediaStreamSource(state.mediaStream);
  const processor = state.audio.createScriptProcessor(4096, settings.channels, settings.channels);
  state.chunks = Array.from({ length: settings.channels }, () => []); state.wave = [];
  processor.onaudioprocess = (event) => {
    for (let channel = 0; channel < settings.channels; channel += 1) state.chunks[channel].push(new Float32Array(event.inputBuffer.getChannelData(Math.min(channel, event.inputBuffer.numberOfChannels - 1))));
    state.wave.push(waveformFromSamples(event.inputBuffer.getChannelData(0))); if (state.wave.length > 180) state.wave.shift(); drawWave();
  };
  source.connect(processor); processor.connect(state.audio.destination);
  state.audioNode = { source, processor };
  elements.recordButton.textContent = "停止录制"; elements.recordState.textContent = settings.leadingSilenceMs ? "首端静音" : "正在录制";
  await bridge.sync.state({ state: settings.leadingSilenceMs ? "leading" : "recording", sentenceIndex: state.currentIndex });
  if (settings.leadingSilenceMs) setTimeout(() => { if (state.audio) { elements.recordState.textContent = "正在录制"; bridge.sync.state({ state: "recording", sentenceIndex: state.currentIndex }); } }, settings.leadingSilenceMs);
}

function flatten(channelChunks) { const length = channelChunks.reduce((total, chunk) => total + chunk.length, 0); const result = new Float32Array(length); let offset = 0; channelChunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; }); return result; }
function encodeWav(chunks, channels, sampleRate, bitDepth) {
  const data = chunks.map(flatten); const samples = data[0]?.length || 0; const bytesPerSample = bitDepth / 8; const blockAlign = channels * bytesPerSample; const buffer = new ArrayBuffer(44 + samples * blockAlign); const view = new DataView(buffer); const write = (offset, value) => view.setUint8(offset, value.charCodeAt(0)); ["RIFF", "WAVE", "fmt ", "data"].forEach((text, group) => text.split("").forEach((char, index) => write([0, 8, 12, 36][group] + index, char))); view.setUint32(4, 36 + samples * blockAlign, true); view.setUint32(16, 16, true); view.setUint16(20, bitDepth === 32 ? 3 : 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, bitDepth, true); view.setUint32(40, samples * blockAlign, true); let offset = 44; for (let sample = 0; sample < samples; sample += 1) for (let channel = 0; channel < channels; channel += 1) { const value = Math.max(-1, Math.min(1, data[channel][sample] || 0)); if (bitDepth === 16) { view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true); offset += 2; } else { view.setFloat32(offset, value, true); offset += 4; } } return new Uint8Array(buffer);
}
function bytesToBase64(bytes) { let binary = ""; const size = 0x8000; for (let offset = 0; offset < bytes.length; offset += size) binary += String.fromCharCode(...bytes.subarray(offset, offset + size)); return btoa(binary); }

async function stopRecording() {
  if (!state.audio) return;
  const settings = state.settings; elements.recordState.textContent = settings.trailingSilenceMs ? "尾端静音" : "正在保存"; await bridge.sync.state({ state: settings.trailingSilenceMs ? "trailing" : "saving", sentenceIndex: state.currentIndex });
  if (settings.trailingSilenceMs) await new Promise((resolve) => setTimeout(resolve, settings.trailingSilenceMs));
  const audio = state.audio; state.audioNode.source.disconnect(); state.audioNode.processor.disconnect(); state.mediaStream.getTracks().forEach((track) => track.stop()); await audio.close(); state.audio = null;
  const sentence = currentSentence(); const bytes = encodeWav(state.chunks, settings.channels, audio.sampleRate, settings.bitDepth); const result = await bridge.saveRecording({ project: currentProject(), speaker: currentSpeaker(), sentenceIndex: sentence.index, base64: bytesToBase64(bytes) });
  state.recorded.set(state.currentIndex, result.path); elements.recordButton.textContent = "开始录制"; elements.recordState.textContent = "已保存"; setMessage(`已保存：${result.fileName}`); await bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); render();
}

async function jumpTo(index, sendCommand = false) { if (index < 0 || index >= state.sentences.length) return; state.currentIndex = index; if (sendCommand) await bridge.sync.command("jump", index); await bridge.sync.state({ state: state.sync.mode === "idle" ? "idle" : "ready", sentenceIndex: index }); render(); }
async function playCurrent() { const file = state.recorded.get(state.currentIndex); if (!file) { setMessage("当前句尚未录制。", true); return; } setMessage(`已保存文件：${file}`); }

async function requestRecordToggle() {
  if (state.sync.mode === "client") return;
  if (state.sync.mode === "host") { await bridge.sync.command(state.audio ? "stop" : "start", state.currentIndex); return; }
  if (state.audio) await stopRecording(); else await startRecording();
}

async function requestJump(delta) {
  const target = Math.min(state.sentences.length - 1, Math.max(0, state.currentIndex + delta));
  if (target === state.currentIndex || state.sync.mode === "client") return;
  if (state.sync.mode === "host") await bridge.sync.command(delta < 0 ? "previous" : "next", target);
  else await jumpTo(target);
}

async function enterSyncRecording() { if (state.sync.mode !== "host") return; await bridge.sync.command("open", state.currentIndex); await bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); setMessage("已通知所有在线设备进入同步录制。"); }
function schedule(command, callback) { const delay = Math.max(0, Number(command.executeAt || Date.now()) - Date.now()); setTimeout(callback, delay); }

async function handleCommand(command) {
  if (command.name === "open") return schedule(command, () => { state.currentIndex = command.sentenceIndex; render(); bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); });
  if (command.name === "start") return schedule(command, () => startRecording().catch((error) => setMessage(error.message, true)));
  if (command.name === "stop") return schedule(command, () => stopRecording().catch((error) => setMessage(error.message, true)));
  if (command.name === "cancel") return schedule(command, () => { if (state.audio) stopRecording().catch((error) => setMessage(error.message, true)); else { elements.recordState.textContent = "已取消准备"; bridge.sync.state({ state: "ready", sentenceIndex: state.currentIndex }); } });
  if (command.name === "previous") return schedule(command, () => jumpTo(Math.max(0, state.currentIndex - 1)));
  if (command.name === "next") return schedule(command, () => jumpTo(Math.min(state.sentences.length - 1, state.currentIndex + 1)));
  if (command.name === "jump" || command.name === "rerecord") return schedule(command, () => jumpTo(command.sentenceIndex));
  if (command.name === "play") return schedule(command, playCurrent);
  if (command.name === "complete") return schedule(command, () => { if (state.audio) stopRecording().catch((error) => setMessage(error.message, true)); elements.recordState.textContent = "任务已完成"; setMessage("主控已完成同步任务，当前录音已保留。"); });
}

document.getElementById("importScriptButton").onclick = async () => { try { const file = await bridge.openScript(); if (!file) return; state.sentences = parseScript(file.content); state.scriptName = file.name; state.currentIndex = 0; setMessage(`已导入 ${state.sentences.length} 句脚本。`); render(); } catch (error) { setMessage(error.message, true); } };
document.getElementById("saveSettingsButton").onclick = async () => { try { state.settings = await bridge.saveSettings({ sampleRate: Number(elements.sampleRate.value), channels: Number(elements.channels.value), bitDepth: Number(elements.bitDepth.value), leadingSilenceMs: Number(elements.leadingSilenceMs.value), trailingSilenceMs: Number(elements.trailingSilenceMs.value), recordingRoot: elements.recordingRoot.value }); setMessage("电脑录音配置已保存。"); } catch (error) { setMessage(error.message, true); } };
document.getElementById("choosePathButton").onclick = async () => { const directory = await bridge.chooseDirectory(); if (directory) elements.recordingRoot.value = directory; };
elements.recordButton.onclick = () => requestRecordToggle().catch((error) => setMessage(error.message, true));
elements.previousButton.onclick = () => requestJump(-1).catch((error) => setMessage(error.message, true)); elements.nextButton.onclick = () => requestJump(1).catch((error) => setMessage(error.message, true));
elements.playButton.onclick = () => { if (state.sync.mode === "host") bridge.sync.command("play", state.currentIndex); else playCurrent(); };
elements.rerecordButton.onclick = () => { if (state.sync.mode === "host") bridge.sync.command("rerecord", state.currentIndex); else if (state.sync.mode === "idle") setMessage("已选择当前句重录；重新开始录制会替换该句旧 WAV。") };
elements.cancelButton.onclick = () => { if (state.sync.mode === "host") bridge.sync.command("cancel", state.currentIndex); else if (state.audio) stopRecording(); };
elements.completeButton.onclick = () => { if (state.sync.mode === "host") bridge.sync.command("complete", state.currentIndex); else setMessage("单机录音任务已完成。") };
document.getElementById("hostButton").onclick = async () => { try { requireSentences(); state.sync = await bridge.sync.host({ projectId: projectKey(), sentenceCount: state.sentences.length, deviceName: elements.deviceName.value }); elements.roomCode.value = state.sync.roomCode; render(); } catch (error) { setMessage(error.message, true); } };
document.getElementById("joinButton").onclick = async () => { try { requireSentences(); state.sync = await bridge.sync.join({ host: elements.hostIp.value.trim(), port: Number(elements.hostPort.value), roomCode: elements.roomCode.value, projectId: projectKey(), sentenceCount: state.sentences.length, deviceName: elements.deviceName.value }); render(); } catch (error) { setMessage(error.message, true); } };
document.getElementById("closeSyncButton").onclick = async () => { state.sync = await bridge.sync.stop(); render(); };
elements.openSyncButton.onclick = enterSyncRecording;

bridge.sync.onEvent((event) => { state.sync = event.session || state.sync; if (event.type === "command" && event.payload) handleCommand(event.payload); render(); });
(async () => { state.settings = await bridge.getSettings(); Object.assign(elements, elements); for (const key of ["sampleRate", "channels", "bitDepth", "leadingSilenceMs", "trailingSilenceMs", "recordingRoot"]) elements[key].value = state.settings[key]; elements.deviceName.value = await bridge.getDeviceName(); state.sync = await bridge.sync.status(); await listMicrophones(); render(); })().catch((error) => setMessage(error.message, true));
