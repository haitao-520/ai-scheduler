import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { DayShifts, Shift } from '../types'
import { colorForShift } from '../lib/colors'

interface CalendarProps {
  month: Date
  shifts: DayShifts
  today: Date
  onShiftMonth: (delta: number) => void
  onGoToday: () => void
  onSelectDay: (date: Date) => void
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const SWIPE_THRESHOLD = 46
const AXIS_LOCK = 8
const REVEAL_DISTANCE = 150
const SNAP_MS = 280

function chipStyle(shift: Shift): CSSProperties {
  const { bg, fg } = colorForShift(shift)
  return { backgroundColor: bg, color: fg }
}

type CommitDir = -1 | 0 | 1

function buildDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  return eachDayOfInterval({ start, end })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function Calendar({ month, shifts, today, onShiftMonth, onGoToday, onSelectDay }: CalendarProps) {
  const prevMonth = useMemo(() => addMonths(month, -1), [month])
  const nextMonth = useMemo(() => addMonths(month, 1), [month])
  const prevDays = useMemo(() => buildDays(prevMonth), [prevMonth])
  const currentDays = useMemo(() => buildDays(month), [month])
  const nextDays = useMemo(() => buildDays(nextMonth), [nextMonth])

  const [reveal, setReveal] = useState(0)
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [commit, setCommit] = useState<CommitDir>(0)
  const [animating, setAnimating] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef(0)
  const animatingRef = useRef(false)
  const startRef = useRef<{ x: number; y: number; reveal: number } | null>(null)
  const axisRef = useRef<'x' | 'y' | null>(null)
  const swipedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const startCommit = useCallback(
    (dir: CommitDir) => {
      setCommit(dir)
      setAnimating(true)
      animatingRef.current = true
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        if (dir !== 0) onShiftMonth(dir)
        setCommit(0)
        setDragPx(0)
        setAnimating(false)
        animatingRef.current = false
        timerRef.current = null
      }, SNAP_MS)
    },
    [onShiftMonth],
  )

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--reveal', String(reveal))
    root.classList.toggle('reveal-active', reveal > 0.1)
    return () => {
      root.style.removeProperty('--reveal')
      root.classList.remove('reveal-active')
    }
  }, [reveal])

  useEffect(() => {
    const host = (rootRef.current?.closest('.app-main') as HTMLElement | null) ?? rootRef.current
    if (!host) return

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const onDown = (event: PointerEvent) => {
      if (animatingRef.current) return
      startRef.current = { x: event.clientX, y: event.clientY, reveal: revealRef.current }
      axisRef.current = null
      swipedRef.current = false
      setDragging(false)
    }

    const onMove = (event: PointerEvent) => {
      const start = startRef.current
      if (!start) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y

      if (axisRef.current === null) {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        setDragging(true)
      }

      if (axisRef.current === 'x') {
        setDragPx(dx)
      } else {
        const next = clamp(start.reveal + dy / REVEAL_DISTANCE, 0, 1)
        revealRef.current = next
        setReveal(next)
      }
    }

    const onUp = (event: PointerEvent) => {
      const start = startRef.current
      const axis = axisRef.current
      startRef.current = null
      axisRef.current = null
      setDragging(false)

      if (!start) return

      if (axis === 'x') {
        swipedRef.current = true
        const delta = event.clientX - start.x
        if (delta <= -SWIPE_THRESHOLD) {
          startCommit(1)
        } else if (delta >= SWIPE_THRESHOLD) {
          startCommit(-1)
        } else {
          setAnimating(true)
          animatingRef.current = true
          setDragPx(0)
          clearTimer()
          timerRef.current = window.setTimeout(() => {
            setAnimating(false)
            animatingRef.current = false
            timerRef.current = null
          }, SNAP_MS)
        }
      } else if (axis === 'y') {
        const target = revealRef.current > 0.5 ? 1 : 0
        revealRef.current = target
        setReveal(target)
      }
    }

    host.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      host.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      clearTimer()
    }
  }, [startCommit])

  const handleDayClick = (day: Date) => {
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    onSelectDay(day)
  }

  const activate = (action: () => void) => {
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    action()
  }

  const renderPanel = (panelMonth: Date, days: Date[]) => (
    <div className="month-panel">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd')
        const dayShifts = shifts[key] ?? []
        const inMonth = isSameMonth(day, panelMonth)
        const isToday = isSameDay(day, today)
        const workShift = dayShifts.find((shift) => shift.start && shift.end)
        const summary: { label: string; work: boolean } | null =
          dayShifts.length === 0
            ? null
            : workShift
              ? { label: '上班', work: true }
              : { label: dayShifts[0].name, work: false }
        const timedShifts = dayShifts.filter((shift) => shift.start && shift.end)

        return (
          <button
            key={key}
            className={[
              'day-cell',
              inMonth ? '' : 'outside',
              isToday ? 'today' : '',
              dayShifts.length > 0 ? 'has-shift' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleDayClick(day)}
          >
            <span className="day-number">{format(day, 'd')}</span>
            <span className="shift-list">
              {summary && (
                <span className={`day-compact ${summary.work ? 'work' : 'rest'}`}>
                  {summary.label}
                </span>
              )}
              {timedShifts.length > 0 && (
                <span className="chip-details">
                  {timedShifts.slice(0, 3).map((shift) => (
                    <span
                      key={shift.id}
                      className="shift-chip"
                      style={chipStyle(shift)}
                    >
                      <span className="chip-start">{shift.start}</span>
                      <span className="chip-end">{shift.end}</span>
                    </span>
                  ))}
                  {timedShifts.length > 3 && (
                    <span className="shift-more">+{timedShifts.length - 3}</span>
                  )}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )

  const trackTransform =
    commit === 1
      ? 'translateX(-66.6667%)'
      : commit === -1
        ? 'translateX(0%)'
        : `translateX(calc(-33.3333% + ${dragPx}px))`

  return (
    <div
      ref={rootRef}
      className={`calendar ${dragging ? 'dragging' : ''} ${reveal > 0 ? 'revealed' : ''}`}
      style={{ '--reveal': reveal } as CSSProperties}
    >
      <div className="month-bar">
        <button className="month-title" onClick={() => activate(onGoToday)}>
          <span key={format(month, 'yyyy-MM')} className="month-label">
            {format(month, 'yyyy年M月')}
          </span>
        </button>
      </div>

      <div className="weekday-row">
        {WEEKDAYS.map((day, index) => (
          <div key={day} className={`weekday ${index === 0 || index === 6 ? 'weekend' : ''}`}>
            {day}
          </div>
        ))}
      </div>

      <div className="days-viewport">
        <div
          className="month-track"
          style={{
            transform: trackTransform,
            transition: animating ? `transform ${SNAP_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : 'none',
          }}
        >
          {renderPanel(prevMonth, prevDays)}
          {renderPanel(month, currentDays)}
          {renderPanel(nextMonth, nextDays)}
        </div>
      </div>
    </div>
  )
}
