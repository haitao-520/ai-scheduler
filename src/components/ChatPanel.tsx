import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'
import { fileToCompressedDataUrl } from '../lib/image'

interface ChatPanelProps {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  onSend: (text: string, images: string[]) => void
  onClose: () => void
  onOpenSettings: () => void
  hasApiKey: boolean
}

const SUGGESTIONS = ['这个月每天早班', '下周一 3 号休息', '本周五到周日上晚班']
const MAX_IMAGES = 4

export function ChatPanel({
  messages,
  loading,
  error,
  onSend,
  onClose,
  onOpenSettings,
  hasApiKey,
}: ChatPanelProps) {
  const [text, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [pickError, setPickError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const send = (value: string) => {
    const trimmed = value.trim()
    if (loading) return
    if (!trimmed && images.length === 0) return
    onSend(trimmed, images)
    setText('')
    setImages([])
    setPickError(null)
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setPickError(null)
    const room = MAX_IMAGES - images.length
    if (room <= 0) {
      setPickError(`最多上传 ${MAX_IMAGES} 张图片`)
      return
    }
    const picked = Array.from(files).slice(0, room)
    const next: string[] = []
    for (const file of picked) {
      try {
        next.push(await fileToCompressedDataUrl(file))
      } catch {
        setPickError('图片读取失败，请重试')
      }
    }
    if (next.length > 0) setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES))
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="sheet-backdrop chat-backdrop" onClick={onClose}>
      <div className="chat-panel" onClick={(event) => event.stopPropagation()}>
        <div className="chat-header">
          <span className="chat-title">AI 排班助手</span>
          <div className="chat-header-actions">
            <button className="text-btn settings-link" onClick={onOpenSettings}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              设置
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="关闭">
              ×
            </button>
          </div>
        </div>

        <div className="chat-list" ref={listRef}>
          {messages.length === 0 && (
            <div className="chat-intro">
              <p>用一句话告诉我你的班次，我会自动帮你排进日历。比如：</p>
              <div className="suggestions">
                {SUGGESTIONS.map((item) => (
                  <button key={item} className="suggestion" onClick={() => send(item)}>
                    {item}
                  </button>
                ))}
              </div>
              <p className="chat-intro-hint">也可以发一张排班表截图，我来识别。</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={index} className={`bubble-row ${message.role}`}>
              <div className="bubble-stack">
                {message.role === 'assistant' && message.reasoning && (
                  <details className="reasoning">
                    <summary>已深度思考</summary>
                    <div className="reasoning-text">{message.reasoning}</div>
                  </details>
                )}
                {message.role === 'user' && message.images && message.images.length > 0 && (
                  <div className="bubble-images">
                    {message.images.map((src, i) => (
                      <img key={i} src={src} alt="上传图片" onClick={() => window.open(src, '_blank')} />
                    ))}
                  </div>
                )}
                {message.content && <div className={`bubble ${message.role}`}>{message.content}</div>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="bubble-row assistant">
              <div className="bubble-stack">
                <div className="bubble assistant typing">正在深度思考并排班…</div>
              </div>
            </div>
          )}
        </div>

        {!hasApiKey && (
          <button className="api-warning" onClick={onOpenSettings}>
            尚未配置 DeepSeek API Key，点此设置
          </button>
        )}
        {error && <div className="chat-error">{error}</div>}
        {pickError && <div className="chat-error">{pickError}</div>}

        {images.length > 0 && (
          <div className="chat-previews">
            {images.map((src, index) => (
              <div key={index} className="chat-preview">
                <img src={src} alt="待发送图片" />
                <button className="preview-remove" onClick={() => removeImage(index)} aria-label="移除图片">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-input-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              void handleFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <button
            className="icon-btn attach-btn"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            aria-label="上传图片"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
          <input
            className="text-input"
            placeholder="例如：这个月每天都上早班"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') send(text)
            }}
          />
          <button className="primary-btn send-btn" onClick={() => send(text)} disabled={loading}>
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
