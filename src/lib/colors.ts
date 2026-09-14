import type { Shift } from '../types'

export interface ShiftColor {
  bg: string
  fg: string
}

const WORK: ShiftColor = { bg: '#ECF5FF', fg: '#409EFF' }
const REST: ShiftColor = { bg: '#F4F4F5', fg: '#909399' }
const MORNING: ShiftColor = { bg: '#FDF6EC', fg: '#E6A23C' }
const NOON: ShiftColor = { bg: '#E6F7F2', fg: '#1ABC9C' }
const EVENING: ShiftColor = { bg: '#F0EAFE', fg: '#8E44AD' }
const NIGHT: ShiftColor = { bg: '#D5DBEB', fg: '#2C3E50' }

const PALETTE: ShiftColor[] = [WORK, MORNING, NOON, EVENING, NIGHT, REST]

const KNOWN: Record<string, ShiftColor> = {
  上班: WORK,
  休息: REST,
  早班: MORNING,
  中班: NOON,
  晚班: EVENING,
  夜班: NIGHT,
  白班: WORK,
}

export type ShiftPeriod = '早' | '中' | '晚' | '夜'

const PERIOD_COLORS: Record<ShiftPeriod, ShiftColor> = {
  早: MORNING,
  中: NOON,
  晚: EVENING,
  夜: NIGHT,
}

interface PeriodRange {
  period: ShiftPeriod
  start: number
  end: number
}

const MINUTES_PER_DAY = 24 * 60

const PERIOD_RANGES: PeriodRange[] = [
  { period: '早', start: 8 * 60, end: 12 * 60 + 40 },
  { period: '中', start: 12 * 60 + 40, end: 17 * 60 + 20 },
  { period: '晚', start: 17 * 60 + 20, end: 22 * 60 },
  { period: '夜', start: 22 * 60, end: 8 * 60 },
]

function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function toSegments(start: number, end: number): Array<[number, number]> {
  if (start < end) return [[start, end]]
  if (start > end) return [[start, MINUTES_PER_DAY], [0, end]]
  return [[0, MINUTES_PER_DAY]]
}

function overlap(a: [number, number], b: [number, number]): number {
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]))
}

export function periodForTime(start?: string, end?: string): ShiftPeriod | null {
  if (!start) return null
  const from = toMinutes(start)
  if (from === null) return null
  const to = end ? toMinutes(end) : null

  const shiftSegments = to === null || to === from ? [] : toSegments(from, to)

  if (shiftSegments.length === 0) {
    const match = PERIOD_RANGES.find((range) => toSegments(range.start, range.end).some((seg) => overlap(seg, [from, from + 1]) > 0))
    return match?.period ?? '夜'
  }

  let best: ShiftPeriod = '夜'
  let bestOverlap = -1
  for (const range of PERIOD_RANGES) {
    const rangeSegments = toSegments(range.start, range.end)
    let total = 0
    for (const seg of shiftSegments) {
      for (const rangeSeg of rangeSegments) {
        total += overlap(seg, rangeSeg)
      }
    }
    if (total > bestOverlap) {
      bestOverlap = total
      best = range.period
    }
  }
  return best
}

export function colorFor(name: string): ShiftColor {
  if (KNOWN[name]) return KNOWN[name]
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export function colorForShift(shift: Pick<Shift, 'name' | 'start' | 'end'>): ShiftColor {
  const period = periodForTime(shift.start, shift.end)
  if (period) return PERIOD_COLORS[period]
  return colorFor(shift.name)
}
