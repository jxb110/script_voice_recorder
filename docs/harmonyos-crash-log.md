# Honor / HarmonyOS 启动闪退排查

本版本已关闭 React Native 新架构，以优先兼容 Honor 9X Pro 这类 Android 10 / HarmonyOS 3.0 设备。请先安装**新生成的 APK**；旧 APK 不会自动应用本次原生配置变更。

如果新 APK 仍在打开后立即退出，请通过 USB 数据线连接手机并开启“开发者选项 → USB 调试”，在电脑终端运行下列命令，然后复现一次闪退：

```bash
adb logcat -c
adb logcat AndroidRuntime:E ReactNativeJS:E *:S
```

请复制从 `FATAL EXCEPTION`、`AndroidRuntime` 或 `ReactNativeJS` 开始的完整错误段落。日志会区分是原生库加载、运行时权限、JavaScript 初始化还是设备系统限制导致的问题；在未取得该日志前，无法对单台设备的闪退原因作出确定判断。

若没有电脑，也可以在手机“设置 → 系统和更新 → 开发人员选项”中查看是否提供“错误报告/系统日志”入口，并导出崩溃时段日志。
