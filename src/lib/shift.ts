import type { Shift } from '../types'
import { periodForTime } from './colors'

const DEFAULT_TIMES: Record<string, [string, string]> = {
  早班: ['08:00', '12:40'],
  中班: ['12:40', '17:20'],
  晚班: ['17:20', '22:00'],
  夜班: ['22:00', '08:00'],
  白班: ['08:00', '18:00'],
  A班: ['08:00', '12:40'],
  B班: ['12:40', '17:20'],
  C班: ['22:00', '08:00'],
}

export function inferTimes(name: string): { start?: string; end?: string } {
  const key = name.replace(/\s+/g, '')
  const times = DEFAULT_TIMES[key]
  return times ? { start: times[0], end: times[1] } : {}
}

export function autoShiftName(start?: string, end?: string): string {
  const period = periodForTime(start, end)
  return period ? `${period}班` : '班次'
}

export function shiftRange(shift: Pick<Shift, 'name' | 'start' | 'end'>): string {
  return shift.start && shift.end ? `${shift.start}-${shift.end}` : shift.name
}
