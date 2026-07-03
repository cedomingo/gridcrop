import React, { useState } from 'react'
import Sidebar from './Sidebar'
import ImageCanvas from './canvas/ImageCanvas'
import EqualSplit from './modes/EqualSplit'
import GridLayout from './modes/GridLayout'
import CustomSections from './modes/CustomSections'
import ExportOverlay from './ExportOverlay'

export default function MainEditor({ image, bounds, onChangePhoto }) {
  const [mode, setMode] = useState('equal')

  const [equalResult, setEqualResult] = useState({ cells: [], note: null })
  const [gridResult, setGridResult] = useState({ cells: [], colRes: null, rowRes: null })
  const [customResult, setCustomResult] = useState({ cells: [], analysis: null })

  // Equal Split state — lifted here (instead of living inside EqualSplit) so it
  // survives switching to another tab and back, same pattern as the
  // Custom Sections state below.
  const [equalInputMode, setEqualInputMode] = useState('count')
  const [equalCols, setEqualCols] = useState(2)
  const [equalRows, setEqualRows] = useState(2)
  const [equalColPx, setEqualColPx] = useState(Math.round(bounds.w / 2))
  const [equalRowPx, setEqualRowPx] = useState(Math.round(bounds.h / 2))
  const [equalNoRound, setEqualNoRound] = useState(false)

  // Grid Layout state — lifted here so it survives switching tabs, same
  // pattern as the Equal Split state above.
  const [gridCols, setGridCols] = useState(() => [
    { id: 'c0', value: Math.round(bounds.w / 2), unit: 'px' },
    { id: 'c1', value: Math.round(bounds.w / 2), unit: 'px' },
  ])
  const [gridRows, setGridRows] = useState(() => [
    { id: 'r0', value: Math.round(bounds.h / 2), unit: 'px' },
    { id: 'r1', value: Math.round(bounds.h / 2), unit: 'px' },
  ])

  const [sections, setSections] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapPx, setSnapPx] = useState(5)

  const [showExport, setShowExport] = useState(false)

  const activeCells = mode === 'equal' ? equalResult.cells : mode === 'grid' ? gridResult.cells : customResult.cells

  const exportCrops = activeCells.map((c) => ({
    index: c.index,
    x: bounds.x + c.x,
    y: bounds.y + c.y,
    w: c.w,
    h: c.h,
  }))

  const canCrop = activeCells.length > 0 && activeCells.every((c) => c.w > 0 && c.h > 0)

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        mode={mode}
        setMode={setMode}
        onChangePhoto={onChangePhoto}
        onCrop={() => setShowExport(true)}
        canCrop={canCrop}
        cropCount={activeCells.length}
      >
        {mode === 'equal' && (
          <EqualSplit
            bounds={bounds}
            inputMode={equalInputMode}
            setInputMode={setEqualInputMode}
            cols={equalCols}
            setCols={setEqualCols}
            rows={equalRows}
            setRows={setEqualRows}
            colPx={equalColPx}
            setColPx={setEqualColPx}
            rowPx={equalRowPx}
            setRowPx={setEqualRowPx}
            noRound={equalNoRound}
            setNoRound={setEqualNoRound}
            onResult={setEqualResult}
          />
        )}
        {mode === 'grid' && (
          <GridLayout
            bounds={bounds}
            cols={gridCols}
            setCols={setGridCols}
            rows={gridRows}
            setRows={setGridRows}
            onResult={setGridResult}
          />
        )}
        {mode === 'custom' && (
          <CustomSections
            bounds={bounds}
            sections={sections}
            setSections={setSections}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            snapEnabled={snapEnabled}
            setSnapEnabled={setSnapEnabled}
            snapPx={snapPx}
            setSnapPx={setSnapPx}
            onResult={setCustomResult}
          />
        )}

        {mode === 'equal' && equalResult.note && (
          <div className="status-line status-warn" style={{ marginTop: 12 }}>⚠ {equalResult.note}</div>
        )}
      </Sidebar>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--line-200)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--paper-50)',
          }}
        >
          <span className="label-eyebrow">
            working area {Math.round(bounds.w)} × {Math.round(bounds.h)} px
          </span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--slate-500)' }}>
            {activeCells.length} crop{activeCells.length !== 1 ? 's' : ''} ready
          </span>
        </div>

        <ImageCanvas
          image={image}
          bounds={bounds}
          cells={mode === 'custom' ? [] : activeCells}
          customMode={mode === 'custom'}
          sections={sections}
          onSectionsChange={setSections}
          selectedId={selectedId}
          onSelect={setSelectedId}
          snapEnabled={snapEnabled}
          snapPx={snapPx}
        />
      </main>

      {showExport && (
        <ExportOverlay image={image} crops={exportCrops} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}