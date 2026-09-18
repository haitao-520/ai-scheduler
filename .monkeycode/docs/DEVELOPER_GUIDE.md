# 排班日历 开发者指南

## 项目目的

排班日历是一个安卓排班应用，把日历、AI 对话和桌面小部件整合在一起。它在更大系统中是一个独立、无后端的终端应用：所有数据存在设备本地，唯一的外部依赖是 DeepSeek 的 AI 接口。

**核心职责**

- 展示与手动编辑按日排班
- 用自然语言驱动 AI 生成排班并即时写入日历
- 通过两个桌面小部件在应用外展示排班
- 在设备本地持久化排班、设置与对话历史

**相关系统**

- DeepSeek Chat Completions - 提供自然语言到结构化排班操作的转换
- Android 桌面（Launcher）- 托管并渲染两个 AppWidget

## 环境搭建

### 前置条件

- Node.js（自带 npm）
- Java 17：`/usr/lib/jvm/java-17-openjdk-amd64`
- Android SDK：`/opt/android-sdk`，需 Platform 34 与 Build-Tools 34.0.0
- 无安卓模拟器时只能编译 APK，UI 需真机验证

### 安装

```bash
# 安装 Web 依赖
npm install
```

安卓工程由 Capacitor 生成，依赖通过 `npx cap sync android` 拉取。

### 环境变量

本项目构建不需要设置环境变量；AI 的 API Key 由用户在应用内设置页填写，保存在设备 `localStorage`，不进入代码或构建产物。请勿把任何 Key 写入仓库。

## 运行与构建

### 开发

```bash
# 启动 Web 开发服务器（0.0.0.0:5173）
npm run dev
```

开发服务器已配置 `allowedHosts: ['.monkeycode-ai.online']`，并通过 `/deepseek-proxy` 代理到 `https://api.deepseek.com`，浏览器内即可调试 AI 对话。

### 类型检查

```bash
# 仅做类型检查，不产出文件
npm run typecheck
```

### 完整构建（Web + 同步 + APK）

```bash
# 1. 类型检查并构建 Web 产物
npm run build

# 2. 同步 Web 产物到原生工程
npx cap sync android

# 3. 编译 Debug APK 并复制到下载目录
cd android
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../public/app-debug.apk
```

### 仅重打包 APK（Web 未改动）

```bash
cd android
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../public/app-debug.apk
```

构建时建议显式导出 Java 与 Android SDK 环境变量：

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH
```

### 校验版本号

```bash
# 读取 APK 的包名与版本
/opt/android-sdk/build-tools/34.0.0/aapt dump badging public/app-debug.apk | grep '^package'
```

### 版本发布约定

**每次构建 APK 都要递增版本号**：`versionName` 加 `0.01`，`versionCode` 加 1。改的是 `android/app/build.gradle` 中的两个字段。

| 字段 | 当前值 |
|------|--------|
| `versionCode` | 26 |
| `versionName` | 1.25 |

## 开发工作流

### 代码质量工具

| 工具 | 命令 | 目的 |
|------|------|------|
| TypeScript | `npm run typecheck` | 类型检查（`strict` + `noUnusedLocals`） |
| Vite | `npm run build` | 构建并隐式执行 `tsc -b` |

项目未配置 lint/格式化脚本与自动化测试，改动后至少执行一次 `npm run typecheck`。修改安卓代码后执行 `./gradlew :app:compileDebugJavaWithJavac` 验证编译。

### 提交前检查

1. `npm run typecheck` 通过
2. 改动过 Java 时，`./gradlew :app:compileDebugJavaWithJavac` 通过
3. 改动了小部件时，真机删除旧小部件并重新添加后确认渲染
4. 如构建 APK，`versionCode` 与 `versionName` 已递增

## 常见任务

### 调整班次默认时间或新增班次预设

**需修改的文件**

1. `src/lib/shift.ts` - `DEFAULT_TIMES` 增删预设
2. `src/lib/colors.ts` - 若新班次需要专属配色，补充 `KNOWN`

**步骤**

1. 在 `DEFAULT_TIMES` 中按 `名称: [开始, 结束]` 增加条目
2. 需要专属颜色时在 `KNOWN` 中映射到 `ShiftColor`
3. 如小部件也要体现，检查 `CalendarWidgetProvider.periodColor` 的时段区间

### 调整配色

Web 与原生各有一套颜色定义，需同步修改：

1. `src/lib/colors.ts` - `WORK` / `REST` / `MORNING` / `NOON` / `EVENING` / `NIGHT`
2. `android/app/src/main/java/com/pbrili/CalendarWidgetProvider.java` - 同名的颜色数组，格式为 `{背景色, 前景色}` 的 `0xAARRGGBB`
3. `android/app/src/main/res/drawable/widget_bg.xml` 与 `widget_bg2.xml` - 小部件背景与描边
4. `android/app/src/main/res/layout/widget_shifts.xml` - 今明班次小部件的默认文字色

### 修改 AI 行为

**需修改的文件**

1. `src/lib/deepseek.ts` - `SYSTEM_PROMPT`（操作语义、默认时间、输出格式约束）
2. `src/lib/deepseek.ts` - `parseAiResult`（如果 JSON 结构本身变化）
3. `src/types.ts` - `AiResult` / `ScheduleOp`（如果协议变化）
4. `src/App.tsx` - `applyOps`（如果新增操作类型）

**步骤**

1. 先确定要改的是提示词还是协议；只调行为改提示词即可
2. 协议变更时同步更新 `parseAiResult` 的校验与 `INTERFACES.md`
3. 在浏览器用 `npm run dev` 实测一轮对话

### 新增本地存储字段

**需修改的文件**

1. `src/types.ts` - 扩展 `Settings` 或相关类型
2. `src/lib/storage.ts` - 读取时提供默认值，写入时持久化
3. `src/App.tsx` - 在对应的 `useEffect` 中触发保存

**步骤**

1. 类型中加入可选或必填字段，并提供默认值
2. `loadXxx` 中用展开合并默认值，避免旧数据缺字段
3. 确认 `saveXxx` 的 `useEffect` 依赖已包含新状态

### 新增或修改桌面小部件

**需修改的文件**

1. `android/app/src/main/res/layout/widget_xxx.xml` - 布局（固定 id，勿用运行时 `addView`）
2. `android/app/src/main/res/xml/widget_xxx_info.xml` - `appwidget-provider` 元数据
3. `android/app/src/main/java/com/pbrili/XxxWidgetProvider.java` - 渲染逻辑
4. `android/app/src/main/AndroidManifest.xml` - 注册 `receiver`
5. 如需 JS 触发刷新，在 `CalendarWidgetPlugin.save` 中调用其 `updateAll`

**步骤**

1. 参照 `widget_shifts` 的最小实现（布局 + info + Provider + manifest）
2. 目标尺寸换算：格数 ≈ `(dp + 30) / 70`，2 列/行用 110dp，1 行用 40dp
3. 只用 `RemoteViews` 支持的方法（见「已知坑」）
4. 构建安装后，删除桌面上的旧小部件再重新添加

### 修复 Bug

**流程**

1. 先复现并定位是 Web 层还是原生层
2. Web 层问题用 `npm run typecheck` + 浏览器复现
3. 原生层问题用 `./gradlew :app:compileDebugJavaWithJavac`，必要时借助 `CalendarWidgetProvider.writeStatus` 的 `status` 键排查
4. 用最小改动修复，重新构建验证

## 编码规范

### 文件组织

- 组件放在 `src/components/`，一个文件一个组件，文件名与组件同名
- 领域与基础设施逻辑放在 `src/lib/`，一个文件一个主题
- 共享类型集中在 `src/types.ts`

### 命名

| 类型 | 约定 | 示例 |
|------|------|------|
| 组件文件 | PascalCase `.tsx` | `ChatPanel.tsx` |
| 逻辑文件 | camelCase `.ts` | `deepseek.ts` |
| 组件/函数组件 | PascalCase | `Calendar` |
| 函数/变量 | camelCase | `colorForShift` |
| 常量 | SCREAMING_SNAKE | `MAX_IMAGES` |
| Java 类 | PascalCase | `ShiftWidgetProvider` |

### 语言

- 面向用户的文案使用简体中文
- 代码标识符使用英文
- 仅在解释「为什么」时写注释，不写复述代码的注释

### 错误处理

- AI 请求失败抛出具体信息，由 `App.tsx` 统一展示到对话面板
- 本地存储读写用 `try/catch` 兜底，失败不阻断主流程
- 原生小部件渲染失败静默处理，避免拖垮桌面

## 已知坑与注意事项

### RemoteViews 限制

`RemoteViews` 使用**反射式方法调用**（例如 `views.setInt(id, "setBackgroundColor", color)`）会因桌面 host 校验而让整个 RemoteViews 失效，表现为小部件静默回退到旧布局或最小布局。只能调用受支持的直接方法：`setTextViewText`、`setTextColor`、`setViewVisibility`、`setOnClickPendingIntent` 等。自定义 `@drawable` 背景、`@font` 字体与 `layout_weight` 可以正常工作。

### Android 返回键

Capacitor 默认不处理硬件返回键，按下会直接结束 Activity。`MainActivity` 覆写了 `onBackPressed`：当 `WebView.canGoBack()` 为真时执行 `goBack()`，触发网页端 `popstate` 关闭浮层；否则才退出应用。浮层与浏览器历史的对应关系由 `App.tsx` 的 `overlayStack` 维护，新增浮层时应在 `openOverlay` / `closeOverlay` / `popstate` 三处同步处理。

### 小部件调试

- 每次修改小部件布局或 id 后，必须删除桌面上的旧小部件并重新添加，否则看到的是旧布局
- `CalendarWidgetProvider.writeStatus` 会把渲染步骤写入 `SharedPreferences` 的 `status` 键，可通过 `getStatus` 读取
- `ONLY ALARM` / 静态网格的好处是可在编译期确定 id，避免运行时增删视图

### 无模拟器

本环境没有安卓模拟器，只能编译 APK，所有 UI 效果必须在真机安装验证。

### 图片识别

`deepseek-chat` 不支持图片输入。发送图片识别前，需在设置页把模型改为支持视觉的模型（如 `deepseek-vl` 系列），否则模型无法看到图片内容。

## 低风险起步区域

初次接手可从以下改动入手，影响面小、易于验证：

1. `src/lib/shift.ts` 的 `DEFAULT_TIMES` - 增减班次预设
2. `src/components/ChatPanel.tsx` 的 `SUGGESTIONS` - 调整对话快捷语
3. `src/styles.css` 的主题变量 - 调整配色与圆角
