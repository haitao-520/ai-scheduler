import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ReasoningEffort, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { saveImageUrlToGallery } from '../lib/gallery'
import { testShiftAlarm } from '../lib/notify'
import donateQr from '../assets/donate-qr.png'

interface SettingsModalProps {
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
  onClearHistory: () => void
}

const EFFORTS: Array<{ value: ReasoningEffort; label: string }> = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]

const MODEL_PRESETS = [
  { value: 'deepseek-flash', label: 'Flash 快速' },
  { value: 'deepseek-v4-pro', label: 'V4 Pro 旗舰' },
]

function normalizeMinutes(value: string): number {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_SETTINGS.reminderMinutes
  return Math.min(parsed, 720)
}

export function SettingsModal({ settings, onClose, onSave, onClearHistory }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [model, setModel] = useState(settings.model)
  const [thinking, setThinking] = useState(settings.thinking)
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(settings.reasoningEffort)
  const [remindBeforeShift, setRemindBeforeShift] = useState(settings.remindBeforeShift)
  const [reminderMinutes, setReminderMinutes] = useState(String(settings.reminderMinutes))
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [qrState, setQrState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [tested, setTested] = useState(false)
  const pressTimer = useRef<number | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)

  const clearPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    pressStart.current = null
  }

  const saveQr = async () => {
    if (qrState === 'saving') return
    setQrState('saving')
    try {
      await saveImageUrlToGallery(donateQr, 'donate-qr.png')
      setQrState('saved')
      window.setTimeout(() => setQrState('idle'), 3000)
    } catch {
      setQrState('error')
      window.setTimeout(() => setQrState('idle'), 3000)
    }
  }

  const startPress = (event: ReactPointerEvent<HTMLImageElement>) => {
    clearPress()
    pressStart.current = { x: event.clientX, y: event.clientY }
    pressTimer.current = window.setTimeout(() => {
      pressStart.current = null
      void saveQr()
    }, 500)
  }

  const movePress = (event: ReactPointerEvent<HTMLImageElement>) => {
    const start = pressStart.current
    if (!start) return
    if (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10) {
      clearPress()
    }
  }

  const handleSave = () => {
    onSave({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || DEFAULT_SETTINGS.baseUrl,
      model: model.trim() || DEFAULT_SETTINGS.model,
      thinking,
      reasoningEffort,
      remindBeforeShift,
      reminderMinutes: normalizeMinutes(reminderMinutes),
    })
    setSaved(true)
    setTimeout(onClose, 400)
  }

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setCleared(false)
      return
    }
    onClearHistory()
    setConfirmClear(false)
    setCleared(true)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">设置</h2>

        <label className="field">
          <span className="field-label">DeepSeek API Key</span>
          <input
            className="text-input"
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">接口地址</span>
          <input className="text-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">模型</span>
          <div className="segmented">
            {MODEL_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.value}
                className={`segment ${model === preset.value ? 'active' : ''}`}
                onClick={() => setModel(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            className="text-input"
            value={model}
            placeholder="deepseek-flash"
            onChange={(event) => setModel(event.target.value)}
          />
        </label>

        <p className="field-hint">
          API Key 仅保存在本机设备中，不会上传到任何服务器。请在 DeepSeek 开放平台
          platform.deepseek.com 申请。发送图片识别请使用支持视觉的 deepseek-flash 模型，deepseek-v4-pro
          不支持图片。
        </p>

        <div className="switch-row">
          <div className="switch-copy">
            <span className="field-label">深度思考模式</span>
            <span className="switch-desc">先推理再排班，更聪明但响应更慢</span>
          </div>
          <button
            className={`switch ${thinking ? 'on' : ''}`}
            onClick={() => setThinking((value) => !value)}
            aria-pressed={thinking}
            aria-label="深度思考模式"
          >
            <span className="switch-knob" />
          </button>
        </div>

        {thinking && (
          <div className="field effort-field">
            <span className="field-label">思考强度</span>
            <div className="segmented">
              {EFFORTS.map((effort) => (
                <button
                  key={effort.value}
                  className={`segment ${reasoningEffort === effort.value ? 'active' : ''}`}
                  onClick={() => setReasoningEffort(effort.value)}
                >
                  {effort.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="switch-row">
          <div className="switch-copy">
            <span className="field-label">上班提醒</span>
            <span className="switch-desc">班次开始前发送通知栏提醒</span>
          </div>
          <button
            className={`switch ${remindBeforeShift ? 'on' : ''}`}
            onClick={() => setRemindBeforeShift((value) => !value)}
            aria-pressed={remindBeforeShift}
            aria-label="上班提醒"
          >
            <span className="switch-knob" />
          </button>
        </div>

        {remindBeforeShift && (
          <>
            <label className="field">
              <span className="field-label">提前多久提醒（分钟）</span>
              <input
                className="text-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={720}
                value={reminderMinutes}
                onChange={(event) => setReminderMinutes(event.target.value)}
                onBlur={() => setReminderMinutes(String(normalizeMinutes(reminderMinutes)))}
              />
            </label>
            <button
              className="ghost-btn"
              onClick={() => {
                testShiftAlarm()
                setTested(true)
              }}
            >
              {tested ? '已发送测试通知' : '发送测试通知'}
            </button>
          </>
        )}

        <button className={`danger-btn ${confirmClear ? 'confirming' : ''}`} onClick={handleClear}>
          {cleared ? '已清除对话' : confirmClear ? '再次点击确认清除' : '清除历史对话'}
        </button>

        <button className="primary-btn" onClick={handleSave}>
          {saved ? '已保存' : '保存'}
        </button>

        <div className="donate">
          <div className="donate-title">支持作者</div>
          <p className="donate-hint">
            截图或长按保存下方二维码，打开微信扫码对作者进行打赏。
          </p>
          <img
            className="donate-qr"
            src={donateQr}
            alt="微信打赏二维码"
            draggable={false}
            onPointerDown={startPress}
            onPointerMove={movePress}
            onPointerUp={clearPress}
            onPointerLeave={clearPress}
            onPointerCancel={clearPress}
            onContextMenu={(event) => event.preventDefault()}
          />
          <p className={`donate-status ${qrState}`}>
            {qrState === 'saving'
              ? '正在保存…'
              : qrState === 'saved'
                ? '已保存到相册，打开微信扫一扫即可'
                : qrState === 'error'
                  ? '保存失败，可截图后再扫码'
                  : '长按二维码可保存到相册'}
          </p>
        </div>
      </div>
    </div>
  )
}
