import React, { useEffect, useState } from 'react'
import { computeGridLayout } from '../../utils/cropMath'

let uid = 0
const nextId = () => `t${uid++}`

function defaultTracks(total) {
  return [
    { id: nextId(), value: Math.round(total / 2), unit: 'px' },
    { id: nextId(), value: Math.round(total / 2), unit: 'px' },
  ]
}

export default function GridLayout({
  bounds,
  cols,
  setCols,
  rows,
  setRows,
  onResult,
}) {
  // Fallback local state only used if parent doesn't pass cols/rows down
  // (keeps the component usable standalone, but the parent should lift this
  // state the same way it does for EqualSplit so values persist across mode switches).
  const [localCols, setLocalCols] = useState(() => defaultTracks(bounds.w))
  const [localRows, setLocalRows] = useState(() => defaultTracks(bounds.h))

  const colsVal = cols ?? localCols
  const rowsVal = rows ?? localRows
  const setColsVal = setCols ?? setLocalCols
  const setRowsVal = setRows ?? setLocalRows

  useEffect(() => {
    const { cells, colRes, rowRes } = computeGridLayout(bounds.w, bounds.h, colsVal, rowsVal)
    onResult({ cells, colRes, rowRes })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colsVal, rowsVal, bounds.w, bounds.h])

  function addTrack(setter) {
    setter((t) => [...t, { id: nextId(), value: 1, unit: 'fr' }])
  }
  function removeTrack(setter, id) {
    setter((t) => (t.length > 1 ? t.filter((x) => x.id !== id) : t))
  }
  function updateTrack(setter, id, patch) {
    setter((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  const { colRes, rowRes } = computeGridLayout(bounds.w, bounds.h, colsVal, rowsVal)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TrackAxis
        title="Columns"
        tracks={colsVal}
        total={bounds.w}
        res={colRes}
        onAdd={() => addTrack(setColsVal)}
        onRemove={(id) => removeTrack(setColsVal, id)}
        onUpdate={(id, patch) => updateTrack(setColsVal, id, patch)}
      />
      <TrackAxis
        title="Rows"
        tracks={rowsVal}
        total={bounds.h}
        res={rowRes}
        onAdd={() => addTrack(setRowsVal)}
        onRemove={(id) => removeTrack(setRowsVal, id)}
        onUpdate={(id, patch) => updateTrack(setRowsVal, id, patch)}
      />

      <p style={{ fontSize: 12, color: 'var(--slate-500)', lineHeight: 1.5, margin: 0 }}>
        Note: px stays a fixed size, while ratio shares the remaining space proportionally.
      </p>
    </div>
  )
}

function TrackAxis({ title, tracks, total, res, onAdd, onRemove, onUpdate }) {
  const diff = res.overflow
  const ok = diff === 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="label-eyebrow">{title}</span>
        <button className="btn btn-ghost btn-icon" onClick={onAdd} style={{ fontSize: 12, padding: '4px 8px' }}>
          + Add {title === 'Columns' ? 'column' : 'row'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tracks.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <TrackInput
              track={t}
              onUpdate={(value) => onUpdate(t.id, { value })}
            />
            <div className="unit-toggle">
              <button className={t.unit === 'px' ? 'active' : ''} onClick={() => onUpdate(t.id, { unit: 'px' })}>
                px
              </button>
              <button className={t.unit === 'fr' ? 'active' : ''} onClick={() => onUpdate(t.id, { unit: 'fr' })}>
                ratio
              </button>
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--slate-500)', minWidth: 44 }}>
              ={res.sizes[i] ?? 0}px
            </span>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => onRemove(t.id)}
              disabled={tracks.length <= 1}
              style={{ fontSize: 14, padding: '4px 8px' }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className={`status-line ${ok ? 'status-ok' : 'status-warn'}`} style={{ marginTop: 8 }}>
        {ok ? '✓' : '⚠'} {res.sizes.join(' + ')} = {res.sumPx} / {total} px
        {!ok && (diff > 0 ? ` — exceeds image by ${diff}px` : ` — ${-diff}px short of image`)}
      </div>
    </div>
  )
}

function TrackInput({ track, onUpdate }) {
  const [text, setText] = useState(String(track.value))

  useEffect(() => {
    setText(String(track.value))
  }, [track.value])

  return (
    <input
      type="number"
      className="numfield"
      value={text}
      min={track.unit === 'px' ? 1 : 0.1}
      step={track.unit === 'px' ? 1 : 0.5}
      onChange={(e) => {
        const value = e.target.value
        setText(value)

        const v = parseFloat(value)
        if (Number.isFinite(v)) {
          onUpdate(v)
        }
      }}
      onBlur={() => {
        if (text === '') {
          setText(String(track.value))
        }
      }}
    />
  )
}