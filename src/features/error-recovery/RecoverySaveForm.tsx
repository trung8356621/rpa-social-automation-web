import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { recoveryApi, recoveryError, type ErrorTag } from './api'
import type { Box } from './modal-detection.mjs'

export function RecoverySaveForm({ attemptUuid, artifactUuid, modal, target, threshold, valid }: {
  attemptUuid: string
  artifactUuid: string
  modal: Box | null
  target: Box | null
  threshold: number
  valid: boolean
}) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')
  const [tags, setTags] = useState<ErrorTag[]>([])
  const [tag, setTag] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void recoveryApi.list(controller.signal).then(({ error_tags }) => setTags(error_tags))
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(recoveryError(failure))
      })
    return () => controller.abort()
  }, [])

  async function save() {
    if (!modal || !valid || busy) return
    const toRoi = ([x, y, width, height]: Box) => ({ x, y, width, height })
    const input = {
      attempt_uuid: attemptUuid,
      artifact_uuid: artifactUuid,
      modal_roi: toRoi(modal),
      ...(target ? { target_roi: toRoi(target) } : {}),
      match_threshold: threshold,
    }
    setBusy(true)
    setMessage('')
    setError('')
    try {
      if (tag) await recoveryApi.addTemplate(tag, input)
      else {
        await recoveryApi.create({ ...input, name: name.trim(), platform: platform.trim() })
        setName('')
      }
      setMessage(tag ? 'Template saved.' : 'Error Tag saved.')
      setTags((await recoveryApi.list()).error_tags)
    } catch (failure) {
      setError(recoveryError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm">Save to
        <select className="block w-full rounded border border-border bg-surface p-1"
          value={tag} onChange={(event) => setTag(event.target.value)}>
          <option value="">New Error Tag</option>
          {tags.map((item) => <option key={item.error_tag_id} value={item.error_tag_id}>{item.name} ({item.platform})</option>)}
        </select>
      </label>
      {!tag && <>
        <label className="block text-sm">Error Tag name<Input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="block text-sm">Platform<Input value={platform} onChange={(event) => setPlatform(event.target.value)} /></label>
      </>}
      <Button size="sm" disabled={busy || !modal || !valid || (!tag && (!name.trim() || !platform.trim()))}
        onClick={() => void save()}>{tag ? 'Save template' : 'Save Error Tag'}</Button>
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Link className="block text-sm underline" to="/social-automation/error-tags">Error Tag library</Link>
    </div>
  )
}
