import React, { useState } from 'react'
import UploadScreen from './components/UploadScreen'
import InitialCropOverlay from './components/InitialCropOverlay'
import MainEditor from './components/MainEditor'
import { useImageLoader } from './hooks/useImageLoader'

export default function App() {
  const { image, fileInfo, error, loadFile, reset } = useImageLoader()
  const [stage, setStage] = useState('upload') // 'upload' | 'crop-overlay' | 'editor'
  const [bounds, setBounds] = useState(null) // working region within original image

  function handleFile(file) {
    loadFile(file)
    setStage('crop-overlay')
  }

  function handleChangePhoto() {
    reset()
    setBounds(null)
    setStage('upload')
  }

  if (stage === 'upload' || !image) {
    return <UploadScreen onFile={handleFile} error={error} />
  }

  if (stage === 'crop-overlay') {
    return (
      <>
        <UploadScreen onFile={handleFile} error={error} />
        <InitialCropOverlay
          image={image}
          fileInfo={fileInfo}
          onCancel={handleChangePhoto}
          onConfirm={(rect) => {
            setBounds({
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              w: Math.round(rect.w),
              h: Math.round(rect.h),
            })
            setStage('editor')
          }}
        />
      </>
    )
  }

  return <MainEditor image={image} bounds={bounds} onChangePhoto={handleChangePhoto} />
}