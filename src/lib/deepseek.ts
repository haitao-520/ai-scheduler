import { Capacitor, CapacitorHttp } from '@capacitor/core'
import type { AiResult, ChatMessage, DayShifts, ScheduleOp, Settings } from '../types'

export const SYSTEM_PROMPT = `你是一个"日历排班 AI 助手"。用户会用自然语言告诉你他的班次安排，你要理解并转换成日历操作。

你可以执行两种日历操作：
1. set：设置某一天的班次（覆盖该天原有班次），可以一次设置多个班次。
2. clear：清空某一天的所有班次。

工作规则：
- 日期一律使用 YYYY-MM-DD 格式。遇到"明天""下周一""这个月 5 号""这周末"等相对时间，必须结合下方"当前日期"换算成具体日期。
- 遇到范围描述（如"1 号到 5 号""下周一到周五""这个月每天"）时，要展开成每一天的独立 set 操作，不要只写一天。
- 遇到"每周三""工作日""每个周末"等，要展开成当月所有符合条件的日期。
- 每个班次都要给出 start 和 end（24 小时制 HH:mm），让日历显示"几点到几点"。用户没说时间就用常见默认：早班 08:00-12:40，中班 12:40-17:20，晚班 17:20-22:00，夜班 22:00-08:00，白班 08:00-18:00。
- 纯休息类班次（如"休息""放假"）不需要时间，可以省略 start 和 end。
- 修改某天时要覆盖该天，如果用户只想改其中一个班次，请把该天其它原有班次一起写进 set，避免丢失。
- 输出前在心里核对该满足的日期列表，不要遗漏用户要求的天数。

你必须只返回一个 JSON 对象，不要输出任何多余文字或 Markdown 代码块，格式如下：
{"message":"给用户的自然语言回复","ops":[{"op":"set","date":"2026-09-01","shifts":[{"name":"早班","start":"08:00","end":"16:00"}]},{"op":"clear","date":"2026-09-05"}]}
如果不需要修改日历，ops 返回空数组 []。
务必保证输出是合法 JSON：字符串内不要出现未转义的换行，message 保持简短口语化，不要复述操作明细。即使无法理解用户意图，也要返回 {"message":"你的说明","ops":[]}，而不是输出纯文本。`

export function buildContextMessage(monthLabel: string, today: string, shifts: DayShifts, year: number, month: number): string {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const currentMonth = Object.keys(shifts)
    .filter((date) => date.startsWith(prefix))
    .sort()
    .map((date) => {
      const names = shifts[date].map((s) => (s.start && s.end ? `${s.name}(${s.start}-${s.end})` : s.name)).join('、')
      return `${date}: ${names}`
    })
  const context = currentMonth.length > 0 ? currentMonth.join('\n') : '（本月暂无排班）'

  return `当前日期：${today}
当前正在查看的月份：${monthLabel}
该月已有排班：
${context}`
}

interface ApiError {
  error?: { message?: string }
}

export interface ChatResult {
  content: string
  reasoning?: string
  truncated?: boolean
}

export interface ApiTextPart {
  type: 'text'
  text: string
}

export interface ApiImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<ApiTextPart | ApiImagePart>
}

export function toApiMessage(message: ChatMessage): ApiMessage {
  if (message.role === 'user' && message.images && message.images.length > 0) {
    const parts: Array<ApiTextPart | ApiImagePart> = []
    const text = message.content.trim()
    if (text) parts.push({ type: 'text', text })
    for (const url of message.images) {
      parts.push({ type: 'image_url', image_url: { url } })
    }
    return { role: 'user', content: parts }
  }
  return { role: message.role, content: message.content }
}

interface ChatCompletionPayload {
  model: string
  messages: ApiMessage[]
  stream: boolean
  response_format: { type: 'json_object' }
  thinking?: { type: 'enabled' }
  reasoning_effort?: string
  max_tokens?: number
  temperature?: number
}

function extractError(data: unknown, status: number): string {
  const message = (data as ApiError)?.error?.message
  return message ? `DeepSeek 请求失败 (${status}): ${message}` : `DeepSeek 请求失败 (${status})`
}

function buildPayload(settings: Settings, messages: ApiMessage[]): ChatCompletionPayload {
  const payload: ChatCompletionPayload = {
    model: settings.model,
    messages,
    stream: false,
    response_format: { type: 'json_object' },
  }
  if (settings.thinking) {
    payload.thinking = { type: 'enabled' }
    payload.reasoning_effort = settings.reasoningEffort
    payload.max_tokens = 16000
  } else {
    payload.temperature = 0.2
  }
  return payload
}

function readMessage(data: unknown): { content: string; reasoning?: string; truncated: boolean } {
  const choice = (
    data as {
      choices?: Array<{
        message?: { content?: string; reasoning_content?: string }
        finish_reason?: string
      }>
    }
  )?.choices?.[0]
  const message = choice?.message
  return {
    content: message?.content ?? '',
    reasoning: message?.reasoning_content || undefined,
    truncated: choice?.finish_reason === 'length',
  }
}

export async function chatCompletion(settings: Settings, messages: ApiMessage[]): Promise<ChatResult> {
  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置中填写 DeepSeek API Key')
  }

  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey.trim()}`,
  }
  const payload = buildPayload(settings, messages)

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({
      url,
      headers,
      data: payload,
      connectTimeout: 30000,
      readTimeout: 180000,
    })
    if (res.status < 200 || res.status >= 300) {
      throw new Error(extractError(res.data, res.status))
    }
    return readMessage(res.data)
  }

  const res = await fetch('/deepseek-proxy/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(extractError(data, res.status))
  }
  return readMessage(data)
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = (fenced ? fenced[1] : text).trim()
  const start = source.indexOf('{')
  if (start < 0) return source

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') depth += 1
    else if (ch === '}' || ch === ']') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return source.slice(start)
}

function repairJson(input: string): string {
  let inString = false
  let escaped = false
  const stack: string[] = []
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  let out = input
  if (inString) out += '"'
  out = out.replace(/[,\s]+$/, '')
  while (stack.length > 0) out += stack.pop()
  return out
}

export function parseAiResult(content: string): AiResult {
  const extracted = extractJsonObject(content)
  let parsed: unknown
  let ok = false
  for (const candidate of [extracted, repairJson(extracted)]) {
    try {
      parsed = JSON.parse(candidate)
      ok = true
      break
    } catch {
      /* try next candidate */
    }
  }

  if (!ok) {
    throw new Error('AI 返回的内容无法解析为结构化数据，请重试')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('AI 返回格式不正确')
  }

  const record = parsed as { message?: unknown; ops?: unknown }
  const message = typeof record.message === 'string' ? record.message : '已完成操作'
  const rawOps = Array.isArray(record.ops) ? record.ops : []

  const ops: ScheduleOp[] = []
  for (const item of rawOps) {
    if (typeof item !== 'object' || item === null) continue
    const op = item as Record<string, unknown>
    const date = typeof op.date === 'string' ? op.date : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    if (op.op === 'clear') {
      ops.push({ op: 'clear', date })
    } else if (op.op === 'set') {
      const shifts = Array.isArray(op.shifts) ? op.shifts : []
      const normalized = shifts
        .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
        .map((s) => ({
          name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : '班次',
          start: typeof s.start === 'string' ? s.start : undefined,
          end: typeof s.end === 'string' ? s.end : undefined,
          color: typeof s.color === 'string' ? s.color : undefined,
        }))
      ops.push({ op: 'set', date, shifts: normalized })
    }
  }

  return { message, ops }
}
