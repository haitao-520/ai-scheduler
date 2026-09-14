import { useCallback, useEffect, useRef } from 'react'

const ITEM_HEIGHT = 34
const SETTLE_MS = 120

interface WheelProps {
  options: string[]
  value: string
  onChange: (value: string) => void
}

function Wheel({ options, value, onChange }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const settleRef = useRef<number | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const scrollToIndex = useCallback((index: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const index = options.indexOf(value)
    if (index < 0) return
    const el = ref.current
    if (!el) return
    if (Math.abs(el.scrollTop - index * ITEM_HEIGHT) > 1) {
      scrollToIndex(index)
    }
  }, [value, options, scrollToIndex])

  useEffect(
    () => () => {
      if (settleRef.current !== null) window.clearTimeout(settleRef.current)
    },
    [],
  )

  const handleScroll = () => {
    if (settleRef.current !== null) window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const raw = Math.round(el.scrollTop / ITEM_HEIGHT)
      const index = Math.min(options.length - 1, Math.max(0, raw))
      const next = options[index]
      if (next !== valueRef.current) onChange(next)
    }, SETTLE_MS)
  }

  return (
    <div className="wheel" ref={ref} onScroll={handleScroll}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`wheel-item ${option === value ? 'active' : ''}`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

interface TimeWheelProps {
  value: string
  onChange: (value: string) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

export function TimeWheel({ value, onChange }: TimeWheelProps) {
  const hour = value.slice(0, 2)
  const minute = value.slice(3, 5)

  return (
    <div className="time-wheel-pair">
      <Wheel options={HOURS} value={hour} onChange={(next) => onChange(`${next}:${minute}`)} />
      <span className="time-colon">:</span>
      <Wheel options={MINUTES} value={minute} onChange={(next) => onChange(`${hour}:${next}`)} />
    </div>
  )
}
