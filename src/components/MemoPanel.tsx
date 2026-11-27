import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { Memo } from '../types'

interface MemoPanelProps {
  memos: Memo[]
  onChange: (memos: Memo[]) => void
  onClose: () => void
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function memoItemStyle(memo: Memo): CSSProperties {
  return memo.done
    ? { background: '#f6f7fb', color: 'var(--muted)' }
    : { background: '#eef0ff', color: '#3a3f63' }
}

export function MemoPanel({ memos, onChange, onClose }: MemoPanelProps) {
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const didScrollRef = useRef(false)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTo({
      top: list.scrollHeight,
      behavior: didScrollRef.current ? 'smooth' : 'auto',
    })
    didScrollRef.current = true
  }, [memos.length])

  const addMemo = () => {
    const value = text.trim()
    if (!value) return
    onChange([
      ...memos,
      { id: makeId(), text: value, createdAt: Date.now(), done: false, widget: true },
    ])
    setText('')
  }

  const toggleDone = (id: string) => {
    onChange(
      memos.map((memo) => (memo.id === id ? { ...memo, done: !memo.done } : memo)),
    )
  }

  const toggleWidget = (id: string) => {
    onChange(
      memos.map((memo) =>
        memo.id === id ? { ...memo, widget: memo.widget === false } : memo,
      ),
    )
  }

  const removeMemo = (id: string) => {
    onChange(memos.filter((memo) => memo.id !== id))
    if (editingId === id) {
      setEditingId(null)
      setEditingText('')
    }
  }

  const startEdit = (memo: Memo) => {
    setEditingId(memo.id)
    setEditingText(memo.text)
  }

  const commitEdit = () => {
    const value = editingText.trim()
    if (editingId === null) return
    if (!value) {
      removeMemo(editingId)
      return
    }
    onChange(
      memos.map((memo) => (memo.id === editingId ? { ...memo, text: value } : memo)),
    )
    setEditingId(null)
    setEditingText('')
  }


  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">备忘录</h2>

        <div className="memo-list" ref={listRef}>
          {memos.length === 0 ? (
            <p className="empty-hint">还没有备忘，写下第一件事吧</p>
          ) : (
            memos.map((memo) => (
              <div key={memo.id} className="memo-item">
                <button
                  className={`memo-check ${memo.done ? 'checked' : ''}`}
                  onClick={() => toggleDone(memo.id)}
                  aria-label={memo.done ? '标记为未完成' : '标记为已完成'}
                >
                  {memo.done ? '✓' : ''}
                </button>
                <div className="memo-body">
                  {editingId === memo.id ? (
                    <input
                      className="text-input memo-edit-input"
                      value={editingText}
                      autoFocus
                      onChange={(event) => setEditingText(event.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitEdit()
                        if (event.key === 'Escape') {
                          setEditingId(null)
                          setEditingText('')
                        }
                      }}
                    />
                  ) : (
                    <>
                      <div
                        className="memo-text"
                        style={memoItemStyle(memo)}
                        onClick={() => startEdit(memo)}
                      >
                        {memo.text}
                      </div>
                      <div className="memo-meta-row">
                        <span className="memo-meta">
                          {format(memo.createdAt, 'M月d日 HH:mm')}
                        </span>
                        <label className="memo-widget-toggle">
                          <input
                            type="checkbox"
                            checked={memo.widget !== false}
                            onChange={() => toggleWidget(memo.id)}
                          />
                          <span>小部件</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
                <button
                  className="text-btn danger"
                  onClick={() => removeMemo(memo.id)}
                >
                  删除
                </button>
              </div>
            ))
          )}
        </div>

        <div className="add-form">
          <div className="time-row">
            <input
              className="text-input"
              placeholder="添加一条备忘，例如：带钥匙"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addMemo()
              }}
            />
            <button className="primary-btn" onClick={addMemo} disabled={!text.trim()}>
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
