import * as FileSystem from "expo-file-system/legacy";
import * as Network from "expo-network";
import { Platform } from "react-native";
import type TcpSocket from "react-native-tcp-socket/lib/types/Socket";

import { persistTransferredScript } from "@/lib/recorder-files";
import type { ScriptProject, Speaker } from "@/shared/recorder-types";

const PORT = 35678;
const MAX_SCRIPT_SIZE = 3 * 1024 * 1024;
const MAX_HTTP_REQUEST_SIZE = MAX_SCRIPT_SIZE + 48 * 1024;

type ServerState = "stopped" | "starting" | "running" | "error";
type TcpServer = {
  once: (event: "listening" | "error", listener: (() => void) | ((error: Error) => void)) => TcpServer;
  on: (event: "error", listener: (error: Error) => void) => TcpServer;
  listen: (options: { port: number; host?: string; reuseAddress?: boolean }) => TcpServer;
  close: () => TcpServer;
};
type TcpFactory = { createServer: (listener: (socket: TcpSocket) => void) => TcpServer };
type HttpRequest = { method: string; path: string; query: URLSearchParams; body: string };
type HttpResponse = { status: number; contentType: string; body: string; headers?: Record<string, string> };

export type TransferredScript = { id: string; name: string; uri: string; receivedAt: string };
export type LanTransferStatus = { running: boolean; starting: boolean; address?: string; token?: string; port: number; error?: string; scripts: TransferredScript[] };

type RecordingDownload = { id: string; name: string; uri: string; size: number; recordedAt?: string };
type ActiveSession = { address: string; token: string; scripts: TransferredScript[]; projects: ScriptProject[]; speakers: Speaker[] };

let activeSession: ActiveSession | null = null;
let nativeTcp: TcpFactory | null = null;
let tcpServer: TcpServer | null = null;
let serverState: ServerState = "stopped";
let serverError: string | undefined;

function getTcpSocket() {
  if (Platform.OS === "web") throw new Error("文件快传需要使用重新构建后的 Android 应用。");
  if (!nativeTcp) {
    const module = require("react-native-tcp-socket") as TcpFactory & { default?: TcpFactory };
    nativeTcp = module.default ?? module;
  }
  return nativeTcp;
}

function makeToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "recording.wav";
}

function isAuthorized(request: HttpRequest) {
  return Boolean(activeSession && request.query.get("token") === activeSession.token);
}

function json(body: unknown, status = 200): HttpResponse {
  return { status, contentType: "application/json; charset=utf-8", headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

function httpStatusText(status: number) {
  return status === 200 ? "OK" : status === 400 ? "Bad Request" : status === 401 ? "Unauthorized" : status === 404 ? "Not Found" : status === 413 ? "Payload Too Large" : "Internal Server Error";
}

function encodeResponse(response: HttpResponse) {
  const bodyLength = new TextEncoder().encode(response.body).length;
  const headers = { "Content-Type": response.contentType, "Content-Length": String(bodyLength), "Connection": "close", "Cache-Control": "no-store", ...response.headers };
  return `HTTP/1.1 ${response.status} ${httpStatusText(response.status)}\r\n${Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join("\r\n")}\r\n\r\n${response.body}`;
}

function parseHttpRequest(raw: string): HttpRequest | null {
  const divider = raw.indexOf("\r\n\r\n");
  if (divider < 0) return null;
  const head = raw.slice(0, divider).split("\r\n");
  const [method = "", target = ""] = head.shift()?.split(" ") ?? [];
  if (!method || !target) return null;
  const headers = new Map(head.map((line) => {
    const splitAt = line.indexOf(":");
    return [splitAt > -1 ? line.slice(0, splitAt).trim().toLowerCase() : "", splitAt > -1 ? line.slice(splitAt + 1).trim() : ""];
  }));
  const body = raw.slice(divider + 4);
  const contentLength = Number(headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 0 && new TextEncoder().encode(body).length < contentLength) return null;
  const queryAt = target.indexOf("?");
  return { method: method.toUpperCase(), path: queryAt < 0 ? target : target.slice(0, queryAt), query: new URLSearchParams(queryAt < 0 ? "" : target.slice(queryAt + 1)), body };
}

async function recordingDownloads() {
  if (!activeSession) return [] as RecordingDownload[];
  const speakerMap = new Map(activeSession.speakers.map((speaker) => [speaker.id, speaker]));
  const downloads: RecordingDownload[] = [];
  for (const project of activeSession.projects) {
    const speaker = speakerMap.get(project.speakerId);
    for (const sentence of project.sentences) {
      if (!sentence.recordingUri) continue;
      const info = await FileSystem.getInfoAsync(sentence.recordingUri);
      if (!info.exists) continue;
      const name = safeFileName(`${project.name}_${speaker?.name ?? "speaker"}_${String(sentence.index).padStart(3, "0")}.wav`);
      downloads.push({ id: `${project.id}:${sentence.id}`, name, uri: sentence.recordingUri, size: info.size ?? 0, recordedAt: sentence.recordedAt });
    }
  }
  return downloads.sort((left, right) => (right.recordedAt ?? "").localeCompare(left.recordedAt ?? ""));
}

function htmlPage() {
  return `<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>采音脚本 · 文件快传</title><style>body{margin:0;background:#f5f7fc;color:#182033;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:760px;margin:auto;padding:28px 18px}h1{font-size:26px;margin:0}.sub{color:#65708a;line-height:1.6}.card{background:#fff;border:1px solid #e4e8f0;border-radius:16px;padding:18px;margin-top:16px}.drop{border:2px dashed #9eb4e8;border-radius:13px;padding:22px;text-align:center;background:#f7f9ff}.btn{border:0;background:#2f4da0;color:#fff;border-radius:10px;font-weight:700;padding:10px 14px;cursor:pointer}.muted{color:#65708a}.row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #eef1f6}.row:first-child{border-top:0}.name{font-weight:700;flex:1;word-break:break-all}.tag{display:inline-block;background:#e8f7ef;color:#1e8b61;border-radius:999px;padding:3px 8px;font-size:12px}#message{min-height:20px;margin-top:10px;color:#2f4da0}input[type=file]{display:none}@media(max-width:540px){.wrap{padding:18px 12px}}</style><body><main class="wrap"><h1>采音脚本 · 文件快传</h1><p class="sub">此页面仅在同一局域网内有效。上传 TXT 脚本后，可在手机中选择创建任务；已完成的 WAV 录音可直接下载。</p><section class="card"><div class="drop"><strong>上传 TXT 脚本</strong><p class="muted">每一行是一条 JSON 字元数组，文件大小不超过 3 MB。</p><label class="btn" for="file">选择 TXT 文件</label><input id="file" type="file" accept=".txt,text/plain"><div id="message"></div></div></section><section class="card"><h2>已上传脚本</h2><div id="scripts" class="muted">正在读取…</div></section><section class="card"><h2>已完成录音 <span class="tag">WAV</span></h2><div id="recordings" class="muted">正在读取…</div></section></main><script>const token=new URLSearchParams(location.search).get('token');const msg=document.getElementById('message');const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const api=path=>path+'?token='+encodeURIComponent(token||'');async function refresh(){const r=await fetch(api('/api/status'));const d=await r.json();if(!r.ok)throw Error(d.error||'访问口令无效');document.getElementById('scripts').innerHTML=d.scripts.length?d.scripts.map(x=>'<div class="row"><span class="name">'+esc(x.name)+'</span><span class="muted">已接收</span></div>').join(''):'暂未上传脚本。';document.getElementById('recordings').innerHTML=d.recordings.length?d.recordings.map(x=>'<div class="row"><span class="name">'+esc(x.name)+'</span><button class="btn" onclick="downloadFile(\''+x.id+'\',\''+esc(x.name).replace(/'/g,'&#39;')+'\')">下载</button></div>').join(''):'暂无已完成录音。'}async function downloadFile(id,name){msg.textContent='正在准备下载…';const r=await fetch(api('/api/download')+'&id='+encodeURIComponent(id));const d=await r.json();if(!r.ok)throw Error(d.error||'下载失败');const raw=atob(d.base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));link.download=name;link.click();URL.revokeObjectURL(link.href);msg.textContent='下载已开始。'}document.getElementById('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!/\.txt$/i.test(file.name)){msg.textContent='仅支持 TXT 文件。';return}if(file.size>3145728){msg.textContent='文件超过 3 MB 限制。';return}msg.textContent='正在上传…';try{const content=await file.text(),r=await fetch(api('/api/upload'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,content})}),d=await r.json();if(!r.ok)throw Error(d.error||'上传失败');msg.textContent='上传成功：'+file.name;await refresh()}catch(err){msg.textContent=err.message||'上传失败'}e.target.value=''};refresh().catch(err=>msg.textContent=err.message||'无法连接手机');</script></body></html>`;
}

async function routeRequest(request: HttpRequest): Promise<HttpResponse> {
  if (!isAuthorized(request)) return { status: 401, contentType: "text/plain; charset=utf-8", body: "请输入手机显示的文件快传地址和访问口令。" };
  if (request.method === "GET" && request.path === "/") return { status: 200, contentType: "text/html; charset=utf-8", body: htmlPage() };
  if (request.method === "GET" && request.path === "/api/status") {
    const recordings = await recordingDownloads();
    return json({ scripts: activeSession?.scripts ?? [], recordings: recordings.map(({ id, name, size }) => ({ id, name, size })) });
  }
  if (request.method === "POST" && request.path === "/api/upload") {
    try {
      const payload = JSON.parse(request.body || "{}") as { name?: string; content?: string };
      const name = typeof payload.name === "string" ? payload.name : "";
      const content = typeof payload.content === "string" ? payload.content : "";
      if (!name.toLowerCase().endsWith(".txt")) throw new Error("仅支持 TXT 脚本文件。");
      if (!content || new TextEncoder().encode(content).length > MAX_SCRIPT_SIZE) throw new Error("脚本为空或超过 3 MB 限制。");
      const uri = await persistTransferredScript(name, content);
      const script = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: safeFileName(name), uri, receivedAt: new Date().toISOString() };
      activeSession?.scripts.unshift(script);
      return json({ script });
    } catch (error) { return json({ error: error instanceof Error ? error.message : "无法接收脚本。" }, 400); }
  }
  if (request.method === "GET" && request.path === "/api/download") {
    try {
      const file = (await recordingDownloads()).find((item) => item.id === request.query.get("id"));
      if (!file) throw new Error("录音不存在或尚未完成。");
      if (file.size > 45 * 1024 * 1024) throw new Error("单个录音超过 45 MB，请使用应用内分享功能。");
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      return json({ name: file.name, base64 });
    } catch (error) { return json({ error: error instanceof Error ? error.message : "无法读取录音。" }, 400); }
  }
  return { status: 404, contentType: "text/plain; charset=utf-8", body: "未找到请求的资源。" };
}

function handleConnection(socket: TcpSocket) {
  let rawRequest = "";
  let answered = false;
  socket.setEncoding("utf8");
  socket.setTimeout(10000, () => socket.destroy());
  socket.on("data", (chunk) => {
    if (answered) return;
    rawRequest += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    if (new TextEncoder().encode(rawRequest).length > MAX_HTTP_REQUEST_SIZE) {
      answered = true;
      socket.end(encodeResponse({ status: 413, contentType: "text/plain; charset=utf-8", body: "请求过大。" }));
      return;
    }
    const request = parseHttpRequest(rawRequest);
    if (!request) return;
    answered = true;
    void routeRequest(request).then((response) => socket.end(encodeResponse(response))).catch(() => socket.end(encodeResponse({ status: 500, contentType: "text/plain; charset=utf-8", body: "服务器处理请求失败。" })));
  });
  socket.on("error", () => { /* individual connection errors do not stop the transfer service */ });
}

async function listenOnLan(host: string) {
  const tcp = getTcpSocket();
  const server = tcp.createServer(handleConnection);
  tcpServer = server;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve();
    };
    const timeout = setTimeout(() => finish(new Error(`端口 ${PORT} 未在 4 秒内开始监听。`)), 4000);
    server.once("listening", () => { clearTimeout(timeout); finish(); });
    server.once("error", (error: Error) => { clearTimeout(timeout); finish(error); });
    server.on("error", (error: Error) => { serverState = "error"; serverError = error.message; });
    server.listen({ port: PORT, host, reuseAddress: true });
  });
}

async function verifyListening(session: ActiveSession) {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`端口 ${PORT} 未响应。`)), 3000));
  const response = await Promise.race([fetch(`${session.address}/?token=${encodeURIComponent(session.token)}`), timeout]);
  if (!response.ok) throw new Error(`端口 ${PORT} 返回 ${response.status}，请停止后重试。`);
}

export async function startLanFileTransfer(projects: ScriptProject[], speakers: Speaker[]): Promise<LanTransferStatus> {
  if (Platform.OS === "web") throw new Error("文件快传需要使用重新构建后的 Android 应用。");
  if (activeSession && serverState === "running") {
    activeSession.projects = projects;
    activeSession.speakers = speakers;
    return getLanFileTransferStatus();
  }
  if (serverState === "starting") return getLanFileTransferStatus();
  const ip = await Network.getIpAddressAsync();
  if (!ip || ip === "0.0.0.0") throw new Error("未能读取手机局域网地址。请连接 Wi-Fi 后重试。");
  activeSession = { address: `http://${ip}:${PORT}`, token: makeToken(), scripts: [], projects, speakers };
  serverState = "starting";
  serverError = undefined;
  try {
    await listenOnLan(ip);
    await verifyListening(activeSession);
    serverState = "running";
    return getLanFileTransferStatus();
  } catch (error) {
    serverState = "error";
    serverError = error instanceof Error ? error.message : `端口 ${PORT} 启动失败。`;
    try { tcpServer?.close(); } catch { /* the server may already be closed */ }
    tcpServer = null;
    throw error;
  }
}

export function updateLanFileTransferData(projects: ScriptProject[], speakers: Speaker[]) {
  if (activeSession) { activeSession.projects = projects; activeSession.speakers = speakers; }
}

export function getLanFileTransferStatus(): LanTransferStatus {
  return activeSession ? { running: serverState === "running", starting: serverState === "starting", address: activeSession.address, token: activeSession.token, port: PORT, error: serverError, scripts: activeSession.scripts } : { running: false, starting: false, port: PORT, error: serverError, scripts: [] };
}

export function stopLanFileTransfer() {
  activeSession = null;
  serverState = "stopped";
  serverError = undefined;
  if (tcpServer) {
    try { tcpServer.close(); } catch { /* stopping a closed server is safe to ignore */ }
  }
  tcpServer = null;
}
