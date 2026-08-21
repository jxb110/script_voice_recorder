# WAV 与局域网文件快传技术评估

## 当前实现边界

现有 `expo-audio` 的 Android 录音输出格式仅包含 `3gp`、`mpeg4`、`aac_adts`、`webm` 等，不包含 WAV，也没有 Android PCM 位深字段。因此仅调整当前设置页无法生成真正的 16-bit 或 32-bit WAV。

## 可行的完整方案

`react-native-audio-api` 可在 Expo 原生构建中通过其插件接入，并支持 WAV 文件输出、可配置 PCM 位深、采样率和声道。其文档说明 Android 在未启用 FFmpeg 时仍支持 WAV 文件输出。接入后需将当前 `expo-audio` 录音链路迁移至该原生模块，并重新构建 APK。

局域网“文件快传”可使用 Android 原生 HTTP 服务模块，在手机前台运行时展示 `http://手机局域网IP:端口`。同一 Wi-Fi 的浏览器可通过这个地址上传 TXT 脚本、浏览并下载已完成 WAV。每次启动应生成短期访问口令，限制可读写范围为脚本和已完成录音；退出快传页或关闭服务后地址立即失效。若要切到后台继续服务，需要 Android 前台服务及常驻通知。

## 参考

- https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder/
- https://github.com/simonsturge/expo-http-server
