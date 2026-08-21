import * as FileSystem from "expo-file-system/legacy";
import * as Network from "expo-network";
import type { RequestEvent, Response } from "expo-http-server";
import { Platform } from "react-native";

import { persistTransferredScript } from "@/lib/recorder-files";
import type { ScriptProject, Speaker } from "@/shared/recorder-types";

const PORT = 35678;
const MAX_SCRIPT_SIZE = 3 * 1024 * 1024;
type HttpServerModule = typeof import("expo-http-server");
type ServerState = "stopped" | "starting" | "running" | "error";

export type TransferredScript = { id: string; name: string; uri: string; receivedAt: string };
export type LanTransferStatus = { running: boolean; starting: boolean; address?: string; token?: string; port: number; error?: string; scripts: TransferredScript[] };

type RecordingDownload = { id: string; name: string; uri: string; size: number; recordedAt?: string };
type ActiveSession = { address: string; token: string; scripts: TransferredScript[]; projects: ScriptProject[]; speakers: Speaker[] };

let activeSession: ActiveSession | null = null;
let routesRegistered = false;
let nativeHttpServer: HttpServerModule | null = null;
let serverState: ServerState = "stopped";
let serverError: string | undefined;

function getHttpServer() {
  if (Platform.OS === "web") throw new Error("文件快传需要使用重新构建后的 Android 应用。");
  if (!nativeHttpServer) nativeHttpServer = require("expo-http-server") as HttpServerModule;
  return nativeHttpServer;
}

function makeToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function readParams(request: RequestEvent) {
  try { return JSON.parse(request.paramsJson || "{}") as Record<string, string>; }
  catch { return {}; }
}

function isAuthorized(request: RequestEvent) {
  const token = readParams(request).token;
  return Boolean(activeSession && token && token === activeSession.token);
}

function json(body: unknown, statusCode = 200): Response {
  return { statusCode, contentType: "application/json; charset=utf-8", headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "recording.wav";
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

async function verifyListening(session: ActiveSession) {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`端口 ${PORT} 未响应。`)), 3000));
  const response = await Promise.race([fetch(`${session.address}/?token=${encodeURIComponent(session.token)}`), timeout]);
  if (!response.ok) throw new Error(`端口 ${PORT} 返回 ${response.status}，请停止后重试。`);
}

function htmlPage() {
  return `<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>采音脚本 · 文件快传</title><style>body{margin:0;background:#f5f7fc;color:#182033;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:760px;margin:auto;padding:28px 18px}h1{font-size:26px;margin:0}.sub{color:#65708a;line-height:1.6}.card{background:#fff;border:1px solid #e4e8f0;border-radius:16px;padding:18px;margin-top:16px}.drop{border:2px dashed #9eb4e8;border-radius:13px;padding:22px;text-align:center;background:#f7f9ff}.btn{border:0;background:#2f4da0;color:#fff;border-radius:10px;font-weight:700;padding:10px 14px;cursor:pointer}.muted{color:#65708a}.row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #eef1f6}.row:first-child{border-top:0}.name{font-weight:700;flex:1;word-break:break-all}.tag{display:inline-block;background:#e8f7ef;color:#1e8b61;border-radius:999px;padding:3px 8px;font-size:12px}#message{min-height:20px;margin-top:10px;color:#2f4da0}input[type=file]{display:none}@media(max-width:540px){.wrap{padding:18px 12px}}</style><body><main class="wrap"><h1>采音脚本 · 文件快传</h1><p class="sub">此页面仅在同一局域网内有效。上传 TXT 脚本后，可在手机中选择创建任务；已完成的 WAV 录音可直接下载。</p><section class="card"><div class="drop"><strong>上传 TXT 脚本</strong><p class="muted">每一行是一条 JSON 字元数组，文件大小不超过 3 MB。</p><label class="btn" for="file">选择 TXT 文件</label><input id="file" type="file" accept=".txt,text/plain"><div id="message"></div></div></section><section class="card"><h2>已上传脚本</h2><div id="scripts" class="muted">正在读取…</div></section><section class="card"><h2>已完成录音 <span class="tag">WAV</span></h2><div id="recordings" class="muted">正在读取…</div></section></main><script>const token=new URLSearchParams(location.search).get('token');const msg=document.getElementById('message');const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const api=path=>path+'?token='+encodeURIComponent(token||'');async function refresh(){const r=await fetch(api('/api/status'));const d=await r.json();if(!r.ok)throw Error(d.error||'访问口令无效');document.getElementById('scripts').innerHTML=d.scripts.length?d.scripts.map(x=>'<div class="row"><span class="name">'+esc(x.name)+'</span><span class="muted">已接收</span></div>').join(''):'暂未上传脚本。';document.getElementById('recordings').innerHTML=d.recordings.length?d.recordings.map(x=>'<div class="row"><span class="name">'+esc(x.name)+'</span><button class="btn" onclick="downloadFile(\''+x.id+'\',\''+esc(x.name).replace(/'/g,'&#39;')+'\')">下载</button></div>').join(''):'暂无已完成录音。'}async function downloadFile(id,name){msg.textContent='正在准备下载…';const r=await fetch(api('/api/download')+'&id='+encodeURIComponent(id));const d=await r.json();if(!r.ok)throw Error(d.error||'下载失败');const raw=atob(d.base64), bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));link.download=name;link.click();URL.revokeObjectURL(link.href);msg.textContent='下载已开始。'}document.getElementById('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!/\.txt$/i.test(file.name)){msg.textContent='仅支持 TXT 文件。';return}if(file.size>${MAX_SCRIPT_SIZE}){msg.textContent='文件超过 3 MB 限制。';return}msg.textContent='正在上传…';try{const content=await file.text(),r=await fetch(api('/api/upload'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,content})}),d=await r.json();if(!r.ok)throw Error(d.error||'上传失败');msg.textContent='上传成功：'+file.name;await refresh()}catch(err){msg.textContent=err.message||'上传失败'}e.target.value=''};refresh().catch(err=>msg.textContent=err.message||'无法连接手机');setInterval(()=>refresh().catch(()=>{}),2500);</script></body></html>`;
}

function registerRoutes() {
  if (routesRegistered) return;
  routesRegistered = true;
  const server = getHttpServer();
  server.route("/", "GET", async (request) => isAuthorized(request) ? { statusCode: 200, contentType: "text/html; charset=utf-8", body: htmlPage() } : { statusCode: 401, contentType: "text/plain; charset=utf-8", body: "请输入手机显示的文件快传地址和访问口令。" });
  server.route("/api/status", "GET", async (request) => {
    if (!isAuthorized(request)) return json({ error: "访问口令无效。" }, 401);
    const recordings = await recordingDownloads();
    return json({ scripts: activeSession?.scripts ?? [], recordings: recordings.map(({ id, name, size }) => ({ id, name, size })) });
  });
  server.route("/api/upload", "POST", async (request) => {
    if (!isAuthorized(request)) return json({ error: "访问口令无效。" }, 401);
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
  });
  server.route("/api/download", "GET", async (request) => {
    if (!isAuthorized(request)) return json({ error: "访问口令无效。" }, 401);
    try {
      const id = readParams(request).id;
      const file = (await recordingDownloads()).find((item) => item.id === id);
      if (!file) throw new Error("录音不存在或尚未完成。");
      if (file.size > 45 * 1024 * 1024) throw new Error("单个录音超过 45 MB，请使用应用内分享功能。" );
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      return json({ name: file.name, base64 });
    } catch (error) { return json({ error: error instanceof Error ? error.message : "无法读取录音。" }, 400); }
  });
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
  const server = getHttpServer();
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(new Error(error)); else resolve();
      };
      const timeout = setTimeout(() => finish(`端口 ${PORT} 未在 4 秒内开始监听。`), 4000);
      server.setup(PORT, (event) => {
        if (event.status === "STARTED") finish();
        if (event.status === "ERROR") finish(event.message || `端口 ${PORT} 启动失败。`);
      });
      routesRegistered = false;
      registerRoutes();
      server.start();
    });
    await verifyListening(activeSession);
    serverState = "running";
    return getLanFileTransferStatus();
  } catch (error) {
    serverState = "error";
    serverError = error instanceof Error ? error.message : `端口 ${PORT} 启动失败。`;
    try { server.stop(); } catch { /* the native service may already have stopped */ }
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
  routesRegistered = false;
  serverState = "stopped";
  serverError = undefined;
  if (Platform.OS !== "web") {
    try { getHttpServer().stop(); }
    catch { /* stopping an uninitialized native service is safe to ignore */ }
  }
}
