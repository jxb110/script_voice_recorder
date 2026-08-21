# Windows 本地构建 Android APK 指南

本指南适用于当前 **采音脚本** 项目。项目包含原生 WAV 录音、局域网文件快传等模块，因此必须生成原生 Android 工程并使用 Gradle 构建；整个流程在您的电脑上执行，**不使用 Expo/EAS 云端构建配额**。

## 1. 准备环境

请在 Windows 10/11 电脑上安装下列软件，并重新打开 PowerShell，以让环境变量生效。

| 软件 | 建议版本或组件 | 用途 |
| --- | --- | --- |
| Git | 最新稳定版 | 获取和更新项目代码。 |
| Node.js | 22 LTS | 与项目当前 Node 22 开发环境一致。 |
| pnpm | 9.12.0 | 项目锁定的包管理器版本。 |
| Android Studio | 最新稳定版 | Android SDK、NDK、CMake 与 APK 构建工具。 |
| JDK | 17 | Gradle/Android 构建所需 Java 环境。Android Studio 自带的 JBR 也可使用。 |

在 Android Studio 的 **SDK Manager** 中安装 Android SDK Platform、Android SDK Build-Tools、Android SDK Platform-Tools、**NDK (Side by side)** 与 **CMake**。首次构建时，若 Gradle 提示缺少特定 SDK/NDK 版本，请按提示安装对应版本后重试。

> 当前项目的原生 WAV 录音模块使用 C++/原生 Android 构建链路；缺少 NDK 或 CMake 时，Gradle 会在原生模块阶段失败。

建议设置以下 Windows 用户环境变量（将 `你的用户名` 改为实际用户名）：

```text
ANDROID_HOME=C:\Users\你的用户名\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT=C:\Users\你的用户名\AppData\Local\Android\Sdk
JAVA_HOME=C:\Program Files\Java\jdk-17
```

在 `Path` 中加入：

```text
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

完成后，新开 PowerShell 并执行 `adb --version`、`java -version`；两者均能输出版本号即可继续。

## 2. 获取项目代码

在 PowerShell 中运行：

```powershell
git clone https://github.com/jxb110/script_voice_recorder.git
cd script_voice_recorder
git pull origin main
npm install -g pnpm@9.12.0
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

如果电脑已经有该项目目录，请不要重新克隆；改为在项目目录执行：

```powershell
git pull origin main
pnpm install --frozen-lockfile
```

## 3. 生成原生 Android 工程

项目不提交生成的 `android/` 构建目录。首次构建或升级原生依赖后，在项目根目录运行：

```powershell
npx expo prebuild --platform android --clean --no-install
```

该命令会根据 `app.config.ts` 写入麦克风、网络、媒体库权限，以及 WAV 与文件快传的原生模块配置。之后如果修改了 `app.config.ts`、安装了新的原生包，或遇到难以解释的 Gradle 缓存问题，再重复执行此命令。

## 4. 生成可直接安装的调试 APK

以下命令可绕过 EAS 配额，快速把应用装到 Honor 手机测试：

```powershell
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

构建成功后的 APK 在：

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

把 `app-debug.apk` 复制到手机后打开安装即可。也可以开启 **开发者选项 → USB 调试**，连接 USB 后执行：

```powershell
adb devices
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

HarmonyOS/Android 如提示“禁止从此来源安装”，请在系统设置中允许当前文件管理器或 ADB 安装未知应用。

## 5. 生成长期使用的签名发布 APK

调试 APK 适合测试。若要长期分发和后续覆盖升级，请在 Android Studio 中打开项目的 `android` 文件夹，然后选择：

```text
Build → Generate Signed Bundle / APK → APK → Create new…
```

创建 `.jks` 密钥库并**妥善备份**密钥库文件、别名和密码；之后每次发布必须使用同一份密钥，才能覆盖安装旧版本。不要把 `.jks` 文件或密码提交到 GitHub。

## 6. 首次设备验证

安装新的 APK 后，请完成以下检查：

1. 在系统权限弹窗中允许麦克风和媒体访问。
2. 在“录音设置”确认输出格式为 WAV，并选择 16-bit 或 32-bit。
3. 录制一条短句，确认可播放、分享并在 `record_jxb/wave` 目录看到 WAV 文件。
4. 让手机与电脑接入同一 Wi-Fi，打开“文件快传”，用电脑浏览器输入应用显示的完整地址与口令，上传一个 TXT 脚本并下载一条录音。

文件快传是前台局域网服务；使用时请让应用停留在文件快传页面，避免锁屏或切到后台。

## 常见错误

| 现象 | 优先处理方法 |
| --- | --- |
| `SDK location not found` | 在 `android/local.properties` 写入 `sdk.dir=C:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk`，或检查 `ANDROID_HOME`。 |
| `JAVA_HOME is not set` 或 Java 版本错误 | 设置 JDK 17 的 `JAVA_HOME`，重新打开 PowerShell。 |
| CMake/NDK 相关错误 | 在 Android Studio SDK Manager 安装 NDK (Side by side) 与 CMake；按 Gradle 报错指定版本补装。 |
| Gradle 下载很慢/失败 | 确认网络可访问 Maven/Gradle 依赖仓库；不要中断第一次依赖下载。 |
| 安装时报签名不一致 | 卸载旧调试包后重装，或使用与旧发布包相同的签名密钥。 |
| 文件快传地址无法打开 | 确认电脑和手机同一 Wi-Fi、应用保持前台、地址包含口令；关闭客户端隔离或访客网络。 |

## 参考资料

[1] [Expo：使用本地 Android 工具链](https://docs.expo.dev/workflow/android-studio-emulator/)

[2] [Android Developers：在 Android Studio 中生成签名 APK](https://developer.android.com/studio/publish/app-signing)

[3] [Expo：Prebuild 工作流](https://docs.expo.dev/workflow/prebuild/)
