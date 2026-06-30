import React, { useEffect } from 'react'
import { analyzeCustomSections } from '../../utils/cropMath'

export default function CustomSections({
  bounds,
  sections,
  setSections,
  selectedId,
  setSelectedId,
  snapEnabled,
  setSnapEnabled,
  snapPx,
  setSnapPx,
  onResult,
}) {
  const analysis = analyzeCustomSections(sections, bounds.w, bounds.h)

  useEffect(() => {
    const cells = sections.map((s, i) => ({ index: i + 1, ...s }))
    onResult({ cells, analysis })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, bounds.w, bounds.h])

  function update(id, patch) {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }
  function remove(id) {
    setSections(sections.filter((s) => s.id !== id))
    if (selectedId === id) setSelectedId(null)
  }
  function duplicate(id) {
    const s = sections.find((x) => x.id === id)
    if (!s) return
    const off = Math.min(20, bounds.w * 0.02)
    const id2 = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setSections([...sections, { ...s, id: id2, x: Math.min(bounds.w - s.w, s.x + off), y: Math.min(bounds.h - s.h, s.y + off) }])
    setSelectedId(id2)
  }
  function addBlank() {
    const w = Math.round(bounds.w * 0.3)
    const h = Math.round(bounds.h * 0.3)
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setSections([...sections, { id, x: 0, y: 0, w, h }])
    setSelectedId(id)
  }

  // Backspace/Delete removes the currently selected section — but only when
  // focus isn't inside a text input (so editing the X/Y/W/H fields, which
  // also use Backspace, isn't affected).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      if (!selectedId) return

      const tag = e.target.tagName
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        e.target.isContentEditable

      if (isEditable) return

      e.preventDefault()
      remove(selectedId)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, sections])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 12, color: 'var(--slate-500)', lineHeight: 1.5, margin: 0 }}>
        Click and drag directly on the image to draw a section. Drag again to add more —
        sections snap to each other's edges and the image border. Select a section and press
        Backspace to delete it.
      </p>

      <button className="btn btn-ghost" onClick={addBlank}>
        + Add Section
      </button>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
        Snap to edges
        {snapEnabled && (
          <input
            type="number"
            className="numfield"
            value={snapPx}
            min={1}
            max={40}
            onChange={(e) => setSnapPx(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{ width: 56, marginLeft: 'auto' }}
          />
        )}
      </label>

      {sections.length === 0 ? (
        <div className="status-line status-warn">No sections yet — draw one on the canvas.</div>
      ) : (
        <>
          {analysis.overlappingIds.size > 0 && (
            <div className="status-line status-warn">⚠ {analysis.overlappingIds.size} section(s) overlap</div>
          )}
          {analysis.hasGaps && (
            <div className="status-line status-warn">
              ⚠ Coverage {analysis.coveragePct.toFixed(0)}% — gaps in the image aren't covered
            </div>
          )}
          {analysis.overlappingIds.size === 0 && !analysis.hasGaps && (
            <div className="status-line status-ok">✓ Full coverage, no overlaps</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }} className="scrollbar-thin">
            {sections.map((s, i) => (
              <div
                key={s.id}
                className="card"
                onClick={() => setSelectedId(s.id)}
                style={{
                  padding: 10,
                  cursor: 'pointer',
                  borderColor: selectedId === s.id ? 'var(--blue-500)' : 'var(--line-200)',
                  background: analysis.overlappingIds.has(s.id) ? 'var(--amber-100)' : 'var(--paper-50)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-900)' }}>
                    section_{i + 1}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon" style={{ fontSize: 11, padding: '3px 7px' }} onClick={(e) => { e.stopPropagation(); duplicate(s.id) }}>
                      duplicate
                    </button>
                    <button className="btn btn-ghost btn-icon" style={{ fontSize: 11, padding: '3px 7px' }} onClick={(e) => { e.stopPropagation(); remove(s.id) }}>
                      delete
                    </button>
                  </div>
                </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                    }}
                  >
                    <MiniField label="X" value={s.x} onChange={(v) => update(s.id, { x: v })} />
                    <MiniField label="Y" value={s.y} onChange={(v) => update(s.id, { y: v })} />
                    <MiniField label="W" value={s.w} onChange={(v) => update(s.id, { w: v })} />
                    <MiniField label="H" value={s.h} onChange={(v) => update(s.id, { h: v })} />
                  </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MiniField({ label, value, onChange }) {
  const [text, setText] = React.useState(String(Math.round(value)))

  React.useEffect(() => {
    setText(String(Math.round(value)))
  }, [value])

  return (
    <div>
      <div className="label-eyebrow" style={{ fontSize: 9 }}>
        {label}
      </div>

      <input
        type="number"
        className="numfield"
        value={text}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const input = e.target.value
          setText(input)

          const v = parseFloat(input)
          if (Number.isFinite(v)) {
            onChange(v)
          }
        }}
        onBlur={() => {
          if (text === '') {
            setText(String(Math.round(value)))
          }
        }}
        style={{ padding: '5px 6px', fontSize: 11 }}
      />
    </div>
  )
}