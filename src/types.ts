export interface Shift {
  id: string
  name: string
  start?: string
  end?: string
  color?: string
}

export interface DayShifts {
  [date: string]: Shift[]
}

export type ReasoningEffort = 'low' | 'medium' | 'high'

export interface Settings {
  apiKey: string
  baseUrl: string
  model: string
  thinking: boolean
  reasoningEffort: ReasoningEffort
  remindBeforeShift: boolean
  reminderMinutes: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  images?: string[]
}

export type ChatPhase = 'idle' | 'thinking' | 'scheduling'

export interface ScheduleOp {
  op: 'set' | 'clear'
  date: string
  shifts?: Array<{ name: string; start?: string; end?: string; color?: string }>
}

export interface AiResult {
  message: string
  ops: ScheduleOp[]
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  thinking: true,
  reasoningEffort: 'high',
  remindBeforeShift: true,
  reminderMinutes: 30,
}
