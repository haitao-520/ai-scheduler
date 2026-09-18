import { Capacitor, registerPlugin } from '@capacitor/core'

interface GalleryPlugin {
  saveImage(options: { dataUrl: string; fileName: string }): Promise<{ path: string }>
}

const Gallery = registerPlugin<GalleryPlugin>('Gallery')

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function saveImageToGallery(dataUrl: string, fileName: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Gallery.saveImage({ dataUrl, fileName })
    return
  }
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function saveImageUrlToGallery(url: string, fileName: string): Promise<void> {
  const response = await fetch(url)
  const blob = await response.blob()
  const dataUrl = await blobToDataUrl(blob)
  await saveImageToGallery(dataUrl, fileName)
}
