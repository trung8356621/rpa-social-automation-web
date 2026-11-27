import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { recoveryApi, recoveryError, type ErrorTag, type Roi, type Template } from './api'

const roiFields = ['x', 'y', 'width', 'height'] as const

function RoiFields({ label, roi, onChange }: {
  label: string
  roi: Roi
  onChange: (roi: Roi) => void
}) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="text-sm">{label}</legend>
      {roiFields.map((key) => (
        <label key={key} className="w-24 text-sm">{key}
          <Input type="number" min="0" max="1" step="any" value={Number.isNaN(roi[key]) ? '' : roi[key]}
            onChange={(event) => onChange({ ...roi, [key]: event.target.valueAsNumber })} />
        </label>
      ))}
    </fieldset>
  )
}

function validRoi(roi: Roi) {
  return roiFields.every((key) => Number.isFinite(roi[key]) && roi[key] >= 0 && roi[key] <= 1)
    && roi.width > 0 && roi.height > 0 && roi.x + roi.width <= 1.00001 && roi.y + roi.height <= 1.00001
}

function TemplateControls({ tag, template, busy, run }: {
  tag: string
  template: Template
  busy: boolean
  run: (action: () => Promise<unknown>) => void
}) {
  const [threshold, setThreshold] = useState(String(template.match_threshold))
  const value = Number(threshold)
  const [modal, setModal] = useState(template.modal_roi)
  const [target, setTarget] = useState(template.target_roi)
  return (
    <li className="flex flex-wrap items-end gap-2 border-t border-border py-2">
      <span className="text-sm">Screenshot artifact {template.source_artifact_id} · v{template.version} · {template.enabled ? 'Enabled' : 'Disabled'}</span>
      <label className="text-sm">Threshold<Input type="number" min="0.5" max="1" step="0.01"
        value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
      <RoiFields label="Modal ROI" roi={modal} onChange={setModal} />
      {target && <RoiFields label="Target ROI" roi={target} onChange={setTarget} />}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setTarget(target ? null : { ...modal })}>
        {target ? 'Clear target ROI' : 'Add target ROI'}
      </Button>
      <Button size="sm" disabled={busy || !(value >= 0.5 && value <= 1) || !validRoi(modal) || Boolean(target && !validRoi(target))}
        onClick={() => run(() => recoveryApi.updateTemplate(tag, template.visual_template_id, {
          match_threshold: value, modal_roi: modal, target_roi: target,
        }))}>
        Save template
      </Button>
      <Button size="sm" variant="outline" disabled={busy}
        onClick={() => run(() => recoveryApi.updateTemplate(tag, template.visual_template_id, { is_enabled: !template.enabled }))}>
        {template.enabled ? 'Disable template' : 'Enable template'}
      </Button>
    </li>
  )
}

function TagControls({ tag, refresh }: { tag: ErrorTag; refresh: () => Promise<void> }) {
  const [name, setName] = useState(tag.name)
  const [release, setRelease] = useState(String(tag.handler_release_id ?? ''))
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const id = tag.error_tag_id
  const releaseId = Number(release)

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setStatus('')
    setError('')
    try {
      await action()
      setStatus('Saved.')
      await refresh()
    } catch (failure) {
      setError(recoveryError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="space-y-3 rounded border border-border p-4">
      <h2 className="font-semibold">{tag.name} · {tag.platform} · {tag.enabled ? 'Enabled' : 'Disabled'}</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Name<Input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <Button disabled={busy || !name.trim() || name.trim() === tag.name}
          onClick={() => void run(() => recoveryApi.update(id, { name: name.trim(), is_enabled: tag.enabled }))}>Rename</Button>
        <Button variant="outline" disabled={busy}
          onClick={() => void run(() => recoveryApi.update(id, { name: tag.name, is_enabled: !tag.enabled }))}>
          {tag.enabled ? 'Disable tag' : 'Enable tag'}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Published Handler Release ID<Input type="number" min="1" step="1"
          value={release} onChange={(event) => setRelease(event.target.value)} /></label>
        <Button disabled={busy || !Number.isSafeInteger(releaseId) || releaseId < 1}
          onClick={() => void run(() => recoveryApi.bind(id, releaseId))}>Bind Handler</Button>
        {tag.handler_release_id && <Button variant="outline" disabled={busy}
          onClick={() => void run(() => recoveryApi.bind(id, null))}>Unbind Handler {tag.handler_release_id}</Button>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Handler request notes<Input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <Button disabled={busy} onClick={() => void run(() => recoveryApi.request(id, notes))}>Request Handler</Button>
      </div>
      <ul>
        {tag.templates.map((template) => <TemplateControls key={template.visual_template_id + ':' + template.version}
          tag={id} template={template} busy={busy} run={(action) => void run(action)} />)}
      </ul>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
    </article>
  )
}

export function RecoveryLibrary() {
  const [tags, setTags] = useState<ErrorTag[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  async function refresh(signal?: AbortSignal) {
    const result = await recoveryApi.list(signal)
    setTags(result.error_tags)
    setLoaded(true)
  }

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(recoveryError(failure))
    })
    return () => controller.abort()
  }, [])

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Error Tag library</h1>
      {error ? <p role="alert" className="text-danger">{error}</p> :
        !loaded ? <p role="status">Loading Error Tags…</p> :
        !tags.length && <p>No Error Tags. Open a failed campaign screenshot to create one.</p>}
      {tags.map((tag) => <TagControls key={tag.error_tag_id} tag={tag} refresh={refresh} />)}
    </main>
  )
}
