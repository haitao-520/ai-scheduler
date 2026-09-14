import type { ChatMessage, DayShifts, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const SHIFTS_KEY = 'scheduler.shifts.v1'
const SETTINGS_KEY = 'scheduler.settings.v1'
const CHAT_KEY = 'scheduler.chat.v1'

export function loadShifts(): DayShifts {
  try {
    const raw = localStorage.getItem(SHIFTS_KEY)
    return raw ? (JSON.parse(raw) as DayShifts) : {}
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
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
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
