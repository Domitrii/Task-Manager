/**
 * Photos taken as proof, e.g. of a probe showing a reading. They're shrunk to
 * a size that's quick to upload on a kitchen's signal and cheap to keep, and
 * stamped with what, when and who, so the picture still says so when it's
 * looked at on its own.
 */

/** Longest side, in pixels: the display on a probe stays readable. */
const MAX_SIDE = 1280
const QUALITY = 0.72

export async function preparePhoto(file: Blob, caption: string): Promise<Blob> {
  const image = await decode(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height))
  const width = Math.round(image.width * scale)
  const height = Math.round(image.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser can’t prepare photos.')
  context.drawImage(image.source, 0, 0, width, height)
  image.close()

  // A dark band along the bottom, so the caption reads over any picture.
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 28))
  const padding = Math.round(fontSize * 0.6)
  const band = fontSize + padding * 2
  context.fillStyle = 'rgba(0, 0, 0, 0.62)'
  context.fillRect(0, height - band, width, band)
  context.fillStyle = '#ffffff'
  context.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`
  context.textBaseline = 'middle'
  context.fillText(caption, padding, height - band / 2, width - padding * 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The photo couldn’t be saved. Try taking it again.'))),
      'image/jpeg',
      QUALITY,
    )
  })
}

interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

/** Upright, as the camera held it. */
async function decode(file: Blob): Promise<Decoded> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Some browsers can't decode every format this way; an <img> can.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined }
  } catch {
    throw new Error('That file isn’t a photo this browser can open.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
