export type Box = [x: number, y: number, width: number, height: number]
export type Detection = {
  viewport: { width: number; height: number }
  modal: Box | null
  confidence: number | null
  buttons: { box: Box; kind: 'x' | 'confirmation'; confidence: number }[]
}
export function detectModal(cv: unknown, image: ImageData): Detection
