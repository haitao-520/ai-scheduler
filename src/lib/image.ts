const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.82

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('解析图片失败'))
    image.src = src
  })
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }
  const image = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width || 1, image.height || 1))
  const width = Math.max(1, Math.round((image.width || 1) * scale))
  const height = Math.max(1, Math.round((image.height || 1) * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
