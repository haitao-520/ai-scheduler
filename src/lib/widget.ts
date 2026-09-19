import { Capacitor, registerPlugin } from '@capacitor/core'
import type { DayShifts } from '../types'
import { sortShifts } from './shift'

interface CalendarWidgetPlugin {
  save(options: { data: string }): Promise<void>
  getStatus(): Promise<{ status: string }>
}

const CalendarWidget = registerPlugin<CalendarWidgetPlugin>('CalendarWidget')

export function buildShiftsPayload(shifts: DayShifts): string {
  const payload: Record<string, Array<{ name: string; start?: string; end?: string }>> = {}
  for (const [date, list] of Object.entries(shifts)) {
    payload[date] = sortShifts(list).map((shift) => ({ name: shift.name, start: shift.start, end: shift.end }))
  }
  return JSON.stringify({ shifts: payload })
}

export function syncCalendarWidget(shifts: DayShifts): void {
  if (!Capacitor.isNativePlatform()) return
  CalendarWidget.save({ data: buildShiftsPayload(shifts) }).catch(() => {
    // 小部件同步失败不影响主流程
  })
}

export async function getWidgetStatus(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const result = await CalendarWidget.getStatus()
    return result.status || ''
  } catch {
    return ''
  }
}
