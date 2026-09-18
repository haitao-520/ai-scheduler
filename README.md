# 排班日历

一个面向轮班工作者的安卓排班应用：用日历管理班次，用一句自然语言让 AI 自动排班，还能把排班放到桌面小部件上随时查看。

基于 React + Vite 开发，通过 Capacitor 打包为安卓 APK。所有数据保存在设备本地，无自建后端。

## 功能

- **日历排班**：按周/月展示，左右滑动切月，下拉展开当日班次明细，点击日期即可增删班次（时间班次与休息两类）。
- **AI 对话排班**：用自然语言描述班次，例如「这个月每天早班」「下周一 3 号休息」，AI 会换算具体日期并写入日历；支持发送排班表截图辅助识别。
- **深度思考**：可开启 DeepSeek 的深度思考模式，并在对话中展开查看推理过程。
- **桌面小部件**：两个 AppWidget，应用内排班变化后自动刷新。
  - 「排班日历」2×2：网格日历，日期下方以「班/休」角标提示。
  - 「今明班次」2×1：今天与明天的班次时间段，按开始时间分色。
- **本地优先**：排班、设置、对话历史全部保存在本机，AI 的 API Key 只写入本地，不上传任何服务器。

## 下载安装

前往 [Releases](https://github.com/haitao-520/ai-scheduler/releases) 下载最新 APK：

- 直接下载最新版：https://github.com/haitao-520/ai-scheduler/releases/latest/download/paiban-rili.apk

系统要求：Android 5.0（API 22）及以上。安装时需允许「未知来源」应用安装。

> 当前提供的是 debug 签名版本，仅用于测试体验。

## 使用说明

1. 打开应用，点击右下角「AI 排班」。
2. 首次使用点击对话框右上角「设置」，填入 DeepSeek API Key（[开放平台申请](https://platform.deepseek.com/)），保存。
3. 返回对话，用一句话描述班次即可，例如：
   - 这个月每天早班
   - 早班时间为08:00-12:00，今天到下周二都为早班。
   - 今天是上班第三天，我上十天休五天，排出这个月和下个月的班次。
4. 也可以直接在日历上点选日期，手动添加或删除班次。

说明：

- API Key 仅保存在本机，不会上传到任何服务器。
- 图片识别需要选择支持视觉的模型（如 `deepseek-flash` 系列），默认的 `deepseek-v4 pro` 不支持图片输入。

## 技术栈

- TypeScript 5.6 + React 18.3 + Vite 5.4
- date-fns 3.6
- Capacitor 6.2（Web 到原生桥接与打包）
- Android AppWidget（`RemoteViews`）
- 数据存储：浏览器 `localStorage` + Android `SharedPreferences`（小部件）
- 外部服务：DeepSeek Chat Completions API

## 项目结构

```
.
├── src/                    # Web 应用源码
│   ├── App.tsx             # 顶层状态与浮层编排
│   ├── components/         # 日历、对话、单日编辑、设置、时间滚轮
│   └── lib/                # 配色、默认时间、存储、AI 请求、图片、小部件桥
├── android/                # Capacitor 生成的原生工程
│   └── app/src/main/java/com/pbrili/
│       ├── MainActivity.java            # 容器与返回键
│       ├── CalendarWidgetPlugin.java    # JS 到原生数据桥
│       ├── CalendarWidgetProvider.java  # 2×2 日历小部件
│       └── ShiftWidgetProvider.java     # 2×1 今明班次小部件
├── public/                 # APK 与下载页
└── .monkeycode/docs/       # 项目文档
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动 Web 开发服务器（0.0.0.0:5173）
npm run dev

# 类型检查
npm run typecheck
```

开发服务器通过 `/deepseek-proxy` 代理到 `https://api.deepseek.com`，浏览器内即可调试 AI 对话，无需配置 CORS。

## 构建 APK

```bash
# 1. 构建 Web 产物
npm run build

# 2. 同步到原生工程
npx cap sync android

# 3. 编译 Debug APK
cd android
./gradlew assembleDebug
```

构建产物位于 `android/app/build/outputs/apk/debug/app-debug.apk`。

发布约定：每次构建递增 `android/app/build.gradle` 中的 `versionCode`（加 1）与 `versionName`（加 0.01）。当前版本为 `1.20`（versionCode 21）。

## 项目文档

完整的架构、接口与开发文档见 [`.monkeycode/docs/INDEX.md`](./.monkeycode/docs/INDEX.md)：

- [架构](./.monkeycode/docs/ARCHITECTURE.md) - 技术栈、子系统、架构图与请求时序
- [接口](./.monkeycode/docs/INTERFACES.md) - DeepSeek 契约、排班操作协议、插件与组件接口
- [开发者指南](./.monkeycode/docs/DEVELOPER_GUIDE.md) - 环境搭建、构建、常见任务与已知坑
- [核心概念](./.monkeycode/docs/专有概念/班次.md) - 班次、排班操作、小部件数据
