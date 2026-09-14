# AI 对话层

AI 对话层把用户的自然语言转成可执行的排班操作。它负责构造系统提示与上下文、按环境选择合适的传输方式调用 DeepSeek、并把模型输出稳健地解析为结构化结果。

## 结构

```
src/lib/deepseek.ts
├── SYSTEM_PROMPT         # 约束模型输出协议与排班规则
├── buildContextMessage   # 注入当前日期与当月已有排班
├── toApiMessage          # 把本地消息转成 API 消息（含图片）
├── chatCompletion        # 发起请求（原生 CapacitorHttp / Web 代理）
├── extractJsonObject     # 从文本中截取平衡的 JSON 对象
├── repairJson            # 补全括号与引号
└── parseAiResult         # 校验并归一化为 AiResult
```

## 关键文件

| 文件 | 目的 |
|------|------|
| `deepseek.ts` | 提示词、请求、解析与容错的全部实现 |

## 依赖

**本模块依赖**

- `@capacitor/core` - `Capacitor.isNativePlatform()` 与 `CapacitorHttp`
- `../types` - `AiResult`、`ScheduleOp`、`Settings`、`ChatMessage`、`DayShifts`

**依赖本模块的**

- `../App.tsx` - 构造消息、调用 `chatCompletion`、执行 `parseAiResult` 与 `applyOps`

## 规范

### 传输选择

运行时按平台切换，业务层无感知：

| 平台 | 方式 | 说明 |
|------|------|------|
| 原生 | `CapacitorHttp.post` | 绕过 WebView 的 CORS，connect 30s / read 180s |
| 浏览器 | `fetch('/deepseek-proxy/chat/completions')` | 由 Vite 代理到 DeepSeek |

### 输出协议

模型必须只返回一个 JSON 对象 `{ message, ops }`。提示词明确要求日期用 `YYYY-MM-DD`、范围要展开、时间缺失时用默认值、覆盖某天时要带上该天其余班次。

### 解析容错

`parseAiResult` 按顺序尝试多种候选：

1. 原文直接 `JSON.parse`
2. 去除 Markdown 代码块后的内容
3. `extractJsonObject` 截取的平衡 JSON 片段
4. `repairJson` 补全括号/引号后的结果

任一成功即停止；全部失败抛出「AI 返回的内容无法解析为结构化数据，请重试」，由 `App.tsx` 触发一次重发。

### 错误处理

- 缺少 Key：抛出「请先在设置中填写 DeepSeek API Key」
- 非 2xx：抛出「DeepSeek 请求失败 (状态码): 服务端 message」
- 解析失败：由调用方决定重试或降级为纯文本回复

### 测试

项目未配置测试框架，解析逻辑建议通过浏览器实测验证。

## 添加或修改能力

### 调整排班行为

只改 `SYSTEM_PROMPT`，无需改协议。适合调整默认时间、展开规则、回复语气。

### 扩展返回协议

1. 修改 `src/types.ts` 的 `AiResult` / `ScheduleOp`
2. 同步 `parseAiResult` 的校验与归一化
3. 同步 `App.tsx` 的 `applyOps` 执行逻辑
4. 更新 `INTERFACES.md` 的「排班操作 JSON 协议」

**检查清单**

- [ ] 提示词与解析逻辑对协议的理解一致
- [ ] 非法输入不会导致抛错中断整批操作
- [ ] 通过 `npm run typecheck`
