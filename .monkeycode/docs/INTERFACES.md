# 排班日历 接口文档

本应用对外没有 HTTP 服务端接口（数据在本地）。这里的「接口」指四类契约：

1. Web 层与 AI 服务之间的 **DeepSeek Chat Completions** 契约；
2. AI 返回的 **排班操作 JSON 协议**；
3. Web 层与原生层之间的 **Capacitor 插件接口**；
4. React 组件之间的 **Props 接口**。

## DeepSeek Chat Completions 契约

请求由 `src/lib/deepseek.ts` 的 `chatCompletion` 发起。

**端点**

```
POST {baseUrl}/chat/completions
```

`baseUrl` 默认 `https://api.deepseek.com`，可在设置页修改。

**请求头**

| 头 | 值 |
|----|-----|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {apiKey}` |

**请求体（深度思考开启时）**

```json
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "system", "content": "系统提示词" },
    { "role": "system", "content": "当前日期与该月已有排班" },
    { "role": "user", "content": "这个月每天早班" }
  ],
  "stream": false,
  "response_format": { "type": "json_object" },
  "thinking": { "type": "enabled" },
  "reasoning_effort": "high",
  "max_tokens": 16000
}
```

**请求体（深度思考关闭时）**

```json
{
  "model": "deepseek-chat",
  "messages": [ "..." ],
  "stream": false,
  "response_format": { "type": "json_object" },
  "temperature": 0.2
}
```

**多模态消息**：当用户消息带图片时，`content` 从字符串变为数组：

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "这是排班表" },
    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
  ]
}
```

注意：图片识别需要选择支持视觉的模型（如 `deepseek-vl` 系列），默认 `deepseek-chat` 不支持。

**响应读取**

从 `choices[0].message` 读取：

| 字段 | 含义 |
|------|------|
| `content` | 模型输出的 JSON 字符串 |
| `reasoning_content` | 深度思考过程（可选，用于「已深度思考」折叠区） |
| `finish_reason` | 等于 `length` 时标记为截断 |

**传输方式**

| 运行环境 | 实现 | 超时 |
|----------|------|------|
| 原生（APK） | `CapacitorHttp.post` | connect 30s / read 180s |
| 浏览器开发 | `fetch('/deepseek-proxy/chat/completions')`，由 `vite.config.ts` 代理到 `https://api.deepseek.com` | 浏览器默认 |

**错误**

非 2xx 时抛出 `DeepSeek 请求失败 (状态码): 服务端 message`。缺少 Key 时抛出 `请先在设置中填写 DeepSeek API Key`。

## 排班操作 JSON 协议

AI 必须返回一个 JSON 对象，结构为 `AiResult`：

```json
{
  "message": "给用户的自然语言回复",
  "ops": [
    { "op": "set", "date": "2026-09-01", "shifts": [{ "name": "早班", "start": "08:00", "end": "16:00" }] },
    { "op": "clear", "date": "2026-09-05" }
  ]
}
```

**字段约束**

| 字段 | 类型 | 约束 |
|------|------|------|
| `message` | string | 缺失时回退为「已完成操作」 |
| `ops` | array | 非数组时视为空数组 |
| `op.op` | `"set"` \| `"clear"` | 其他值忽略 |
| `op.date` | string | 必须匹配 `^\d{4}-\d{2}-\d{2}$`，否则忽略该条 |
| `op.shifts[].name` | string | 空或缺失时回退为「班次」 |
| `op.shifts[].start` / `end` | string | 可选，24 小时制 `HH:mm` |
| `op.shifts[].color` | string | 可选，通常由客户端根据时间重新计算 |

**解析容错**：`parseAiResult` 依次尝试原文、去除 Markdown 代码块后的内容、截取的平衡 JSON 片段、以及补全括号与引号后的结果。全部失败则抛错，`App.tsx` 会要求模型重发一次；再次失败则把第一次的纯文本作为回复展示。

## Capacitor 插件接口

插件名：`CalendarWidget`。声明于 `src/lib/widget.ts`，实现于 `CalendarWidgetPlugin.java`。

### `save`

把排班快照写入原生存储并刷新小部件。

```ts
CalendarWidget.save({ data: string }): Promise<void>
```

**参数**

| 字段 | 类型 | 说明 |
|------|------|------|
| `data` | string | JSON 字符串，形如 `{ "shifts": { "2026-09-01": [{ "name": "早班", "start": "08:00", "end": "17:00" }] } }` |

**行为**

1. 将 `data` 写入 `SharedPreferences` 文件 `scheduler_widget` 的键 `data`（`apply()` 异步落盘）。
2. 在主线程调用 `CalendarWidgetProvider.updateAll(context)` 与 `ShiftWidgetProvider.updateAll(context)`。
3. `resolve()` 无返回数据。

**调用方**：`src/lib/widget.ts` 的 `syncCalendarWidget`，仅在原生平台调用。

### `getStatus`

读取原生日志键 `status`，用于排查小部件渲染问题。

```ts
CalendarWidget.getStatus(): Promise<{ status: string }>
```

**行为**：返回 `SharedPreferences` 中 `status` 键的内容。该键由 `CalendarWidgetProvider.writeStatus` 以「最新 <- 更早」的链式格式写入，最长保留 400 字符。

**当前状态**：该接口仍保留在插件与 `widget.ts` 中，但应用界面已不再调用。

## Android 广播接口

两个 Provider 都监听系统广播 `android.appwidget.action.APPWIDGET_UPDATE`，并声明各自的 `appwidget-provider` 元数据。

| 组件 | label | 布局 | 目标尺寸 |
|------|-------|------|----------|
| `.CalendarWidgetProvider` | 排班日历 | `@layout/widget_calendar` | 2×2（min 110dp × 110dp） |
| `.ShiftWidgetProvider` | 今明班次 | `@layout/widget_shifts` | 2×1（min 110dp × 40dp） |

`updatePeriodMillis` 均为 1800000（30 分钟），作为系统兜底刷新；正常刷新由插件 `save` 主动触发。

两个小部件点击后都启动 `MainActivity`（`FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP`，`PendingIntent.FLAG_IMMUTABLE`）。

## React 组件 Props 接口

### `Calendar`

```ts
interface CalendarProps {
  month: Date
  shifts: DayShifts
  today: Date
  onShiftMonth: (delta: number) => void
  onGoToday: () => void
  onSelectDay: (date: Date) => void
}
```

手势参数（组件内常量）：`SWIPE_THRESHOLD = 46`（横向切月阈值像素）、`AXIS_LOCK = 8`（方向锁定阈值）、`REVEAL_DISTANCE = 150`（下拉展开所需位移）、`SNAP_MS = 280`（动画时长）。

### `ChatPanel`

```ts
interface ChatPanelProps {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  hasApiKey: boolean
  onSend: (text: string, images: string[]) => void
  onClose: () => void
  onOpenSettings: () => void
}
```

约束：最多 `MAX_IMAGES = 4` 张图片；预设快捷语 `SUGGESTIONS`。

### `DayEditor`

```ts
interface DayEditorProps {
  date: Date
  shifts: Shift[]
  onClose: () => void
  onChange: (shifts: Shift[]) => void
}
```

模式切换 `'time' | 'rest'`；时间模式下默认 `08:00 - 12:40`。

### `SettingsModal`

```ts
interface SettingsModalProps {
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
  onClearHistory: () => void
}
```

保存后 400ms 自动关闭。

### `TimeWheel`

```ts
interface TimeWheelProps {
  value: string        // "HH:mm"
  onChange: (value: string) => void
}
```

滚轮固件参数：`ITEM_HEIGHT = 34`、`SETTLE_MS = 120`；小时 0-23、分钟 0-59。

## 本地存储键

| 键 | 内容 | 写入位置 |
|----|------|----------|
| `scheduler.shifts.v1` | `DayShifts`，日期到班次数组的映射 | `src/lib/storage.ts` |
| `scheduler.settings.v1` | `Settings` 对象 | `src/lib/storage.ts` |
| `scheduler.chat.v1` | `ChatMessage[]` 对话历史 | `src/lib/storage.ts` |
| `scheduler_widget` / `data` | 小部件读取的排班快照 JSON | `CalendarWidgetPlugin.java` |
| `scheduler_widget` / `status` | 小部件渲染诊断日志 | `CalendarWidgetProvider.java` |

## 构建产物接口

| 产物 | 位置 | 说明 |
|------|------|------|
| Web 构建 | `dist/` | `npm run build` 生成，由 `cap sync` 同步到 `android/app/src/main/assets/public/` |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | 构建后复制到 `public/app-debug.apk` 供下载页使用 |
