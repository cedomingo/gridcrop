import React, { useEffect, useMemo, useState } from 'react'
import { downloadAllAsZip, downloadSingleCrop, buildFilename, renderCropBlob } from '../utils/exportCrops'

export default function ExportOverlay({ image, crops, onClose }) {
  const [format, setFormat] = useState('png')
  const [quality, setQuality] = useState(0.92)
  const [thumbs, setThumbs] = useState({})
  const [names, setNames] = useState({})
  const [zipping, setZipping] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    setThumbs({})
    ;(async () => {
      for (const c of crops) {
        const blob = await renderCropBlob(image, c, format, quality)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setThumbs((t) => ({ ...t, [c.index]: url }))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crops, format])

  const namedCrops = useMemo(
    () => crops.map((c) => ({ ...c, name: names[c.index] || '' })),
    [crops, names]
  )

  async function handleZip() {
    setZipping(true)
    setProgress(0)
    try {
      await downloadAllAsZip(image, namedCrops, format, quality, (done, total) => setProgress(done / total))
    } finally {
      setZipping(false)
    }
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
        zIndex: 60,
        padding: 24,
      }}
    >
      <div className="card" style={{ width: 'min(960px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18 }}>Output — {crops.length} crop{crops.length !== 1 ? 's' : ''}</h2>
            <div className="label-eyebrow" style={{ marginTop: 4 }}>reading order, left → right, top → bottom</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="scrollbar-thin" style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
            {crops.map((c) => (
              <div key={c.index} className="card" style={{ padding: 10, position: 'relative' }}>
                <div
                  style={{
                    aspectRatio: `${c.w} / ${c.h}`,
                    background: 'var(--paper-0)',
                    backgroundImage: thumbs[c.index] ? `url(${thumbs[c.index]})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 4,
                    border: '1px solid var(--line-200)',
                    marginBottom: 8,
                    cursor: 'pointer',
                  }}
                  onClick={() => downloadSingleCrop(image, { ...c, name: names[c.index] }, format, quality)}
                  title="Click to download this crop"
                />
                <div className="mono" style={{ fontSize: 10, color: 'var(--slate-500)', marginBottom: 4 }}>
                  {buildFilename({ ...c, name: names[c.index] }, format)}
                </div>
                <input
                  className="numfield"
                  placeholder={`crop_${c.index}_${Math.round(c.w)}x${Math.round(c.h)}`}
                  value={names[c.index] || ''}
                  onChange={(e) => setNames((n) => ({ ...n, [c.index]: e.target.value }))}
                  style={{ fontSize: 10, padding: '5px 6px' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 22px', borderTop: '1px solid var(--line-200)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="unit-toggle">
            <button className={format === 'png' ? 'active' : ''} onClick={() => setFormat('png')}>PNG</button>
            <button className={format === 'jpg' ? 'active' : ''} onClick={() => setFormat('jpg')}>JPG</button>
          </div>
          {format === 'jpg' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              Quality
              <input type="range" min={0.4} max={1} step={0.02} value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))} />
              <span className="mono">{Math.round(quality * 100)}%</span>
            </label>
          )}
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={zipping} onClick={handleZip}>
            {zipping ? `Zipping… ${Math.round(progress * 100)}%` : 'Download All as ZIP'}
          </button>
        </div>
      </div>
    </div>
  )
}
