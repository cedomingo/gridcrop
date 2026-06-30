// ---------------------------------------------------------------------------
// cropMath.js
// Pure functions for computing crop rectangles from each split mode.
// All rectangles are { x, y, w, h } in source-image pixel space (post initial crop).
// ---------------------------------------------------------------------------

/**
 * Distribute `total` into `count` integer parts that sum exactly to `total`,
 * each part as equal as possible, with the remainder distributed to the
 * trailing parts (so visual order matches "last column/row absorbs rounding").
 */
function distributeEven(total, count) {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.round(count) : 1
  const base = Math.floor(total / safeCount)
  const remainder = total - base * safeCount
  const parts = new Array(safeCount).fill(base)
  for (let i = 0; i < remainder; i++) {
    parts[safeCount - 1 - i] += 1
  }
  return parts
}

function cumulative(sizes) {
  const offsets = [0]
  for (let i = 0; i < sizes.length; i++) {
    offsets.push(offsets[i] + sizes[i])
  }
  return offsets
}

// ---------------------------------------------------------------------------
// 3.1 Equal Split
// ---------------------------------------------------------------------------

/**
 * @param {number} imageW
 * @param {number} imageH
 * @param {{mode: 'count'|'px', cols: number, rows: number, colPx: number, rowPx: number, noRound?: boolean}} params
 * @returns {{ cells: Array<{x,y,w,h,col,row}>, colSizes: number[], rowSizes: number[], note: string|null }}
 */
export function computeEqualSplit(imageW, imageH, params) {
  // Guard against fractional working-area dimensions (e.g. from unrounded
  // pointer/drag measurements) leaking into the math and producing ugly
  // decimals in cell sizes and the rounding note below.
  imageW = Math.round(imageW)
  imageH = Math.round(imageH)

  let cols, rows
  let colSizes, rowSizes
  let note = null

  if (params.mode === 'px' && params.noRound) {
    // Exact px sizing — every column/row keeps the requested size exactly,
    // and the trailing column/row is whatever is left over (no merging,
    // no redistribution of the remainder into other cells).
    const colPx = Math.max(1, Math.round(params.colPx))
    const rowPx = Math.max(1, Math.round(params.rowPx))
    cols = Math.max(1, Math.ceil(imageW / colPx))
    rows = Math.max(1, Math.ceil(imageH / rowPx))

    colSizes = []
    for (let c = 0; c < cols; c++) {
      colSizes.push(Math.min(colPx, imageW - c * colPx))
    }
    rowSizes = []
    for (let r = 0; r < rows; r++) {
      rowSizes.push(Math.min(rowPx, imageH - r * rowPx))
    }

    const exactCol = imageW % colPx === 0
    const exactRow = imageH % rowPx === 0
    if (!exactCol || !exactRow) {
      const bits = []
      if (!exactCol) bits.push(`last column is ${colSizes[colSizes.length - 1]}px`)
      if (!exactRow) bits.push(`last row is ${rowSizes[rowSizes.length - 1]}px`)
      note = `Note: ${bits.join(', ')} (exact sizing — leftover kept as its own cell instead of being rounded).`
    }
  } else {
    if (params.mode === 'px') {
      cols = Math.max(1, Math.round(imageW / Math.max(1, params.colPx)))
      rows = Math.max(1, Math.round(imageH / Math.max(1, params.rowPx)))
    } else {
      cols = Math.max(1, Math.round(params.cols))
      rows = Math.max(1, Math.round(params.rows))
    }

    colSizes = distributeEven(imageW, cols)
    rowSizes = distributeEven(imageH, rows)

    const exactCol = imageW % cols === 0
    const exactRow = imageH % rows === 0
    if (!exactCol || !exactRow) {
      const bits = []
      if (!exactCol) bits.push(`last column is ${colSizes[colSizes.length - 1]}px`)
      if (!exactRow) bits.push(`last row is ${rowSizes[rowSizes.length - 1]}px`)
      note = `Note: ${bits.join(', ')} due to rounding (${imageW}÷${cols}, ${imageH}÷${rows} not exact).`
    }
  }

  const colOffsets = cumulative(colSizes)
  const rowOffsets = cumulative(rowSizes)

  const cells = []
  let index = 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        index: index++,
        x: colOffsets[c],
        y: rowOffsets[r],
        w: colSizes[c],
        h: rowSizes[r],
        col: c,
        row: r,
      })
    }
  }

  return { cells, colSizes, rowSizes, note, cols, rows }
}

// ---------------------------------------------------------------------------
// 3.2 Grid Layout — CSS-Grid-style track resolution (px + fr mixed units)
// ---------------------------------------------------------------------------

/**
 * Resolve a single axis of tracks (columns or rows) against the available
 * pixel length, the same way CSS Grid resolves `grid-template-columns`:
 * fixed px tracks are subtracted first, fr tracks split whatever is left
 * proportionally to their fr value.
 *
 * @param {number} totalPx - available length on this axis (image w or h)
 * @param {Array<{value:number, unit:'px'|'fr'}>} tracks
 * @returns {{ sizes: number[], sumPx: number, overflow: number, hasFr: boolean }}
 */
export function resolveTracks(totalPx, tracks) {
  const pxTracks = tracks.filter((t) => t.unit === 'px')
  const frTracks = tracks.filter((t) => t.unit === 'fr')
  const sumPxFixed = pxTracks.reduce((s, t) => s + Math.max(0, t.value), 0)
  const totalFr = frTracks.reduce((s, t) => s + Math.max(0, t.value), 0)

  const remaining = totalPx - sumPxFixed
  const hasFr = frTracks.length > 0

  // Allocate fr space (if remaining negative, frs collapse to 0 and we flag overflow)
  let frSizes = []
  if (hasFr) {
    const usable = Math.max(0, remaining)
    if (totalFr > 0) {
      const raw = frTracks.map((t) => (Math.max(0, t.value) / totalFr) * usable)
      const floored = raw.map(Math.floor)
      let used = floored.reduce((s, v) => s + v, 0)
      let leftover = Math.round(usable) - used
      // distribute leftover px to largest fractional remainders
      const order = raw
        .map((v, i) => ({ i, frac: v - Math.floor(v) }))
        .sort((a, b) => b.frac - a.frac)
      for (let k = 0; k < leftover; k++) {
        floored[order[k % floored.length].i] += 1
      }
      frSizes = floored
    } else {
      frSizes = frTracks.map(() => 0)
    }
  }

  // Reassemble in original order
  let pxI = 0
  let frI = 0
  const sizes = tracks.map((t) =>
    t.unit === 'px' ? Math.max(0, Math.round(t.value)) : frSizes[frI++] ?? 0
  )

  const sumPx = sizes.reduce((s, v) => s + v, 0)
  const overflow = sumPx - totalPx // positive = exceeds image, negative = underfills

  return { sizes, sumPx, overflow, hasFr, sumPxFixed }
}

/**
 * Build the full crop-cell grid from resolved column/row tracks.
 * @param {Array<{value:number, unit:'px'|'fr'}>} colTracks
 * @param {Array<{value:number, unit:'px'|'fr'}>} rowTracks
 */
export function computeGridLayout(imageW, imageH, colTracks, rowTracks) {
  const colRes = resolveTracks(imageW, colTracks)
  const rowRes = resolveTracks(imageH, rowTracks)
  const colOffsets = cumulative(colRes.sizes)
  const rowOffsets = cumulative(rowRes.sizes)

  const cells = []
  let index = 1
  for (let r = 0; r < rowRes.sizes.length; r++) {
    for (let c = 0; c < colRes.sizes.length; c++) {
      cells.push({
        index: index++,
        x: colOffsets[c],
        y: rowOffsets[r],
        w: colRes.sizes[c],
        h: rowRes.sizes[r],
        col: c,
        row: r,
      })
    }
  }

  return { cells, colRes, rowRes }
}

/** Convert a simple ratio string like "7" or "7/3" (single number used as fr weight) */
export function parseRatioValue(input) {
  const n = parseFloat(input)
  return Number.isFinite(n) && n > 0 ? n : 1
}

// ---------------------------------------------------------------------------
// 3.3 Custom Sections — overlap + coverage gap detection
// ---------------------------------------------------------------------------

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * @param {Array<{id:string,x,y,w,h}>} sections
 * @returns {{ overlappingIds: Set<string>, hasGaps: boolean, coveragePct: number }}
 */
export function analyzeCustomSections(sections, imageW, imageH) {
  const overlappingIds = new Set()
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      if (rectsOverlap(sections[i], sections[j])) {
        overlappingIds.add(sections[i].id)
        overlappingIds.add(sections[j].id)
      }
    }
  }

  // Coarse coverage sampling grid (independent of image resolution, capped for perf)
  const GRID = 120
  const covered = new Uint8Array(GRID * GRID)
  if (imageW > 0 && imageH > 0) {
    for (const s of sections) {
      const x0 = Math.max(0, Math.floor((s.x / imageW) * GRID))
      const x1 = Math.min(GRID, Math.ceil(((s.x + s.w) / imageW) * GRID))
      const y0 = Math.max(0, Math.floor((s.y / imageH) * GRID))
      const y1 = Math.min(GRID, Math.ceil(((s.y + s.h) / imageH) * GRID))
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          covered[yy * GRID + xx] = 1
        }
      }
    }
  }
  const coveredCount = covered.reduce((s, v) => s + v, 0)
  const coveragePct = sections.length === 0 ? 0 : (coveredCount / (GRID * GRID)) * 100
  const hasGaps = sections.length > 0 && coveragePct < 99.5

  return { overlappingIds, hasGaps, coveragePct }
}

/** Snap a value to the nearest multiple of `snap`, optionally also to a list of edge candidates within tolerance. */
export function snapValue(value, edges, snap = 5, tolerance = 6) {
  for (const e of edges) {
    if (Math.abs(value - e) <= tolerance) return e
  }
  if (snap > 0) return Math.round(value / snap) * snap
  return Math.round(value)
}