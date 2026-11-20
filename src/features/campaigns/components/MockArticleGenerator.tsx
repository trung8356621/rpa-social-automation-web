import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

import { toSafeApiMessage } from '@/lib/api/errors'

import type { MockPreviewResult, MockSaveResult } from '../types'

const COUNTS = [1, 5, 10, 50] as const

type Props = {
  disabled?: boolean
  onPreview: (count: number) => Promise<MockPreviewResult>
  onSave: (count: number, idempotencyKey: string) => Promise<MockSaveResult>
}

export function MockArticleGenerator({ disabled, onPreview, onSave }: Props) {
  const [count, setCount] = useState<(typeof COUNTS)[number]>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MockPreviewResult | null>(null)
  const [saveResult, setSaveResult] = useState<MockSaveResult | null>(null)

  const runPreview = async () => {
    setBusy(true)
    setError(null)
    setSaveResult(null)
    try {
      const result = await onPreview(count)
      setPreview(result)
    } catch (err) {
      setPreview(null)
      setError(toSafeApiMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const runSave = async () => {
    const key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `mock-${crypto.randomUUID()}`
        : `mock-${Date.now()}`
    setBusy(true)
    setError(null)
    try {
      const result = await onSave(count, key)
      setSaveResult(result)
      setPreview(null)
    } catch (err) {
      setError(toSafeApiMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
      <h2 className="text-sm font-semibold">Generate Mock</h2>
      <p className="text-[11px] text-muted">
        Quantity only. Backend owns generator types from Campaign mapping + Script
        schema. Preview is read-only; Save sends Idempotency-Key.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="mock_count">Quantity</Label>
          <Select
            id="mock_count"
            className="w-28"
            disabled={disabled || busy}
            value={String(count)}
            onChange={(e) =>
              setCount(Number(e.target.value) as (typeof COUNTS)[number])
            }
          >
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => void runPreview()}
        >
          Preview
        </Button>
        <Button
          size="sm"
          disabled={disabled || busy}
          onClick={() => void runSave()}
        >
          Save
        </Button>
      </div>

      {error ? <p className="text-xs text-danger whitespace-pre-wrap">{error}</p> : null}

      {preview ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Preview · count {preview.count} · mapping_version{' '}
            {preview.mapping_version} (read-only)
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {preview.articles.map((a) => (
              <li
                key={a.external_ref}
                className="rounded-[var(--radius-control)] border border-border px-2 py-1 font-mono"
              >
                <div className="text-muted">{a.external_ref}</div>
                <pre className="whitespace-pre-wrap">{a.raw_source}</pre>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveResult ? (
        <p className="text-xs text-success">
          Saved {saveResult.count} article(s)
          {saveResult.idempotent ? ' (idempotent replay)' : ''} · mapping_version{' '}
          {saveResult.mapping_version}
        </p>
      ) : null}
    </div>
  )
}
