import React, { useEffect, useMemo, useRef, useState } from 'react'
import { snapValue } from '../../utils/cropMath'

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const handleCursor = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
  se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
}
const handlePos = {
  nw: { left: 0, top: 0 }, n: { left: '50%', top: 0 }, ne: { left: '100%', top: 0 },
  e: { left: '100%', top: '50%' }, se: { left: '100%', top: '100%' }, s: { left: '50%', top: '100%' },
  sw: { left: 0, top: '100%' }, w: { left: 0, top: '50%' },
}

const MIN_ZOOM = 0.1 // 10%
const MAX_ZOOM = 1000 // 100000%
const ZOOM_BUTTON_STEP = 1.2 // multiplicative step per click
const ZOOM_WHEEL_SENSITIVITY = 0.0015

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

export default function ImageCanvas({
  image,
  bounds, // {x,y,w,h} working region in natural-image px
  cells = [], // readonly preview cells (equal / grid modes), coords relative to bounds
  showLabels = true,
  customMode = false,
  sections = [],
  onSectionsChange,
  selectedId,
  onSelect,
  snapEnabled = true,
  snapPx = 5,
}) {
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

  // Scale that fits the working bounds into the stage ("100%" / fit zoom).
  const baseScale = useMemo(() => {
    const sx = stageSize.w / bounds.w
    const sy = stageSize.h / bounds.h
    return Math.max(0.02, Math.min(sx, sy, 1))
  }, [stageSize, bounds.w, bounds.h])

  // User-controlled zoom multiplier on top of baseScale. 1 = fit.
  const [zoom, setZoom] = useState(1)
  // Pan offset (screen px) applied on top of the centered stage.
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // Reset zoom + pan back to fit whenever the working bounds change meaningfully.
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [bounds.x, bounds.y, bounds.w, bounds.h])

  const scale = baseScale * zoom

  const dispW = bounds.w * scale
  const dispH = bounds.h * scale

  // Kept in sync every render so the wheel listener (attached once, in an
  // effect with an empty dep array) can always read fresh values without
  // needing to be torn down and re-attached on every zoom/pan/resize.
  const viewRef = useRef({ zoom, pan, stageSize, baseScale, bounds })
  viewRef.current = { zoom, pan, stageSize, baseScale, bounds }

  // Change zoom to `newZoomRaw` while keeping the local canvas point that is
  // currently under screen position (px, py) — relative to the stage
  // element's top-left — visually fixed under that same screen position.
  // This is what makes scroll-to-zoom and the zoom buttons "zoom toward"
  // a point instead of always zooming from the center.
  function zoomAtPoint(newZoomRaw, px, py) {
    const { zoom: curZoom, pan: curPan, stageSize: ss, baseScale: bs, bounds: b } = viewRef.current
    const newZoom = clampZoom(newZoomRaw)
    if (newZoom === curZoom) return

    const oldScale = bs * curZoom
    const newScale = bs * newZoom
    const oldDispW = b.w * oldScale
    const oldDispH = b.h * oldScale
    const newDispW = b.w * newScale
    const newDispH = b.h * newScale

    // Screen position of the stage-inner element's top-left corner,
    // relative to the stage container — mirrors the centering + pan
    // transform applied in the render below.
    const originX = ss.w / 2 - oldDispW / 2 + curPan.x
    const originY = ss.h / 2 - oldDispH / 2 + curPan.y

    // The local (bounds-relative) point currently under the cursor.
    const localX = (px - originX) / oldScale
    const localY = (py - originY) / oldScale

    // Solve for the pan that keeps that same local point under (px, py)
    // once the new scale is applied.
    const newPanX = px - ss.w / 2 + newDispW / 2 - localX * newScale
    const newPanY = py - ss.h / 2 + newDispH / 2 - localY * newScale

    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }

  function zoomIn() {
    zoomAtPoint(zoom * ZOOM_BUTTON_STEP, stageSize.w / 2, stageSize.h / 2)
  }
  function zoomOut() {
    zoomAtPoint(zoom / ZOOM_BUTTON_STEP, stageSize.w / 2, stageSize.h / 2)
  }

  // --- zoom textbox (shows/edits percentage of the fit scale) ---
  const [zoomDraft, setZoomDraft] = useState(null) // null = not editing, derive from zoom
  const zoomDisplayValue = zoomDraft !== null ? zoomDraft : String(Math.round(zoom * 100))

  function commitZoomDraft() {
    if (zoomDraft === null) return
    const parsed = parseInt(zoomDraft, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      zoomAtPoint(parsed / 100, stageSize.w / 2, stageSize.h / 2)
    }
    setZoomDraft(null)
  }

  // --- scroll to zoom ---
  // The listener is attached directly to the stage element (not via React's
  // onWheel) so we can pass { passive: false } and always call
  // preventDefault()/stopPropagation(). Without that, an un-prevented wheel
  // event bubbles up and scrolls whatever scrollable ancestor is under the
  // cursor (e.g. the sidebar), which is what made the zoom controls appear
  // to "disappear" — the whole page was scrolling, not just the canvas.
  //
  // The handler reads zoom/pan/stageSize/bounds from viewRef (not from
  // closure state) so this effect can stay mounted once with an empty dep
  // array while still always zooming relative to the current view — and,
  // critically, toward the cursor position rather than the stage center.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      e.stopPropagation()
    if (e.target.closest('[data-zoom-controls]')) {
      return
    }
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      const factor = Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY)
      const { zoom: curZoom } = viewRef.current
      zoomAtPoint(curZoom * factor, px, py)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const drag = useRef(null)
  const panDrag = useRef(null)
  const [drawing, setDrawing] = useState(null) // temp rect while creating a new section

  function toLocal(e) {
    const el = stageRef.current.querySelector('.cg-stage-inner')
    const r = el.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  function edgesFor(excludeId) {
    const edges = { x: [0, bounds.w], y: [0, bounds.h] }
    for (const s of sections) {
      if (s.id === excludeId) continue
      edges.x.push(s.x, s.x + s.w)
      edges.y.push(s.y, s.y + s.h)
    }
    return edges
  }

  function clamp(rect) {
    let { x, y, w, h } = rect
    w = Math.max(8, w)
    h = Math.max(8, h)
    x = Math.max(0, Math.min(x, bounds.w - w))
    y = Math.max(0, Math.min(y, bounds.h - h))
    return { x, y, w, h }
  }

  // --- right-click drag to pan ---
  function onPanMove(e) {
    if (!panDrag.current) return
    const { startX, startY, startPan } = panDrag.current
    setPan({ x: startPan.x + (e.clientX - startX), y: startPan.y + (e.clientY - startY) })
  }
  function onPanUp() {
    panDrag.current = null
    window.removeEventListener('pointermove', onPanMove)
    window.removeEventListener('pointerup', onPanUp)
    const el = stageRef.current
    if (el) el.style.cursor = ''
  }
  function startPan(e) {
    e.preventDefault()
    e.stopPropagation()
    panDrag.current = { startX: e.clientX, startY: e.clientY, startPan: { ...pan } }
    const el = stageRef.current
    if (el) el.style.cursor = 'grabbing'
    window.addEventListener('pointermove', onPanMove)
    window.addEventListener('pointerup', onPanUp)
  }

  // --- create new section by drag on empty canvas (left click only) ---
  function onStageDown(e) {
    if (e.button === 2) {
      startPan(e)
      return
    }
    if (!customMode) return
    if (e.button !== 0) return
    if (e.target.closest('[data-section]')) return // clicked an existing section
    if (e.target.closest('[data-zoom-controls]')) return // clicked the zoom UI
    const start = toLocal(e)
    setDrawing({ x0: start.x, y0: start.y, x1: start.x, y1: start.y })
    onSelect?.(null)
    window.addEventListener('pointermove', onStageMove)
    window.addEventListener('pointerup', onStageUp)
  }
  function onStageMove(e) {
    setDrawing((d) => {
      if (!d) return d
      const p = toLocal(e)
      return { ...d, x1: p.x, y1: p.y }
    })
  }
  function onStageUp() {
    window.removeEventListener('pointermove', onStageMove)
    window.removeEventListener('pointerup', onStageUp)
    setDrawing((d) => {
      if (d) {
        const x = Math.min(d.x0, d.x1)
        const y = Math.min(d.y0, d.y1)
        const w = Math.abs(d.x1 - d.x0)
        const h = Math.abs(d.y1 - d.y0)
        if (w > 6 && h > 6) {
          const rect = clamp({ x, y, w, h })
          const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
          const next = [...sections, { id, ...rect }]
          onSectionsChange?.(next)
          onSelect?.(id)
        }
      }
      return null
    })
  }

  // --- move / resize existing section ---
  function onHandleDown(id, handle, e) {
    if (e.button === 2) return // right click reserved for panning
    e.preventDefault()
    e.stopPropagation()
    const section = sections.find((s) => s.id === id)
    onSelect?.(id)
    drag.current = { id, handle, start: toLocal(e), startRect: { ...section } }
    window.addEventListener('pointermove', onHandleMove)
    window.addEventListener('pointerup', onHandleUp)
  }
  function onHandleMove(e) {
    if (!drag.current) return
    const { id, handle, start, startRect } = drag.current
    const p = toLocal(e)
    const dx = p.x - start.x
    const dy = p.y - start.y
    let { x, y, w, h } = startRect

    if (handle === 'move') {
      x = startRect.x + dx
      y = startRect.y + dy
    } else {
      if (handle.includes('n')) { y = startRect.y + dy; h = startRect.h - dy }
      if (handle.includes('s')) { h = startRect.h + dy }
      if (handle.includes('w')) { x = startRect.x + dx; w = startRect.w - dx }
      if (handle.includes('e')) { w = startRect.w + dx }
    }

    if (snapEnabled) {
      const edges = edgesFor(id)
      x = snapValue(x, edges.x, snapPx)
      y = snapValue(y, edges.y, snapPx)
      if (handle === 'move') {
        // also try snapping right/bottom edge
      } else {
        const right = snapValue(x + w, edges.x, snapPx)
        const bottom = snapValue(y + h, edges.y, snapPx)
        w = right - x
        h = bottom - y
      }
    }

    const next = sections.map((s) => (s.id === id ? { id, ...clamp({ x, y, w, h }) } : s))
    onSectionsChange?.(next)
  }
  function onHandleUp() {
    drag.current = null
    window.removeEventListener('pointermove', onHandleMove)
    window.removeEventListener('pointerup', onHandleUp)
  }

  const previewDraw = drawing
    ? {
        x: Math.min(drawing.x0, drawing.x1),
        y: Math.min(drawing.y0, drawing.y1),
        w: Math.abs(drawing.x1 - drawing.x0),
        h: Math.abs(drawing.y1 - drawing.y0),
      }
    : null

  return (
    <div
      ref={stageRef}
      style={{
        flex: 1,
        minHeight: 360,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
      }}
      onPointerDown={onStageDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="cg-stage-inner"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: dispW,
          height: dispH,
          // Centering + panning both live in this one transform. Because the
          // element is position:absolute, its box size (which can get huge
          // at high zoom) never contributes to the size of the stage — the
          // stage's own flex/minHeight rules are all that determine its
          // size, and overflow:hidden on the stage clips the rest. Before,
          // this div was a normal (in-flow) flex child, so a large zoomed
          // width/height could inflate the stage's — and therefore the
          // page's — layout, pushing the sidebar and the zoom controls off
          // screen.
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
          cursor: customMode ? 'crosshair' : 'default',
        }}
      >
        <img
          src={image.src}
          draggable={false}
          alt="Source"
          style={{
            position: 'absolute',
            left: -bounds.x * scale,
            top: -bounds.y * scale,
            width: image.naturalWidth * scale,
            height: image.naturalHeight * scale,
            clipPath: `inset(${bounds.y * scale}px ${(image.naturalWidth - bounds.x - bounds.w) * scale}px ${(image.naturalHeight - bounds.y - bounds.h) * scale}px ${bounds.x * scale}px)`,
            userSelect: 'none',
          }}
        />

        {!customMode &&
          cells.map((cell) => (
            <div
              key={cell.index}
              style={{
                position: 'absolute',
                left: cell.x * scale,
                top: cell.y * scale,
                width: cell.w * scale,
                height: cell.h * scale,
                border: '1px solid var(--blue-500)',
                outline: '1px solid rgba(255,255,255,0.6)',
                outlineOffset: -1,
                boxSizing: 'border-box',
              }}
            >
              {showLabels && cell.w * scale > 50 && cell.h * scale > 26 && (
                <div
                  className="mono"
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: 4,
                    background: 'var(--ink-700)',
                    color: 'white',
                    fontSize: 10,
                    lineHeight: 1.3,
                    padding: '2px 5px',
                    borderRadius: 2,
                  }}
                >
                  crop_{cell.index}
                  <br />
                  {Math.round(cell.w)}×{Math.round(cell.h)}
                </div>
              )}
            </div>
          ))}

        {customMode &&
          sections.map((s) => (
            <div
              key={s.id}
              data-section
              onPointerDown={(e) => onHandleDown(s.id, 'move', e)}
              style={{
                position: 'absolute',
                left: s.x * scale,
                top: s.y * scale,
                width: s.w * scale,
                height: s.h * scale,
                border: `2px solid ${selectedId === s.id ? 'var(--blue-500)' : 'var(--blue-300)'}`,
                background: selectedId === s.id ? 'rgba(47,111,237,0.10)' : 'rgba(143,184,232,0.10)',
                cursor: 'move',
                boxSizing: 'border-box',
              }}
            >
              <div
                className="mono"
                style={{
                  position: 'absolute',
                  top: -22,
                  left: 0,
                  background: 'var(--ink-700)',
                  color: 'white',
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {Math.round(s.w)}×{Math.round(s.h)}
              </div>
              {selectedId === s.id &&
                HANDLES.map((h) => (
                  <div
                    key={h}
                    onPointerDown={(e) => onHandleDown(s.id, h, e)}
                    style={{
                      position: 'absolute',
                      left: handlePos[h].left,
                      top: handlePos[h].top,
                      transform: 'translate(-50%, -50%)',
                      width: 11,
                      height: 11,
                      background: 'white',
                      border: '2px solid var(--blue-500)',
                      borderRadius: 2,
                      cursor: handleCursor[h],
                    }}
                  />
                ))}
            </div>
          ))}

        {previewDraw && (
          <div
            style={{
              position: 'absolute',
              left: previewDraw.x * scale,
              top: previewDraw.y * scale,
              width: previewDraw.w * scale,
              height: previewDraw.h * scale,
              border: '2px dashed var(--blue-500)',
              background: 'rgba(47,111,237,0.08)',
            }}
          />
        )}
      </div>

      {/* Zoom controls — bottom right */}
      <div
        data-zoom-controls
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'var(--ink-700)',
          borderRadius: 6,
          padding: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        <ZoomButton label="Zoom out" onClick={zoomOut}>
          <MagnifierIcon symbol="minus" />
        </ZoomButton>

        <input
          className="mono"
          value={zoomDraft !== null ? zoomDraft : `${zoomDisplayValue}%`}
          onFocus={() => setZoomDraft(String(Math.round(zoom * 100)))}
          onChange={(e) => setZoomDraft(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={commitZoomDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitZoomDraft()
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              setZoomDraft(null)
              e.currentTarget.blur()
            }
          }}
          style={{
            width: 52,
            textAlign: 'center',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 4,
            color: 'white',
            fontSize: 11,
            padding: '4px 2px',
            outline: 'none',
          }}
        />

        <ZoomButton label="Zoom in" onClick={zoomIn}>
          <MagnifierIcon symbol="plus" />
        </ZoomButton>
      </div>
    </div>
  )
}

function ZoomButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        color: 'white',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function MagnifierIcon({ symbol }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="white" strokeWidth="2" />
      <line x1="15.3" y1="15.3" x2="21" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {symbol === 'plus' ? (
        <>
          <line x1="10.5" y1="7.5" x2="10.5" y2="13.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="7.5" y1="10.5" x2="13.5" y2="10.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <line x1="7.5" y1="10.5" x2="13.5" y2="10.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  )
}