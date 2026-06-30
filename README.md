# CropGrid

Crop into parts — split one image into perfectly sized sections.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Project structure

```
src/
  App.jsx                     state machine: upload -> initial crop -> editor
  components/
    UploadScreen.jsx          page 1: drag-and-drop / file picker
    InitialCropOverlay.jsx    optional trim overlay shown right after upload
    MainEditor.jsx            main editor page (sidebar + canvas)
    Sidebar.jsx                mode switcher (Equal / Grid / Custom) + Crop button
    ExportOverlay.jsx         output tab: thumbnails, rename, ZIP/individual download
    modes/
      EqualSplit.jsx          3.1 — uniform columns x rows, by count or by px
      GridLayout.jsx          3.2 — px/fr cut tracks, CSS-Grid-style resolution
      CustomSections.jsx      3.3 — section list, snapping, overlap/gap warnings
    canvas/
      ImageCanvas.jsx         live preview: grid overlay + draw/resize for custom sections
  hooks/
    useImageLoader.js         File -> HTMLImageElement
  utils/
    cropMath.js               pure crop-rectangle math for all 3 modes
    exportCrops.js            canvas rendering + ZIP (JSZip) + single-file download
```

## Notes on key behaviors

- **Equal Split**: uneven divisions push the rounding remainder onto the last column/row and surface a note in the sidebar — no silent pixel loss.
- **Grid Layout**: columns/rows are entered as cut tracks (not full rectangles), each either `px` or `fr`. Resolution follows CSS Grid semantics — fixed `px` tracks are reserved first, then `fr` tracks split whatever space remains, proportionally. A live status line under each axis shows the running total against the image dimension and never silently clips.
- **Custom Sections**: draw rectangles directly on the canvas (click+drag), then fine-tune via X/Y/W/H fields in the sidebar list. Sections snap to image edges and other sections' edges. Overlaps and coverage gaps are flagged but don't block export.
- **Export**: every crop is rendered via `<canvas>` at full resolution. PNG is lossless by default; JPG exposes a quality slider. "Download All as ZIP" bundles everything via JSZip; each thumbnail is also individually downloadable on click. Filenames default to `crop_{index}_{width}x{height}.{ext}` and can be renamed per crop before export.
