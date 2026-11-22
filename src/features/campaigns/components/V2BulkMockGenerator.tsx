import { useEffect, useState } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

import {
  formatCampaignV2ApiError,
  type FormattedCampaignV2Error,
} from '../multi-tag-plan'
import type { CampaignActionTagPlan } from '../types'

const PRESET_COUNTS = [1, 10, 20, 50, 100] as const

export type V2MockTagOption = {
  tag: CampaignActionTagPlan
  schemaReady: boolean
  loading: boolean
}

type Props = {
  tagOptions: V2MockTagOption[]
  mockCount?: number
  disabled?: boolean
  onGenerateAndSave: (count: number, actionTagKey: string) => Promise<void>
  onClearMocks?: () => Promise<void>
  onReloadCampaign?: () => Promise<void>
}

export function V2BulkMockGenerator({
  tagOptions,
  mockCount = 0,
  disabled = false,
  onGenerateAndSave,
  onClearMocks,
  onReloadCampaign,
}: Props) {
  const [count, setCount] = useState<number>(20)
  const [selectedTagKey, setSelectedTagKey] = useState<string>(
    tagOptions[0]?.tag.action_tag_key ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [errorDetail, setErrorDetail] =
    useState<FormattedCampaignV2Error | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (tagOptions.length === 0) {
      setSelectedTagKey('')
      return
    }
    if (!tagOptions.some((o) => o.tag.action_tag_key === selectedTagKey)) {
      setSelectedTagKey(tagOptions[0]!.tag.action_tag_key)
    }
  }, [tagOptions, selectedTagKey])

  const selectedOption =
    tagOptions.find((o) => o.tag.action_tag_key === selectedTagKey) ?? null

  const handleGenerate = async () => {
    if (busy || disabled || !selectedTagKey) return
    const qty = Math.floor(count)
    if (!Number.isFinite(qty) || qty < 1) {
      setErrorDetail({
        message: 'Quantity must be at least 1.',
        status: null,
        code: 'client_validation',
        isRevisionConflict: false,
        expectedRevision: null,
        currentRevision: null,
        isStaleReleaseConflict: false,
        conflictTags: [],
        validationErrors: [],
      })
      return
    }
    setBusy(true)
    setErrorDetail(null)
    setStatusMessage(null)
    try {
      await onGenerateAndSave(qty, selectedTagKey)
      setStatusMessage(
        `Generated and saved ${qty} mock article(s) for ${selectedTagKey} via V2 Draft PUT.`,
      )
    } catch (err) {
      setErrorDetail(formatCampaignV2ApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleClearMocks = async () => {
    if (!onClearMocks || busy || disabled || mockCount <= 0) return
    if (
      !window.confirm(
        `Remove ${mockCount} generated mock article(s) (external_ref starting with "mock-") from this V2 Draft Campaign? Non-mock articles and Action Tags will be preserved.`,
      )
    ) {
      return
    }
    setBusy(true)
    setErrorDetail(null)
    setStatusMessage(null)
    try {
      await onClearMocks()
      setStatusMessage(`Removed ${mockCount} mock article(s) via V2 Draft PUT.`)
    } catch (err) {
      setErrorDetail(formatCampaignV2ApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleReload = async () => {
    if (!onReloadCampaign || busy) return
    setBusy(true)
    try {
      await onReloadCampaign()
      setErrorDetail(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            Generate Mock Articles (Campaign V2)
          </h2>
          <p className="text-[11px] text-muted">
            One Article targets exactly one selected Site / Action Tag. Generates
            N distinct sample Contents using that Tag&apos;s pinned Script
            schema and saves in one V2 Draft PUT.
          </p>
        </div>
        {mockCount > 0 && onClearMocks ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-danger"
            disabled={disabled || busy}
            onClick={() => void handleClearMocks()}
          >
            <Trash2 className="size-3.5" />
            Clear Mock Articles ({mockCount})
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[18rem] flex-1 space-y-1">
          <Label htmlFor="v2_mock_target_tag">Target Site / Action Tag</Label>
          <Select
            id="v2_mock_target_tag"
            disabled={disabled || busy || tagOptions.length === 0}
            value={selectedTagKey}
            onChange={(e) => setSelectedTagKey(e.target.value)}
          >
            {tagOptions.length === 0 ? (
              <option value="">No Action Tags in Campaign</option>
            ) : null}
            {tagOptions.map(({ tag }) => (
              <option key={tag.action_tag_key} value={tag.action_tag_key}>
                {tag.site_name} · {tag.action_tag_key} ({tag.script_name} v
                {tag.script_version})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="v2_mock_qty">Quantity</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="v2_mock_qty"
              type="number"
              min={1}
              max={500}
              className="w-24"
              disabled={disabled || busy}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            {PRESET_COUNTS.map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={count === n ? 'default' : 'outline'}
                disabled={disabled || busy}
                onClick={() => setCount(n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={
            disabled ||
            busy ||
            !selectedOption ||
            selectedOption.loading ||
            !selectedOption.schemaReady
          }
          onClick={() => void handleGenerate()}
        >
          <Sparkles className="size-3.5" />
          {busy ? 'Generating & Saving…' : 'Generate & Save'}
        </Button>
      </div>

      {statusMessage ? (
        <p className="text-xs text-success">{statusMessage}</p>
      ) : null}

      {errorDetail ? (
        <div className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 p-2.5 space-y-1.5 text-xs">
          <p className="font-medium text-danger">{errorDetail.message}</p>
          {errorDetail.validationErrors.length > 0 ? (
            <ul className="list-disc pl-4 text-danger">
              {errorDetail.validationErrors.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          ) : null}
          {errorDetail.isRevisionConflict && onReloadCampaign ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void handleReload()}
            >
              Reload Latest Plan
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
