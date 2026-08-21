# 文件快传实现参考

本项目的局域网“文件快传”参考 [RemoteFileManager](https://github.com/kellysong/RemoteFileManager) 的 Android 远程文件管理模型。该项目将 HTTP 服务绑定到当前局域网 IPv4 地址，并通过服务启动、停止与异常回调更新界面状态。[1]

采音脚本保留“仅在应用前台开启”的约束，但采用显式 TCP 监听实现 HTTP 协议：服务绑定手机当前 Wi-Fi IPv4 地址与固定端口 `35678`，每条浏览器请求独立解析、独立响应，并在显示读写地址前从手机本机完成一次 HTTP 连通性检查。这样可避免只根据地址推断服务已启动的误导性状态。

> 重新构建并安装 APK 后，手机与浏览器设备必须处于同一 Wi-Fi；若页面仍无法访问，应检查路由器是否启用了客户端隔离（AP Isolation）。

## 参考

[1] [kellysong/RemoteFileManager](https://github.com/kellysong/RemoteFileManager)

