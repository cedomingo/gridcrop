import { useCallback, useState } from 'react'

export function useImageLoader() {
  const [image, setImage] = useState(null) // HTMLImageElement
  const [fileInfo, setFileInfo] = useState(null) // { name, size, type }
  const [error, setError] = useState(null)

  const loadFile = useCallback((file) => {
    setError(null)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload a JPG, PNG, or WebP image.')
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage(img)
      setFileInfo({ name: file.name, size: file.size, type: file.type })
    }
    img.onerror = () => {
      setError('Could not read this image file. Try a different file.')
    }
    img.src = url
  }, [])

  const reset = useCallback(() => {
    setImage(null)
    setFileInfo(null)
    setError(null)
  }, [])

  return { image, fileInfo, error, loadFile, reset }
}
