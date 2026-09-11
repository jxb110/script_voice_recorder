# 4.0.0 电脑浏览器同步录音评估

## 当前结论

现有 Android 局域网同步采用 `react-native-tcp-socket` 的原生 TCP 换行 JSON 协议，并主动拒绝 Web 平台。浏览器没有可用的原始 TCP Socket API，不能直接连接当前手机主控的 `35679` TCP 端口。

浏览器可以通过 `getUserMedia()` 使用电脑麦克风，但页面必须在 HTTPS 或 `localhost` 安全上下文中打开，且用户必须授权麦克风。网页端需要使用浏览器支持的 WebSocket/HTTP 通道，而不能复用当前原始 TCP 传输。浏览器的 `MediaRecorder` 默认产出由浏览器决定的容器与编码；如果仍要求 16-bit / 32-bit WAV，需要将捕获到的 PCM 数据在网页端编码为 WAV。

## 推荐兼容方案

为 4.0.0 在 Android 同步模块增加与现有 JSON 命令兼容的 WebSocket 监听端口，或采用本机轻量桥接程序将浏览器 WebSocket 转发为现有 TCP 行协议。浏览器页面通过 `localhost` 轻量桥接程序加载，使用 WebSocket 与桥接程序通信，再由桥接程序接入手机 TCP 房间；录音端以 Web Audio API + WAV 编码器生成音频，继续复用项目、句子、房间口令、句数校验和控制命令定义。

对于“电脑浏览器输入手机 IP 与端口”这一体验，本机桥接程序是最稳妥的方式：用户启动一次 Windows 小程序后，它自动打开 `localhost` 网页；页面中输入手机 IP、端口和口令即可加入。桥接程序也可以作为主控监听 LAN 端口，手机保持现有 TCP 客户端协议即可加入。

## 风险与前置条件

公网 HTTPS 页面访问 `http://192.168.x.x` 局域网服务可能被浏览器本地网络访问、混合内容或权限策略限制。若直接以手机 `http://IP:端口` 提供网页，网页通常不属于可稳定使用麦克风的安全上下文。纯网页直连方案需要额外的 WebSocket/TLS 与本地网络权限适配，不能作为 4.0.0 的首选路径。

## 参考来源

- MDN：[`getUserMedia()` 安全上下文与麦克风授权](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- MDN：[WebSocket 浏览器 API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- MDN：[MediaRecorder 浏览器录音 API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- WICG：[Local Network Access 说明](https://github.com/WICG/local-network-access/blob/main/explainer.md)
- Node.js：[`node:net` TCP 服务端与客户端 API](https://nodejs.org/api/net.html)
