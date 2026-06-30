import React, { useEffect, useState } from 'react'
import { computeEqualSplit } from '../../utils/cropMath'

export default function EqualSplit({
  bounds,
  inputMode = 'count',
  setInputMode = () => {},
  cols = 2,
  setCols = () => {},
  rows = 2,
  setRows = () => {},
  colPx = Math.round(bounds.w / 2),
  setColPx = () => {},
  rowPx = Math.round(bounds.h / 2),
  setRowPx = () => {},
  noRound = false,
  setNoRound = () => {},
  onResult,
}) {
  useEffect(() => {
    const params =
      inputMode === 'count'
        ? { mode: 'count', cols, rows }
        : { mode: 'px', colPx, rowPx, noRound }
    const result = computeEqualSplit(bounds.w, bounds.h, params)
    onResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode, cols, rows, colPx, rowPx, noRound, bounds.w, bounds.h])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="unit-toggle" style={{ alignSelf: 'flex-start' }}>
        <button className={inputMode === 'count' ? 'active' : ''} onClick={() => setInputMode('count')}>
          BY COUNT
        </button>
        <button className={inputMode === 'px' ? 'active' : ''} onClick={() => setInputMode('px')}>
          BY PX
        </button>
      </div>

      {inputMode === 'count' ? (
        <>
          <Stepper label="Columns" value={cols} min={1} max={100} onChange={setCols} />
          <Stepper label="Rows" value={rows} min={1} max={100} onChange={setRows} />
        </>
      ) : (
        <>
          <Stepper label="Column width (px)" value={colPx} min={1} max={bounds.w} onChange={setColPx} />
          <Stepper label="Row height (px)" value={rowPx} min={1} max={bounds.h} onChange={setRowPx} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={noRound}
              onChange={(e) => setNoRound(e.target.checked)}
            />
            Don't round off to fit
          </label>
        </>
      )}

      <p style={{ fontSize: 12, color: 'var(--slate-500)', lineHeight: 1.5, margin: 0 }}>
        {inputMode === 'px' && noRound
          ? "Cells keep your exact width/height. Leftover pixels at the right and bottom edges stay as their own smaller cells instead of being merged or rounded."
          : "Divides the image into a uniform grid. If it doesn't divide evenly, the extra pixels are added to the last column/row — nothing is lost."}
      </p>
    </div>
  )
}

function Stepper({ label, value, min, max, onChange }) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="label-eyebrow">{label}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>

        <input
          type="number"
          className="numfield"
          value={text}
          min={min}
          max={max}
          onChange={(e) => {
            const input = e.target.value
            setText(input)

            const v = parseInt(input, 10)
            if (Number.isFinite(v)) {
              onChange(Math.min(max, Math.max(min, v)))
            }
          }}
          onBlur={() => {
            if (text === '') {
              setText(String(value))
            }
          }}
          style={{ textAlign: 'center' }}
        />

        <button
          className="btn btn-ghost btn-icon"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  )
}