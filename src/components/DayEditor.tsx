import { useState } from 'react'
import { format } from 'date-fns'
import type { Shift } from '../types'
import { colorForShift } from '../lib/colors'
import { autoShiftName } from '../lib/shift'
import { TimeWheel } from './TimeWheel'

interface DayEditorProps {
  date: Date
  shifts: Shift[]
  onClose: () => void
  onChange: (shifts: Shift[]) => void
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function DayEditor({ date, shifts, onClose, onChange }: DayEditorProps) {
  const [mode, setMode] = useState<'time' | 'rest'>('time')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('12:40')

  const previewName = mode === 'rest' ? '休息' : autoShiftName(start, end)
  const previewColor =
    mode === 'rest' ? colorForShift({ name: '休息' }) : colorForShift({ name: previewName, start, end })

  const addShift = () => {
    if (mode === 'rest') {
      const restShift: Shift = { id: makeId(), name: '休息' }
      restShift.color = colorForShift(restShift).fg
      onChange([...shifts, restShift])
      return
    }
    const nextShift: Shift = {
      id: makeId(),
      name: autoShiftName(start, end),
      start,
      end,
    }
    nextShift.color = colorForShift(nextShift).fg
    onChange([...shifts, nextShift])
  }

  const removeShift = (id: string) => {
    onChange(shifts.filter((shift) => shift.id !== id))
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">{format(date, 'yyyy年M月d日 EEEE')}</h2>

        {shifts.length === 0 ? (
          <p className="empty-hint">这一天还没有排班</p>
        ) : (
          <ul className="shift-edit-list">
            {shifts.map((shift) => (
              <li key={shift.id} className="shift-edit-item">
                <span className="dot" style={{ backgroundColor: colorForShift(shift).fg }} />
                <span className="shift-edit-name">{shift.name}</span>
                <span className="shift-edit-time">
                  {shift.start && shift.end ? `${shift.start} - ${shift.end}` : '休息'}
                </span>
                <button className="text-btn danger" onClick={() => removeShift(shift.id)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="add-form">
          <div className="segmented add-mode">
            <button
              className={`segment ${mode === 'time' ? 'active' : ''}`}
              onClick={() => setMode('time')}
            >
              时间班次
            </button>
            <button
              className={`segment ${mode === 'rest' ? 'active' : ''}`}
              onClick={() => setMode('rest')}
            >
              休息
            </button>
          </div>

          {mode === 'time' && (
            <div className="time-wheels">
              <div className="time-wheel-group">
                <span className="time-wheel-label">开始</span>
                <TimeWheel value={start} onChange={setStart} />
              </div>
              <div className="time-wheel-group">
                <span className="time-wheel-label">结束</span>
                <TimeWheel value={end} onChange={setEnd} />
              </div>
            </div>
          )}

          <div className="period-preview">
            <span className="dot" style={{ backgroundColor: previewColor.fg }} />
            <span className="period-preview-name">{previewName}</span>
          </div>
          <button className="primary-btn" onClick={addShift}>
            {mode === 'rest' ? '添加休息' : '添加时间'}
          </button>
        </div>
      </div>
    </div>
  )
}
