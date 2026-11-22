import { useState } from 'react'
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

import {
  formatCampaignV2ApiError,
  type FormattedCampaignV2Error,
  type SchemaMappingGroup,
} from '../multi-tag-plan'

const PRESET_COUNTS = [1, 10, 20, 50, 100] as const

type Props = {
  groups: SchemaMappingGroup[]
  disabled?: boolean
  onGenerateAndSave: (
    count: number,
    groupKey: string | 'all',
  ) => Promise<void>
  onReloadCampaign?: () => Promise<void>
}

export function V2BulkMockGenerator({
  groups,
  disabled = false,
  onGenerateAndSave,
  onReloadCampaign,
}: Props) {
  const [count, setCount] = useState<number>(20)
  const [targetGroupKey, setTargetGroupKey] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [errorDetail, setErrorDetail] =
    useState<FormattedCampaignV2Error | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const anyLoading = groups.some((g) => g.loading)
  const readyGroups = groups.filter((g) => g.schema.schema_available)

  const handleGenerate = async () => {
    if (busy || disabled) return
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
      await onGenerateAndSave(qty, targetGroupKey)
      setStatusMessage(
        `Generated and saved ${qty} mock article(s) via V2 Draft PUT.`,
      )
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
            Generates N distinct sample Contents using automatic pinned Script
            variable mappings and saves in one V2 Draft PUT without overwriting
            existing Content.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
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

        <div className="min-w-[16rem] flex-1 space-y-1">
          <Label htmlFor="v2_mock_scope">Target Scope</Label>
          <Select
            id="v2_mock_scope"
            disabled={disabled || busy || groups.length === 0}
            value={targetGroupKey}
            onChange={(e) => setTargetGroupKey(e.target.value)}
          >
            <option value="all">
              All compatible Script groups ({groups.length})
            </option>
            {groups.map((g) => (
              <option key={g.group_key} value={g.group_key}>
                {g.script_name} v{g.script_version} ({g.tag_keys.join(', ')})
              </option>
            ))}
          </Select>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={
            disabled || busy || anyLoading || readyGroups.length === 0
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
