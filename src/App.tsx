import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, format } from 'date-fns'
import { Calendar } from './components/Calendar'
import { ChatPanel } from './components/ChatPanel'
import { DayEditor } from './components/DayEditor'
import { SettingsModal } from './components/SettingsModal'
import { buildContextMessage, chatCompletion, parseAiResult, SYSTEM_PROMPT, toApiMessage } from './lib/deepseek'
import type { ApiMessage } from './lib/deepseek'
import { colorForShift } from './lib/colors'
import { inferTimes } from './lib/shift'
import { loadChat, loadSettings, loadShifts, saveChat, saveSettings, saveShifts } from './lib/storage'
import { syncCalendarWidget } from './lib/widget'
import type { AiResult, ChatMessage, DayShifts, ScheduleOp, Settings, Shift } from './types'

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function applyOps(shifts: DayShifts, ops: ScheduleOp[]): DayShifts {
  const next: DayShifts = { ...shifts }
  for (const op of ops) {
    if (op.op === 'clear') {
      delete next[op.date]
    } else {
      next[op.date] = (op.shifts ?? []).map((shift) => {
        const hasTime = shift.start && shift.end
        const times = hasTime ? { start: shift.start, end: shift.end } : inferTimes(shift.name)
        return {
          id: makeId(),
          name: shift.name,
          start: times.start,
          end: times.end,
          color: colorForShift({ name: shift.name, start: times.start, end: times.end }).fg,
        }
      })
    }
  }
  return next
}

export default function App() {
  const [shifts, setShifts] = useState<DayShifts>(() => loadShifts())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = loadChat()
    return stored.filter(
      (item): item is ChatMessage =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ChatMessage).content === 'string' &&
        ((item as ChatMessage).role === 'user' || (item as ChatMessage).role === 'assistant'),
    )
  })
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overlayStack = useRef<string[]>([])

  const openOverlay = useCallback((key: string) => {
    overlayStack.current.push(key)
    window.history.pushState({ overlay: key }, '')
    if (key === 'chat') setChatOpen(true)
    else if (key === 'settings') setSettingsOpen(true)
  }, [])

  const closeOverlay = useCallback((key: string) => {
    const idx = overlayStack.current.lastIndexOf(key)
    if (idx < 0) {
      if (key === 'chat') setChatOpen(false)
      else if (key === 'settings') setSettingsOpen(false)
      return
    }
    if (idx === overlayStack.current.length - 1) {
      window.history.back()
      return
    }
    overlayStack.current.splice(idx, 1)
    if (key === 'chat') setChatOpen(false)
    else if (key === 'settings') setSettingsOpen(false)
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const key = overlayStack.current.pop()
      if (key === 'chat') setChatOpen(false)
      else if (key === 'settings') setSettingsOpen(false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const today = useMemo(() => new Date(), [])

  const shiftMonth = useCallback((delta: number) => {
    if (delta === 0) return
    setMonth((prev) => addMonths(prev, delta))
  }, [])

  const goToday = useCallback(() => {
    setMonth(new Date())
  }, [])

  useEffect(() => saveShifts(shifts), [shifts])
  useEffect(() => syncCalendarWidget(shifts), [shifts])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveChat(messages), [messages])

  const updateDay = useCallback(
    (date: Date, nextShifts: Shift[]) => {
      const key = format(date, 'yyyy-MM-dd')
      setShifts((prev) => {
        const next = { ...prev }
        if (nextShifts.length === 0) {
          delete next[key]
        } else {
          next[key] = nextShifts
        }
        return next
      })
    },
    [],
  )

  const handleSend = useCallback(
    async (text: string, images: string[]) => {
      setError(null)
      const userMessage: ChatMessage = {
        role: 'user',
        content: text,
        images: images.length > 0 ? images : undefined,
      }
      const history = [...messages, userMessage]
      setMessages(history)
      setLoading(true)

      try {
        const context = buildContextMessage(
          format(month, 'yyyy年M月'),
          format(today, 'yyyy-MM-dd'),
          shifts,
          month.getFullYear(),
          month.getMonth() + 1,
        )
        const cleanHistory = history.slice(-12).map(toApiMessage)
        const apiMessages: ApiMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: context },
          ...cleanHistory,
        ]

        const first = await chatCompletion(settings, apiMessages)
        let answer = first
        let result: AiResult | null = null

        try {
          result = parseAiResult(first.content)
        } catch {
          const repairMessages: ApiMessage[] = [
            ...apiMessages,
            { role: 'assistant', content: first.content || '(空回复)' },
            {
              role: 'system',
              content:
                '你上一条回复不是合法 JSON。请严格只输出一个 JSON 对象（包含 message 和 ops），不要输出解释文字或 Markdown 代码块。',
            },
          ]
          answer = await chatCompletion(settings, repairMessages)
          try {
            result = parseAiResult(answer.content)
          } catch {
            const fallbackText = first.content.trim()
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content:
                  fallbackText ||
                  '抱歉，这次回复没能整理成排班数据。请换种说法，或补充具体日期和时间再试一次。',
                reasoning: first.reasoning,
              },
            ])
            return
          }
        }

        if (!result) return

        if (result.ops.length > 0) {
          setShifts((prev) => applyOps(prev, result.ops))
        }
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: result.message, reasoning: answer.reasoning },
        ])
      } catch (err) {
        const message = err instanceof Error ? err.message : '请求失败，请重试'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [messages, month, settings, shifts, today],
  )

  const clearHistory = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const selectedShifts = selectedDay ? shifts[format(selectedDay, 'yyyy-MM-dd')] ?? [] : []

  return (
    <div className="app">
      <main className="app-main">
        <Calendar
          month={month}
          shifts={shifts}
          today={today}
          onShiftMonth={shiftMonth}
          onGoToday={goToday}
          onSelectDay={setSelectedDay}
        />
      </main>

      <button className="fab" onClick={() => openOverlay('chat')}>
        AI 排班
      </button>

      {selectedDay && (
        <DayEditor
          date={selectedDay}
          shifts={selectedShifts}
          onClose={() => setSelectedDay(null)}
          onChange={(next) => updateDay(selectedDay, next)}
        />
      )}

      {chatOpen && (
        <ChatPanel
          messages={messages}
          loading={loading}
          error={error}
          hasApiKey={settings.apiKey.trim().length > 0}
          onSend={handleSend}
          onClose={() => closeOverlay('chat')}
          onOpenSettings={() => openOverlay('settings')}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => closeOverlay('settings')}
          onSave={setSettings}
          onClearHistory={clearHistory}
        />
      )}
    </div>
  )
}
