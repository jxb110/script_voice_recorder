const crypto = require("node:crypto");
const net = require("node:net");
const os = require("node:os");
const {
  LAN_SYNC_PORT,
  LAN_SYNC_NATIVE_PROTOCOL,
  HEARTBEAT_MS,
  DEVICE_OFFLINE_AFTER_MS,
  normalizeRoomCode,
  createRoomCode,
  createCommand,
  parseMessage,
  isValidCount,
  createDevice,
} = require("./sync-protocol.cjs");

class SyncRoom {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.server = null;
    this.client = null;
    this.heartbeat = null;
    this.peers = new Set();
    this.openSockets = new Set();
    this.lifecycle = Promise.resolve();
    this.session = this.makeIdle();
  }

  serializeLifecycle(operation) {
    const next = this.lifecycle.catch(() => undefined).then(operation);
    this.lifecycle = next.catch(() => undefined);
    return next;
  }

  makeIdle() {
    return { mode: "idle", self: { id: "", name: "", role: "client", state: "idle", sentenceIndex: 0, connectedAt: Date.now(), updatedAt: Date.now() }, devices: [] };
  }

  emit(type = "status", payload) {
    this.onEvent({ type, session: this.snapshot(), payload });
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.session));
  }

  getLanIp() {
    const interfaces = os.networkInterfaces();
    for (const items of Object.values(interfaces)) {
      for (const item of items ?? []) if (item.family === "IPv4" && !item.internal) return item.address;
    }
    throw new Error("未能读取电脑的局域网 IPv4 地址。请连接 Wi-Fi 或网线后重试。");
  }

  async host(input) {
    return this.serializeLifecycle(() => this.hostInternal(input));
  }

  async hostInternal({ projectId, sentenceCount, deviceName }) {
    if (!isValidCount(sentenceCount)) throw new Error("主控录音任务没有可同步的句子。");
    await this.stopInternal();
    const ip = this.getLanIp();
    const self = createDevice({ id: crypto.randomUUID(), name: deviceName, role: "host", sentenceCount });
    this.session = { mode: "host", roomCode: createRoomCode(), address: `${ip}:${LAN_SYNC_PORT}`, projectId, sentenceCount, self, devices: [self] };
    this.emit();
    this.server = net.createServer((socket) => this.handlePeer(socket));
    this.server.unref();
    this.server.on("error", (error) => { this.session.error = error.message; this.emit(); });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`端口 ${LAN_SYNC_PORT} 未在 4 秒内开始监听。`)), 4000);
      this.server.once("listening", () => { clearTimeout(timer); resolve(); });
      this.server.once("error", (error) => { clearTimeout(timer); reject(error); });
      this.server.listen({ port: LAN_SYNC_PORT, host: "0.0.0.0", reuseAddress: true });
    });
    this.heartbeat = setInterval(() => this.refreshPresence(), HEARTBEAT_MS);
    return this.snapshot();
  }

  async join(input) {
    return this.serializeLifecycle(() => this.joinInternal(input));
  }

  async joinInternal({ host, port, roomCode, projectId, sentenceCount, deviceName }) {
    if (!host || !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) throw new Error("主控 IP 或端口无效。");
    if (!normalizeRoomCode(roomCode)) throw new Error("请输入房间口令。");
    if (!isValidCount(sentenceCount)) throw new Error("当前脚本没有可同步的句子。");
    await this.stopInternal();
    const self = createDevice({ id: crypto.randomUUID(), name: deviceName, role: "client", sentenceCount });
    this.session = { mode: "idle", roomCode: normalizeRoomCode(roomCode), address: `${host}:${Number(port)}`, projectId, sentenceCount, self, devices: [] };
    this.emit();
    return new Promise((resolve, reject) => {
      let settled = false;
      let buffer = "";
      let protocolReady = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (error) { this.session = { ...this.makeIdle(), error: error.message }; this.emit(); reject(error); }
        else resolve(this.snapshot());
      };
      const socket = net.createConnection({ host, port: Number(port), timeout: 8000 }, () => socket.write(`${LAN_SYNC_NATIVE_PROTOCOL}\n`));
      this.client = socket;
      this.openSockets.add(socket);
      socket.setNoDelay(true);
      socket.setKeepAlive(true);
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        let end = buffer.indexOf("\n");
        while (end >= 0) {
          const line = buffer.slice(0, end).trim();
          buffer = buffer.slice(end + 1);
          end = buffer.indexOf("\n");
          if (!line) continue;
          if (!protocolReady) {
            if (line !== LAN_SYNC_NATIVE_PROTOCOL) { finish(new Error(`主控同步协议不匹配：${line}`)); socket.destroy(); return; }
            protocolReady = true;
            this.sendSocket(socket, { type: "hello", roomCode: this.session.roomCode, projectId, deviceId: self.id, deviceName: self.name, sentenceCount, sentAt: Date.now() });
            continue;
          }
          this.handleClientMessage(parseMessage(line), finish);
        }
      });
      socket.on("timeout", () => { finish(new Error("连接主控端超时，请检查 IP、端口与局域网。")); socket.destroy(); });
      socket.on("error", (error) => finish(new Error(`无法连接主控端：${error.message}`)));
      socket.on("close", () => {
        this.openSockets.delete(socket);
        if (!settled) finish(new Error("主控端在确认同步协议前关闭了连接。"));
        else if (this.session.mode === "client") { this.client = null; this.session = { ...this.makeIdle(), error: "与主控端的连接已断开。" }; this.emit(); }
      });
    });
  }

  async stop() {
    return this.serializeLifecycle(() => this.stopInternal());
  }

  async stopInternal() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.client) this.client.destroy();
    this.client = null;
    for (const socket of this.openSockets) {
      socket.destroy();
      socket.unref?.();
    }
    this.openSockets.clear();
    this.peers.clear();
    const server = this.server;
    this.server = null;
    this.session = this.makeIdle();
    this.emit();
    if (server && server.listening) await new Promise((resolve) => {
      server.unref();
      const fallback = setTimeout(resolve, 700);
      fallback.unref?.();
      server.close(() => { clearTimeout(fallback); resolve(); });
    });
  }

  reportState({ state, sentenceIndex, detail }) {
    if (this.session.mode === "idle") return;
    const self = { ...this.session.self, state, sentenceIndex, detail, updatedAt: Date.now() };
    this.replaceDevice(self);
    if (this.session.mode === "host") this.broadcastWelcome();
    else this.sendSocket(this.client, { type: "device-state", device: { id: self.id, name: self.name, state: self.state, sentenceIndex: self.sentenceIndex, updatedAt: self.updatedAt, detail: self.detail }, sentAt: Date.now() });
  }

  sendCommand(name, sentenceIndex) {
    if (this.session.mode !== "host") throw new Error("只有主控端可以发送同步录音指令。");
    const command = createCommand(name, this.session.projectId, sentenceIndex);
    this.session.lastCommand = command;
    this.emit("command", command);
    this.broadcast({ type: "command", command });
    return command;
  }

  handlePeer(socket) {
    const peer = { socket, buffer: "", protocolReady: false, deviceId: undefined };
    this.openSockets.add(socket);
    socket.setNoDelay(true);
    socket.setKeepAlive(true);
    socket.setTimeout(15000, () => socket.destroy());
    socket.on("data", (chunk) => {
      peer.buffer += chunk.toString("utf8");
      let end = peer.buffer.indexOf("\n");
      while (end >= 0) {
        const line = peer.buffer.slice(0, end).trim();
        peer.buffer = peer.buffer.slice(end + 1);
        end = peer.buffer.indexOf("\n");
        if (!line) continue;
        if (!peer.protocolReady) {
          if (line !== LAN_SYNC_NATIVE_PROTOCOL) { socket.end("ERR unsupported-protocol\n"); return; }
          peer.protocolReady = true;
          this.peers.add(peer);
          socket.setTimeout(0);
          socket.write(`${LAN_SYNC_NATIVE_PROTOCOL}\n`);
          continue;
        }
        this.handleHostMessage(peer, parseMessage(line));
      }
    });
    socket.on("close", () => { this.openSockets.delete(socket); if (peer.deviceId) this.markOffline(peer.deviceId); this.peers.delete(peer); this.broadcastWelcome(); });
  }

  handleHostMessage(peer, message) {
    if (!message) return;
    if (message.type === "hello") {
      if (this.session.mode !== "host") return;
      if (normalizeRoomCode(message.roomCode) !== normalizeRoomCode(this.session.roomCode)) { this.sendPeer(peer, { type: "error", message: "房间口令不匹配。请重新扫描主控二维码。" }); peer.socket.end(); return; }
      if (message.sentenceCount !== this.session.sentenceCount) { this.sendPeer(peer, { type: "error", message: `录音句数不一致：主控 ${this.session.sentenceCount} 句，当前设备 ${message.sentenceCount} 句。` }); peer.socket.end(); return; }
      peer.deviceId = message.deviceId;
      this.replaceDevice({ id: message.deviceId, name: message.deviceName, role: "client", state: "idle", sentenceIndex: 0, connectedAt: Date.now(), updatedAt: Date.now(), sentenceCount: message.sentenceCount });
      this.sendPeer(peer, { type: "welcome", roomCode: this.session.roomCode, projectId: this.session.projectId, serverTime: Date.now(), devices: this.session.devices });
      this.broadcastWelcome();
    } else if (message.type === "device-state" && peer.deviceId === message.device.id) {
      const device = this.session.devices.find((item) => item.id === peer.deviceId);
      if (device) { this.replaceDevice({ ...device, ...message.device, updatedAt: Date.now() }); this.broadcastWelcome(); }
    } else if (message.type === "ping") {
      const device = this.session.devices.find((item) => item.id === peer.deviceId);
      if (device) this.replaceDevice({ ...device, detail: undefined, updatedAt: Date.now() });
      this.sendPeer(peer, { type: "pong", sentAt: message.sentAt });
    }
  }

  handleClientMessage(message, finish) {
    if (!message) return;
    if (message.type === "welcome") {
      this.session = { ...this.session, mode: "client", roomCode: message.roomCode, projectId: message.projectId, devices: message.devices, error: undefined };
      this.emit();
      this.heartbeat = setInterval(() => this.sendSocket(this.client, { type: "ping", sentAt: Date.now() }), HEARTBEAT_MS);
      finish();
    } else if (message.type === "command") {
      this.session.lastCommand = message.command;
      this.emit("command", message.command);
    } else if (message.type === "error") finish(new Error(message.message));
  }

  replaceDevice(device) {
    this.session.self = this.session.self.id === device.id ? device : this.session.self;
    this.session.devices = [...this.session.devices.filter((item) => item.id !== device.id), device].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "host" ? -1 : 1));
    this.emit();
  }

  markOffline(deviceId) {
    const device = this.session.devices.find((item) => item.id === deviceId);
    if (device) this.replaceDevice({ ...device, state: "error", detail: "offline", updatedAt: Date.now() });
  }

  refreshPresence() {
    if (this.session.mode !== "host") return;
    const threshold = Date.now() - DEVICE_OFFLINE_AFTER_MS;
    this.session.devices.filter((device) => device.role === "client" && device.detail !== "offline" && device.updatedAt < threshold).forEach((device) => this.markOffline(device.id));
    this.broadcastWelcome();
  }

  sendSocket(socket, message) { if (socket && !socket.destroyed) socket.write(`${JSON.stringify(message)}\n`); }
  sendPeer(peer, message) { if (peer.protocolReady) this.sendSocket(peer.socket, message); }
  broadcast(message) { for (const peer of this.peers) this.sendPeer(peer, message); }
  broadcastWelcome() { if (this.session.mode === "host") this.broadcast({ type: "welcome", roomCode: this.session.roomCode, projectId: this.session.projectId, serverTime: Date.now(), devices: this.session.devices }); }
}

module.exports = { SyncRoom };
