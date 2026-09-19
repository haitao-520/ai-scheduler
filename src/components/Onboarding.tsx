import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

interface OnboardingProps {
  onFinish: () => void
  onOpenChat: () => void
}

interface Step {
  selector: string
  title: string
  desc: string
  openChat?: boolean
  swipe?: boolean
  holeRatio?: number
  cardOffsetY?: number
}

const STEPS: Step[] = [
  {
    selector: '.days-viewport',
    title: '向下滑动，看具体时间',
    desc: '在日历上向下滑动，就能展开每一天的具体上班时间。',
    swipe: true,
    holeRatio: 0.44,
  },
  {
    selector: '.fab',
    title: '让 AI 帮你排班',
    desc: '点右下角【AI 排班】，用一句话告诉我你的班次，我会自动排进日历。',
    cardOffsetY: -38,
  },
  {
    selector: '.settings-link',
    title: '进入设置',
    desc: '在对话框右上角点【设置】，填入 DeepSeek API Key 就能开始使用。',
    openChat: true,
  },
]

const HOLE_PAD = 6
const CARD_HEIGHT = 172

interface Hole {
  left: number
  top: number
  width: number
  height: number
}

export function Onboarding({ onFinish, onOpenChat }: OnboardingProps) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = STEPS[index]

  useEffect(() => {
    if (step.openChat) onOpenChat()
    setRect(null)
    let cancelled = false
    const timer = window.setTimeout(
      () => {
        if (cancelled) return
        const el = document.querySelector(step.selector)
        setRect(el ? el.getBoundingClientRect() : null)
      },
      step.openChat ? 380 : 40,
    )
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [index, step, onOpenChat])

  const hole = useMemo<Hole | null>(() => {
    if (!rect) return null
    const height = step.holeRatio ? rect.height * step.holeRatio : rect.height
    return {
      left: rect.left - HOLE_PAD,
      top: rect.top - HOLE_PAD,
      width: rect.width + HOLE_PAD * 2,
      height: height + HOLE_PAD,
    }
  }, [rect, step])

  const next = () => {
    if (index < STEPS.length - 1) setIndex((value) => value + 1)
    else onFinish()
  }

  const cardStyle: CSSProperties = (() => {
    if (!hole) return { top: '50%', transform: 'translate(-50%, -50%)' }
    const vh = window.innerHeight
    const offset = step.cardOffsetY ?? 0
    const bottom = hole.top + hole.height
    if (bottom + 16 + CARD_HEIGHT < vh) return { top: bottom + 16 + offset }
    if (hole.top - 16 - CARD_HEIGHT + offset > 0) return { top: hole.top - 16 - CARD_HEIGHT + offset }
    return { bottom: 'calc(24px + env(safe-area-inset-bottom))' }
  })()

  return (
    <div className="onboarding" role="dialog" aria-modal="true">
      {hole ? (
        <div
          className="onboarding-hole"
          style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }}
        >
          {step.swipe && (
            <div className="onboarding-swipe" aria-hidden="true">
              <span className="onboarding-swipe-finger" />
              <span className="onboarding-swipe-chevron" />
              <span className="onboarding-swipe-chevron" />
            </div>
          )}
        </div>
      ) : (
        <div className="onboarding-veil" />
      )}

      <div className="onboarding-card" style={cardStyle}>
        <span className="onboarding-step">
          {index + 1} / {STEPS.length}
        </span>
        <h3 className="onboarding-title">{step.title}</h3>
        <p className="onboarding-desc">{step.desc}</p>
        <div className="onboarding-actions">
          <button className="onboarding-skip" onClick={onFinish}>
            跳过
          </button>
          <button className="onboarding-next" onClick={next}>
            {index === STEPS.length - 1 ? '开始使用' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  )
}
