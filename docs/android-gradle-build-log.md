# Android Gradle 构建日志采集

本项目已修复 Expo SDK 54 原生依赖错配：`expo-document-picker`、`expo-file-system`、`expo-sharing` 已切换到 SDK 54 对应版本，已安装 `expo-asset`，并在应用配置中声明其插件；之前的 `expo-file-system` 重复原生模块也已消除。

请在项目界面重新点击 **Publish**。若仍显示 `Gradle build failed with unknown error`，请打开失败构建的日志并展开 **Run gradlew** 阶段。复制以下范围的完整文本发送回来：

1. 第一个 `FAILURE: Build failed with an exception.`；
2. 紧随其后的 `* What went wrong:` 与 `Caused by:`；
3. 错误段落前后各约 30 行。

不要只发送任务摘要或最后一行 `Gradle build failed`。这些文字没有包含具体的任务名、缺失类、依赖坐标或资源路径，无法确定后续修复方向。

如果日志包含任何令牌、签名密钥或个人路径，可先遮盖这些内容；但请保留 Gradle 任务名称、异常类名和依赖版本号。
