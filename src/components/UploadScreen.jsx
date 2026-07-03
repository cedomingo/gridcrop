import React, { useCallback, useRef, useState } from 'react'

export default function UploadScreen({ onFile, error }) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = useCallback(
    (files) => {
      if (files && files[0]) onFile(files[0])
    },
    [onFile]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragActive(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <style>{`
        @keyframes cropgrid-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes cropgrid-marching-ants {
          to { stroke-dashoffset: -14; }
        }
        .cropgrid-glyph {
          animation: cropgrid-float 2.2s ease-in-out infinite;
        }
        .cropgrid-dropzone.active .cropgrid-dash {
          animation: cropgrid-marching-ants 0.6s linear infinite;
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div className="label-eyebrow" style={{ marginBottom: 10 }}>
        </div>
        <h1 style={{ fontSize: 42, letterSpacing: '-0.02em' }}>CropGrid</h1>
        <p style={{ color: 'var(--slate-500)', fontSize: 16, marginTop: 10, maxWidth: 440 }}>
          Crop an image into parts — split one image into perfectly sized sections for every screen,
          panel, or billboard.
        </p>
      </div>

      <label
        htmlFor="cropgrid-file-input"
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`card cropgrid-dropzone${dragActive ? ' active' : ''}`}
        style={{
          width: 'min(560px, 90vw)',
          padding: '64px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: dragActive ? 'var(--blue-500)' : 'var(--line-200)',
          background: dragActive ? 'var(--blue-100)' : 'var(--paper-50)',
          transition: 'all 0.15s ease',
        }}
      >
        <UploadGlyph active={dragActive} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--ink-900)' }}>
          Upload your photo to start cropping
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--slate-400)' }}>
          JPG · PNG · WEBP
        </div>
        <input
          id="cropgrid-file-input"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {error && (
        <div className="status-line status-warn" style={{ marginTop: 18, background: 'var(--red-100)', color: 'var(--red-500)' }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}

function UploadGlyph({ active }) {
  const stroke = active ? 'var(--blue-500)' : 'var(--ink-700)'
  return (
    <svg
      className="cropgrid-glyph"
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      style={{ animationPlayState: active ? 'paused' : 'running' }}
    >
      <rect
        className="cropgrid-dash"
        x="3"
        y="3"
        width="38"
        height="38"
        rx="3"
        stroke={stroke}
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <path
        d="M22 30V14M22 14L16 20M22 14L28 20"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}