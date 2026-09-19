import type { ChatMessage, DayShifts, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { sortShifts } from './shift'

const SHIFTS_KEY = 'scheduler.shifts.v1'
const SETTINGS_KEY = 'scheduler.settings.v1'
const CHAT_KEY = 'scheduler.chat.v1'
const ONBOARD_KEY = 'scheduler.onboarded.v1'

// DeepSeek 已下线 deepseek-chat / deepseek-reasoner，旧存档自动迁移到新模型名
const LEGACY_MODELS: Record<string, string> = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-flash',
  'deepseek-v3': 'deepseek-flash',
  'deepseek-r1': 'deepseek-flash',
}

export function loadShifts(): DayShifts {
  try {
    const raw = localStorage.getItem(SHIFTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DayShifts
    const next: DayShifts = {}
    for (const [date, list] of Object.entries(parsed)) {
      next[date] = sortShifts(list ?? [])
    }
    return next
  } catch {
    return {}
  }
}

export function saveShifts(shifts: DayShifts): void {
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts))
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const merged = raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS }
    const legacy = LEGACY_MODELS[merged.model]
    if (legacy) merged.model = legacy
    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARD_KEY) === '1'
  } catch {
    return true
  }
}

export function saveOnboarded(): void {
  try {
    localStorage.setItem(ONBOARD_KEY, '1')
  } catch {
    // 引导标记写入失败时不阻塞使用
  }
}

export function loadChat(): unknown[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    return raw ? (JSON.parse(raw) as unknown[]) : []
  } catch {
    return []
  }
}

export function saveChat(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages))
    return
  } catch {
    // 图片数据体积大，写入失败时退化为只保留最近记录，并去掉旧消息里的图片
  }
  try {
    const trimmed = messages.slice(-20).map((message, index, arr) => {
      const isLast = index === arr.length - 1
      return isLast ? message : { ...message, images: undefined }
    })
    localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed))
  } catch {
    // 历史记录非关键数据，放弃写入
  }
}
