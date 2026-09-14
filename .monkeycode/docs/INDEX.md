# 排班日历 文档

本目录是「排班日历」安卓应用的完整项目文档，覆盖系统架构、接口契约、开发者指南、核心概念与模块说明。读者可以是新加入的开发者、需要接入或二次开发的人员，或需要了解系统如何运作的维护者。

**快速链接**: [架构](./ARCHITECTURE.md) | [接口](./INTERFACES.md) | [开发者指南](./DEVELOPER_GUIDE.md)

---

## 核心文档

### [架构](./ARCHITECTURE.md)

系统设计的全局视图：技术栈、项目结构、六个子系统，以及整体架构图与 AI 排班请求时序图。从这里开始了解系统如何运作。

### [接口](./INTERFACES.md)

四类契约：DeepSeek Chat Completions 请求/响应、排班操作 JSON 协议、`CalendarWidget` 插件接口、React 组件 Props，另附本地存储键与构建产物。

### [开发者指南](./DEVELOPER_GUIDE.md)

环境搭建、运行与构建命令、版本发布约定、常见任务分步说明、编码规范，以及 RemoteViews 与返回键等已知坑。

---

## 模块

| 模块 | 描述 | 文档 |
|------|------|------|
| `src/` 前端应用 | React 组件与全局样式，承载全部界面与交互 | [前端应用](./模块/前端应用.md) |
| `src/lib/` 领域逻辑与存储 | 配色、默认时间、本地持久化、图片压缩、小部件同步 | [领域逻辑与存储](./模块/领域逻辑与存储.md) |
| `src/lib/deepseek.ts` AI 对话层 | 自然语言到结构化排班操作的转换与解析 | [AI 对话层](./模块/AI对话层.md) |
| `android/` 原生层 | WebView 容器、返回键、两个桌面小部件 | [Android 原生层](./模块/Android原生层.md) |

---

## 核心概念

理解这些领域概念有助于导航代码库：

| 概念 | 描述 | 文档 |
|------|------|------|
| 班次 | 排班的最小单位，含时间与颜色规则 | [班次](./专有概念/班次.md) |
| 排班操作 | AI 与应用之间的 `set` / `clear` 指令 | [排班操作](./专有概念/排班操作.md) |
| 桌面小部件数据 | Web 与原生之间唯一的跨层 JSON 协议 | [桌面小部件数据](./专有概念/桌面小部件数据.md) |

---

## 入门指南

### 项目新人？

按此路径学习：

1. [架构](./ARCHITECTURE.md) - 了解全局
2. [核心概念](#核心概念) - 学习领域术语
3. [开发者指南](./DEVELOPER_GUIDE.md) - 搭建环境
4. [接口](./INTERFACES.md) - 探索契约

### 需要二次开发？

1. [接口](./INTERFACES.md) - 插件与 AI 协议
2. [架构](./ARCHITECTURE.md) - 系统边界与数据流
3. [Android 原生层](./模块/Android原生层.md) - 小部件扩展

### 首次贡献？

1. [开发者指南](./DEVELOPER_GUIDE.md) - 环境搭建与工作流
2. [低风险起步区域](./DEVELOPER_GUIDE.md#低风险起步区域) - 小而安全的改动
3. [常见任务](./DEVELOPER_GUIDE.md#常见任务) - 分步指南

---

## 快速参考

### 命令

```bash
# 启动 Web 开发服务器
npm run dev

# 类型检查
npm run typecheck

# 构建 Web 产物
npm run build

# 同步到原生工程
npx cap sync android

# 编译 Debug APK
cd android && ./gradlew assembleDebug
```

### 重要文件

| 文件 | 目的 |
|------|------|
| `src/App.tsx` | 应用状态中枢与浮层编排 |
| `src/lib/deepseek.ts` | AI 提示词、请求与解析 |
| `src/lib/widget.ts` | 小部件同步桥 |
| `android/app/src/main/java/com/pbrili/CalendarWidgetProvider.java` | 日历小部件渲染 |
| `android/app/src/main/java/com/pbrili/ShiftWidgetProvider.java` | 今明班次小部件渲染 |
| `android/app/build.gradle` | 版本号与构建配置 |
| `capacitor.config.ts` | Capacitor 应用标识与产物目录 |
