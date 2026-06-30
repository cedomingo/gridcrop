import React, { useEffect, useMemo, useRef, useState } from 'react'

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const ASPECT_PRESETS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'current', label: 'Current', ratio: 'current' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
]

export default function InitialCropOverlay({ image, fileInfo, onConfirm, onCancel }) {
  const naturalW = image.naturalWidth
  const naturalH = image.naturalHeight

  const [rect, setRect] = useState({ x: 0, y: 0, w: naturalW, h: naturalH })
  const [aspectPreset, setAspectPreset] = useState('free')
  const lockAspect = aspectPreset !== 'free'
  const aspectRef = useRef(naturalW / naturalH)

  const stageRef = useRef(null)
  const [stageSize, setStageSize] = useState({ w: 800, h: 500 })

  useEffect(() => {
    function measure() {
      const el = stageRef.current
      if (!el) return
      setStageSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const scale = useMemo(() => {
    const sx = stageSize.w / naturalW
    const sy = stageSize.h / naturalH
    return Math.min(sx, sy, 1)
  }, [stageSize, naturalW, naturalH])

  const displayW = naturalW * scale
  const displayH = naturalH * scale

  const drag = useRef(null) // { handle, startX, startY, startRect }

  function clampRect(r) {
    let { x, y, w, h } = r
    w = Math.max(10, Math.min(w, naturalW))
    h = Math.max(10, Math.min(h, naturalH))
    x = Math.max(0, Math.min(x, naturalW - w))
    y = Math.max(0, Math.min(y, naturalH - h))
    return { x, y, w, h }
  }

  // Like clampRect, but when an aspect ratio is locked, shrinks w/h
  // together (preserving the ratio) instead of clamping each dimension
  // independently — which would otherwise distort the ratio at the edges.
  // Once a dimension hits the canvas limit, growth in that direction
  // simply stops while the ratio stays locked.
  function clampRectKeepAspect(r, aspect) {
    if (!lockAspect || !Number.isFinite(aspect) || aspect <= 0) return clampRect(r)

    let { x, y, w, h } = r

    if (w > naturalW) {
      w = naturalW
      h = w / aspect
    }
    if (h > naturalH) {
      h = naturalH
      w = h * aspect
    }
    if (w < 10) {
      w = 10
      h = w / aspect
    }
    if (h < 10) {
      h = 10
      w = h * aspect
    }

    x = Math.max(0, Math.min(x, naturalW - w))
    y = Math.max(0, Math.min(y, naturalH - h))

    return { x, y, w, h }
  }

  // Re-derive a rect that satisfies the locked aspect ratio, anchored
  // appropriately for the handle being dragged.
  function applyAspect(handle, r, startRect) {
    if (!lockAspect) return r
    const aspect = aspectRef.current
    if (!Number.isFinite(aspect) || aspect <= 0) return r

    let { x, y, w, h } = r

    if (handle === 'n' || handle === 's') {
      // Only height changed — derive width, keep horizontal center fixed.
      const newW = h * aspect
      x = startRect.x + (startRect.w - newW) / 2
      w = newW
    } else if (handle === 'e' || handle === 'w') {
      // Only width changed — derive height, keep vertical center fixed.
      const newH = w / aspect
      y = startRect.y + (startRect.h - newH) / 2
      h = newH
    } else if (handle && handle !== 'move') {
      // Corner handle — drive from width, anchor the edge(s) being dragged.
      const newH = w / aspect
      if (handle.includes('n')) {
        y = startRect.y + startRect.h - newH
      }
      h = newH
    }

    return { x, y, w, h }
  }

  function onPointerDown(handle, e) {
    e.preventDefault()
    e.stopPropagation()
    drag.current = { handle, startX: e.clientX, startY: e.clientY, startRect: rect }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e) {
    if (!drag.current) return
    const { handle, startX, startY, startRect } = drag.current
    const dx = (e.clientX - startX) / scale
    const dy = (e.clientY - startY) / scale
    let { x, y, w, h } = startRect

    if (handle.includes('n')) {
      y = startRect.y + dy
      h = startRect.h - dy
    }
    if (handle.includes('s')) {
      h = startRect.h + dy
    }
    if (handle.includes('w')) {
      x = startRect.x + dx
      w = startRect.w - dx
    }
    if (handle.includes('e')) {
      w = startRect.w + dx
    }

    if (handle === 'move') {
      x = startRect.x + dx
      y = startRect.y + dy
      w = startRect.w
      h = startRect.h
      setRect(clampRect({ x, y, w, h }))
    } else {
      ;({ x, y, w, h } = applyAspect(handle, { x, y, w, h }, startRect))
      setRect(clampRectKeepAspect({ x, y, w, h }, aspectRef.current))
    }
  }

  function onPointerUp() {
    drag.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function updateWidth(v) {
    const w = Math.max(10, Math.min(naturalW, Math.round(v) || 1))
    let h = rect.h
    if (lockAspect) h = w / aspectRef.current
    setRect(clampRectKeepAspect({ ...rect, w, h }, aspectRef.current))
  }

  function updateHeight(v) {
    const h = Math.max(10, Math.min(naturalH, Math.round(v) || 1))
    let w = rect.w
    if (lockAspect) w = h * aspectRef.current
    setRect(clampRectKeepAspect({ ...rect, w, h }, aspectRef.current))
  }

  function selectAspect(presetId) {
    setAspectPreset(presetId)
    const preset = ASPECT_PRESETS.find((p) => p.id === presetId)
    if (!preset || preset.ratio === null) return

    const ratio = preset.ratio === 'current' ? rect.w / rect.h : preset.ratio
    aspectRef.current = ratio

    // Snap the current rect to the new ratio immediately, anchored at its
    // current top-left corner, shrinking to fit within the image if needed.
    let w = rect.w
    let h = w / ratio
    if (h > naturalH) {
      h = naturalH
      w = h * ratio
    }
    if (w > naturalW) {
      w = naturalW
      h = w / ratio
    }
    setRect(clampRectKeepAspect({ x: rect.x, y: rect.y, w, h }, ratio))
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 38, 71, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(980px, 100%)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--line-200)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: 18 }}>Trim before splitting</h2>
            <div className="label-eyebrow" style={{ marginTop: 4 }}>
              {fileInfo?.name} · {naturalW} × {naturalH} px (optional)
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onCancel}>
            Change photo
          </button>
        </div>

        <div
          ref={stageRef}
          style={{
            flex: 1,
            minHeight: 360,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'repeating-conic-gradient(#eef2f9 0% 25%, #f7f9fc 0% 50%) 0 0/20px 20px',
            position: 'relative',
            padding: 20,
          }}
        >
          <div style={{ position: 'relative', width: displayW, height: displayH }}>
            <img
              src={image.src}
              alt="Source"
              draggable={false}
              style={{ width: displayW, height: displayH, display: 'block', userSelect: 'none' }}
            />
            {/* dim overlays outside crop rect */}
            <Dim style={{ left: 0, top: 0, width: '100%', height: rect.y * scale }} />
            <Dim style={{ left: 0, top: (rect.y + rect.h) * scale, width: '100%', height: displayH - (rect.y + rect.h) * scale }} />
            <Dim style={{ left: 0, top: rect.y * scale, width: rect.x * scale, height: rect.h * scale }} />
            <Dim style={{ left: (rect.x + rect.w) * scale, top: rect.y * scale, width: displayW - (rect.x + rect.w) * scale, height: rect.h * scale }} />

            <div
              onPointerDown={(e) => onPointerDown('move', e)}
              style={{
                position: 'absolute',
                left: rect.x * scale,
                top: rect.y * scale,
                width: rect.w * scale,
                height: rect.h * scale,
                border: '2px solid var(--blue-500)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
                cursor: 'move',
              }}
            >
              <div
                className="mono"
                style={{
                  position: 'absolute',
                  top: -26,
                  left: 0,
                  background: 'var(--ink-700)',
                  color: 'white',
                  fontSize: 11,
                  padding: '3px 7px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                {Math.round(rect.w)} × {Math.round(rect.h)} px
              </div>
              {HANDLES.map((h) => (
                <Handle key={h} handle={h} onPointerDown={onPointerDown} />
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '18px 22px',
            borderTop: '1px solid var(--line-200)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <Field label="Width (px)">
            <input
              type="number"
              className="numfield"
              value={Math.round(rect.w)}
              min={10}
              max={naturalW}
              onChange={(e) => updateWidth(e.target.value)}
              style={{ width: 100 }}
            />
          </Field>
          <Field label="Height (px)">
            <input
              type="number"
              className="numfield"
              value={Math.round(rect.h)}
              min={10}
              max={naturalH}
              onChange={(e) => updateHeight(e.target.value)}
              style={{ width: 100 }}
            />
          </Field>

          <Field label="Aspect ratio">
            <div className="unit-toggle">
              {ASPECT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={aspectPreset === p.id ? 'active' : ''}
                  onClick={() => selectAspect(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <button
            className="btn btn-ghost"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              setAspectPreset('free')
              setRect({ x: 0, y: 0, w: naturalW, h: naturalH })
            }}
          >
            Reset crop
          </button>
          <button className="btn btn-primary" onClick={() => onConfirm(clampRect(rect))}>
            Let's Go! →
          </button>
        </div>
      </div>
    </div>
  )
}

function Dim({ style }) {
  return <div style={{ position: 'absolute', background: 'rgba(15, 38, 71, 0.45)', ...style }} />
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="label-eyebrow">{label}</span>
      {children}
    </div>
  )
}

const handleCursor = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
}

const handlePos = {
  nw: { left: 0, top: 0 },
  n: { left: '50%', top: 0 },
  ne: { left: '100%', top: 0 },
  e: { left: '100%', top: '50%' },
  se: { left: '100%', top: '100%' },
  s: { left: '50%', top: '100%' },
  sw: { left: 0, top: '100%' },
  w: { left: 0, top: '50%' },
}

function Handle({ handle, onPointerDown }) {
  const pos = handlePos[handle]
  return (
    <div
      onPointerDown={(e) => onPointerDown(handle, e)}
      style={{
        position: 'absolute',
        left: pos.left,
        top: pos.top,
        transform: 'translate(-50%, -50%)',
        width: 12,
        height: 12,
        background: 'white',
        border: '2px solid var(--blue-500)',
        borderRadius: 2,
        cursor: handleCursor[handle],
      }}
    />
  )
}