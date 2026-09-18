import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ReasoningEffort, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { saveImageUrlToGallery } from '../lib/gallery'
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

export function SettingsModal({ settings, onClose, onSave, onClearHistory }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [model, setModel] = useState(settings.model)
  const [thinking, setThinking] = useState(settings.thinking)
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(settings.reasoningEffort)
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [qrState, setQrState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
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
          <input className="text-input" value={model} onChange={(event) => setModel(event.target.value)} />
        </label>

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

        <p className="field-hint">
          API Key 仅保存在本机设备中，不会上传到任何服务器。请在 DeepSeek 开放平台申请。
          发送图片识别需要选择支持视觉的模型（如 deepseek-vl 系列）。
        </p>

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
