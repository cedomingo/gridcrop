import React from 'react'

const MODES = [
  { id: 'equal', label: 'Equal Split' },
  { id: 'grid', label: 'Grid Layout' },
  { id: 'custom', label: 'Custom Sections' },
]

export default function Sidebar({ mode, setMode, onChangePhoto, onCrop, canCrop, cropCount, children }) {
  return (
    <aside
      className="scrollbar-thin"
      style={{
        width: 'var(--sidebar-w)',
        flexShrink: 0,
        borderRight: '1px solid var(--line-200)',
        background: 'var(--paper-50)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line-200)' }}>
        <div className="label-eyebrow" style={{ marginBottom: 4 }}>CropGrid</div>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onChangePhoto}>
          ← Change Photo
        </button>
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="label-eyebrow" style={{ marginBottom: 6 }}>Crop into Multiple Parts</span>
        {MODES.map((m) => (
          <label
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              background: mode === m.id ? 'var(--blue-100)' : 'transparent',
              border: `1px solid ${mode === m.id ? 'var(--blue-300)' : 'transparent'}`,
            }}
          >
            <input type="radio" name="mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
            <span style={{ fontWeight: 600, fontSize: 14, color: mode === m.id ? 'var(--ink-900)' : 'var(--slate-700)' }}>
              {m.label}
            </span>
          </label>
        ))}
      </div>

      <div style={{ padding: '4px 20px 20px', flex: 1 }}>{children}</div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line-200)', position: 'sticky', bottom: 0, background: 'var(--paper-50)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={!canCrop} onClick={onCrop}>
          Crop {cropCount ? `(${cropCount})` : ''}
        </button>
      </div>
    </aside>
  )
}
