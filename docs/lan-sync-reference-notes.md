# 局域网同步连接研究记录

本轮仅将公开项目作为设计参考，不复制其源代码或资源。

## OpenCamera-Sensors

- 参考项目在多设备同步时以热点或同一 Wi-Fi 为前提，客户端在主控开始前保持等待状态。
- `NetworkHelpers` 通过 Android Wi-Fi/DHCP 信息识别热点主机地址，并处理 Android 地址字节序；其远程服务则枚举非回环 IPv4 网络接口展示可连接地址。
- 远程 RPC 服务使用原生 `ServerSocket`、`setReuseAddress(true)`、短接收超时和每客户端 keep-alive。对于本项目，应同样确保主控实际监听在全部 IPv4 接口，界面显示的是该接口地址，并在握手前后提供明确诊断。

来源：<https://github.com/prime-slam/OpenCamera-Sensors>；<https://raw.githubusercontent.com/prime-slam/OpenCamera-Sensors/master/app/src/main/java/com/googleresearch/capturesync/softwaresync/NetworkHelpers.java>；<https://raw.githubusercontent.com/prime-slam/OpenCamera-Sensors/master/app/src/main/java/net/sourceforge/opencamera/sensorremote/RemoteRpcServer.java>。

## SoundSynk

- 参考项目采用“主控会话 + 客户端加入”的交互模型，并将实时媒体与会话管理分别交由不同通信层处理。
- 本项目不需要其音频流转发；保留本地 WAV 录制，只借鉴主控—客户端的会话分层、客户端等待主控指令和可观测连接状态。

来源：<https://github.com/sahil-mengji/soundsynk>。
