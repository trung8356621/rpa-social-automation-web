import { detectModal } from './modal-detection.mjs'
import type { Box } from './modal-detection.mjs'

let openCv: Promise<unknown> | undefined

function loadOpenCv() {
  openCv ??= new Promise<unknown>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = import.meta.env.BASE_URL + 'vendor/opencv.js'
    script.onload = () => Promise.resolve((globalThis as { cv?: unknown }).cv)
      .then((cv) => {
        if (!cv) throw new Error('OpenCV initialization failed.')
        resolve(cv)
      }).catch(reject)
    script.onerror = () => reject(new Error('OpenCV could not load.'))
    document.head.append(script)
  }).catch((error) => {
    openCv = undefined
    throw error
  })
  return openCv
}

export async function recognizeImage(image: HTMLImageElement) {
  await image.decode()
  const cv = await loadOpenCv()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Screenshot pixels are unavailable.')
  context.drawImage(image, 0, 0)
  return { canvas, ...detectModal(cv, context.getImageData(0, 0, canvas.width, canvas.height)) }
}

export function fingerprint(source: HTMLCanvasElement, [x, y, w, h]: Box) {
  const sample = document.createElement('canvas')
  sample.width = sample.height = 48
  const context = sample.getContext('2d')!
  context.drawImage(source, x * source.width, y * source.height, w * source.width,
    h * source.height, 0, 0, 48, 48)
  return context.getImageData(0, 0, 48, 48).data
}

export function similarity(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let difference = 0
  for (let i = 0; i < a.length; i++) difference += Math.abs(a[i] - b[i])
  return 1 - difference / (a.length * 255)
}
