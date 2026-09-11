# Windows 桌面录音波形参考

桌面端录音波形界面参考用户提供的 [xiangyuecn/Recorder](https://github.com/xiangyuecn/Recorder) 与 [Online Voice Recorder](https://online-voice-recorder.com/cn/)。前者通过实时音频处理回调持续取得新 PCM 数据并绘制音量/波形；后者采用将录制主操作与极简波形置于视觉中心的交互层次。

本项目不引入或复制外部实现。Windows Electron 渲染器使用 `AudioContext` 的 `ScriptProcessorNode` 获取当前 PCM 帧，计算每帧绝对峰值，在 `requestAnimationFrame` 中合并刷新画布，避免每个音频回调触发同步绘制。波形采用有轻微保持效果的峰值柱，静音门限为 `0.008`，使背景噪声不会形成过大的可视波形。

播放采用主进程仅返回已记录 WAV 的 `file:` URL，并由渲染器中的 `HTMLAudioElement` 播放；不授予渲染器任意文件路径访问能力。
