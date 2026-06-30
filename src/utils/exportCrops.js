import JSZip from 'jszip'

/**
 * Render a single crop rectangle (in source-image px space) to a Blob.
 * @param {HTMLImageElement} image
 * @param {{x,y,w,h}} rect
 * @param {'png'|'jpg'} format
 * @param {number} quality - 0..1, only used for jpg
 */
export function renderCropBlob(image, rect, format = 'png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    const w = Math.max(1, Math.round(rect.w))
    const h = Math.max(1, Math.round(rect.h))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return reject(new Error('Canvas not supported'))
    ctx.drawImage(image, rect.x, rect.y, w, h, 0, 0, w, h)
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to render crop'))
      },
      mime,
      format === 'jpg' ? quality : undefined
    )
  })
}

/** Build the default filename for a crop, e.g. crop_3_700x300.png */
export function buildFilename(crop, format) {
  const ext = format === 'jpg' ? 'jpg' : 'png'
  const base =
    crop.name && crop.name.trim().length > 0
      ? crop.name.trim().replace(/[^a-zA-Z0-9_\-]+/g, '_')
      : `crop_${crop.index}_${Math.round(crop.w)}x${Math.round(crop.h)}`
  return `${base}.${ext}`
}

/**
 * Render every crop and bundle into a ZIP, triggering a browser download.
 * @param {HTMLImageElement} image
 * @param {Array} crops - rects with {index, x, y, w, h, name?}
 * @param {'png'|'jpg'} format
 * @param {number} quality
 * @param {(done:number, total:number) => void} onProgress
 */
export async function downloadAllAsZip(image, crops, format, quality, onProgress) {
  const zip = new JSZip()
  for (let i = 0; i < crops.length; i++) {
    const crop = crops[i]
    const blob = await renderCropBlob(image, crop, format, quality)
    zip.file(buildFilename(crop, format), blob)
    onProgress?.(i + 1, crops.length)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  triggerDownload(content, 'cropgrid_export.zip')
}

/** Download one crop as a single file. */
export async function downloadSingleCrop(image, crop, format, quality) {
  const blob = await renderCropBlob(image, crop, format, quality)
  triggerDownload(blob, buildFilename(crop, format))
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
