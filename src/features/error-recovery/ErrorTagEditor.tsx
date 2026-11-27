import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'

import { Button } from '@/components/ui/button'

import { RecoverySaveForm } from './RecoverySaveForm'
import type { Box } from './modal-detection.mjs'
import { fingerprint, recognizeImage, similarity } from './recognition'

type Recognition = Awaited<ReturnType<typeof recognizeImage>>
type Drag = { box: Box; start: [number, number]; resize: boolean; target: boolean }
const fullFrame: Box = [0, 0, 1, 1]
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
const percentBox = ([x, y, w, h]: Box): CSSProperties => ({
  left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`,
})
const inside = ([x, y, w, h]: Box, [a, b, c, d]: Box) =>
  a >= x && b >= y && a + c <= x + w + 1e-8 && b + d <= y + h + 1e-8
const center = ([x, y, w, h]: Box) => [x + w / 2, y + h / 2] as const
const relative = ([x, y, w, h]: Box, [a, b, c, d]: Box): Box =>
  [(a - x) / w, (b - y) / h, c / w, d / h]

function match(source: Recognition, roi: Box, target: Box, sample: Recognition, threshold: number) {
  const { modal } = sample
  if (!modal || !inside(roi, target)) return null
  const aspect = (box: Box, image: Recognition) =>
    box[2] * image.viewport.width / (box[3] * image.viewport.height)
  if (Math.abs(Math.log(aspect(roi, source) / aspect(modal, sample))) > 0.15 ||
    similarity(fingerprint(source.canvas, roi), fingerprint(sample.canvas, modal)) < threshold) return null

  const expected = relative(roi, target)
  const candidates = sample.buttons.filter(({ box }) =>
    relative(modal, box).every((value, i) => Math.abs(value - expected[i]) <= 0.06) &&
    similarity(fingerprint(source.canvas, target), fingerprint(sample.canvas, box)) >= threshold)
  return candidates.length === 1 ? candidates[0].box : null
}

export function ErrorTagEditor({ imageUrl, title, attemptUuid, artifactUuid }: { imageUrl: string; title: string; attemptUuid: string; artifactUuid: string }) {
  const stage = useRef<HTMLDivElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const drag = useRef<Drag | null>(null)
  const [source, setSource] = useState<Recognition | null>(null)
  const [roi, setRoi] = useState<Box | null>(null)
  const [target, setTarget] = useState<Box | null>(null)
  const [threshold, setThreshold] = useState(0.95)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [sample, setSample] = useState<{ url: string; result?: Recognition; error?: string } | null>(null)

  useEffect(() => {
    if (!image.current) return
    let active = true
    void recognizeImage(image.current).then((result) => {
      if (!active) return
      setSource(result)
      setRoi(result.modal)
    }).catch((error: unknown) => {
      if (active) setSourceError(error instanceof Error ? error.message : 'Recognition failed.')
    })
    return () => { active = false }
  }, [imageUrl])

  const sampleUrl = sample?.url
  useEffect(() => {
    if (!sampleUrl) return
    let active = true
    const preview = new Image()
    preview.src = sampleUrl
    void recognizeImage(preview).then((result) => {
      if (active) setSample({ url: sampleUrl, result })
    }).catch((error: unknown) => {
      if (active) setSample({ url: sampleUrl, error: error instanceof Error ? error.message : 'Recognition failed.' })
    })
    return () => {
      active = false
      URL.revokeObjectURL(sampleUrl)
    }
  }, [sampleUrl])

  function point(event: PointerEvent): [number, number] {
    const bounds = stage.current!.getBoundingClientRect()
    return [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height]
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, box: Box, resize: boolean, isTarget: boolean) {
    if (!event.isPrimary || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { box, start: point(event), resize, target: isTarget }
  }

  function adjustBox([x, y, w, h]: Box, dx: number, dy: number, resize: boolean, isTarget: boolean) {
    const box: Box = resize
      ? [x, y, clamp(w + dx, 0.01, 1 - x), clamp(h + dy, 0.01, 1 - y)]
      : [clamp(x + dx, 0, 1 - w), clamp(y + dy, 0, 1 - h), w, h]
    if (isTarget) setTarget(box)
    else setRoi(box)
  }

  function updateDrag(event: PointerEvent) {
    const active = drag.current
    if (!active || !event.isPrimary) return
    const [px, py] = point(event)
    adjustBox(active.box, px - active.start[0], py - active.start[1], active.resize, active.target)
  }

  function adjustWithKey(event: KeyboardEvent, box: Box, resize: boolean, isTarget: boolean) {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }
    const direction = directions[event.key]
    if (!direction || !source) return
    event.preventDefault()
    const step = event.shiftKey ? 10 : 1
    adjustBox(box, direction[0] * step / source.viewport.width, direction[1] * step / source.viewport.height, resize, isTarget)
  }

  function editableBox(box: Box, isTarget = false) {
    const label = isTarget ? 'target' : 'modal'
    return (
      <div className={`pointer-events-none absolute border-2 ${isTarget ? 'border-pink-500' : 'border-cyan-400'}`} style={percentBox(box)}>
        <button type="button" aria-label={`Move ${label}`} onPointerDown={(event) => startDrag(event, box, false, isTarget)}
          onKeyDown={(event) => adjustWithKey(event, box, false, isTarget)}
          className="pointer-events-auto absolute -top-2 left-0 size-5 touch-none rounded bg-white text-xs text-black" title={`Move ${label}`}>↔</button>
        <button type="button" aria-label={`Resize ${label}`} onPointerDown={(event) => startDrag(event, box, true, isTarget)}
          onKeyDown={(event) => adjustWithKey(event, box, true, isTarget)}
          className="pointer-events-auto absolute -right-2 -bottom-2 size-5 touch-none rounded bg-white text-xs text-black" title={`Resize ${label}`}>↘</button>
      </div>
    )
  }

  const matched = source && roi && target && sample?.result ? match(source, roi, target, sample.result, threshold) : null
  const selectedInside = roi && target && inside(roi, target)
  const candidates = source?.buttons.filter(({ box }) => roi && inside(roi, box)) ?? []
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div>
          <div ref={stage} className="relative w-fit max-w-full"
            onPointerMove={updateDrag} onLostPointerCapture={() => { drag.current = null }}>
            <img ref={image} src={imageUrl} alt={title} className="block h-auto max-w-full" draggable={false} />
            {roi && editableBox(roi)}
            {candidates.map(({ box, kind }, index) => (
              <button key={box.join(',')} type="button" aria-label={`Select ${kind} candidate ${index + 1}`}
                className="absolute border-2 border-green-400 bg-green-400/10 hover:bg-green-400/40"
                style={percentBox(box)} onClick={() => setTarget(box)} />
            ))}
            {target && editableBox(target, true)}
          </div>
          <p role="status" className="mt-2 text-xs text-muted">
            {sourceError ?? (source ? source.confidence === null ? 'No modal detected.' :
              `Modal detection confidence ${Math.round(source.confidence * 100)}% (heuristic)` : 'Detecting modal and buttons…')}
          </p>
        </div>
        <div className="space-y-3">
          {source && !roi && <Button size="sm" variant="outline" onClick={() => setRoi(fullFrame)}>Set modal ROI</Button>}
          {roi && !target && <Button size="sm" variant="outline" onClick={() => {
            const [x, y, w, h] = roi
            setTarget([x + w / 3, y + h / 2, w / 3, h / 4])
          }}>Set target manually</Button>}
          {target && <Button size="sm" variant="outline" onClick={() => setTarget(null)}>Clear target</Button>}
          {target && !selectedInside && <p className="text-xs text-danger">Place the target entirely inside the modal ROI.</p>}
          <RecoverySaveForm attemptUuid={attemptUuid} artifactUuid={artifactUuid}
            modal={roi} target={target} threshold={threshold} valid={!target || Boolean(selectedInside)} />
        </div>
      </div>

      <section aria-label="Recognition preview" className="space-y-2 border-t border-border pt-3">
        <h3 className="text-sm font-semibold">Test on another screenshot</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>Visual similarity <input type="range" min="0.85" max="1" step="0.01" value={threshold}
            onChange={(event) => setThreshold(event.target.valueAsNumber)} /> {Math.round(threshold * 100)}%</label>
          <input type="file" accept="image/*" aria-label="Test screenshot" disabled={!selectedInside}
            className="max-w-full"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) setSample({ url: URL.createObjectURL(file) })
              event.target.value = ''
            }} />
        </div>
        {sample && (
          <>
            <p role="status" className="text-xs text-muted">
              {sample.error ?? (sample.result
                ? `${matched ? 'Match' : 'No Match'} · Modal confidence ${sample.result.confidence === null ? 'unavailable' : `${Math.round(sample.result.confidence * 100)}% (heuristic)`}${matched ? ` · Target center (${Math.floor(center(matched)[0] * sample.result.viewport.width)}, ${Math.floor(center(matched)[1] * sample.result.viewport.height)}) px` : ''}`
                : 'Analyzing test screenshot…')}
            </p>
            <div className="relative w-fit max-w-full">
              <img src={sample.url} alt="Recognition test screenshot" className="block h-auto max-w-full" />
              {sample.result?.modal && <div className="absolute border-2 border-cyan-400" style={percentBox(sample.result.modal)} />}
              {sample.result?.buttons.map(({ box }) => <div key={box.join(',')} className="absolute border-2 border-green-400" style={percentBox(box)} />)}
              {matched && <span aria-label="Target click center" className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500"
                style={{ left: `${center(matched)[0] * 100}%`, top: `${center(matched)[1] * 100}%` }} />}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
