import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toSafeApiMessage } from '@/lib/api/errors'

import type { AccountItem } from '@/features/accounts/types'
import type { ScriptDetail, ScriptListItem } from '@/features/script-registry/types'

import { isScreenshotArtifact } from '../campaign-artifacts'
import {
  canEditActionTagInterval,
  validateInlineIntervalInput,
} from '../campaign-interval-edit'
import {
  resolveContentQueueFeedback,
  resolveEffectiveContentStatus,
} from '../campaign-queue-status'
import {
  deriveArticleCounts,
  deriveCampaignStatusMessage,
  formatSchedulerTimestamp,
  groupAttemptsByContent,
  groupErrorsBySite,
  resolveAttemptFailureDisplay,
  resolveContentTitle,
  resolveContentUuid,
  resolveSiteForContent,
} from '../campaign-detail-view'
import {
  resolveAccountDisplay,
  resolveScriptDisplay,
} from '../display-resolve'
import { formatScheduleLabel } from '../schedule'
import {
  campaignStatusBadge,
  contentStatusBadge,
  executionModeLabel,
  runModeLabel,
} from '../status-labels'
import {
  RETRY_WARNING,
  UNKNOWN_RETRY_WARNING,
  canStartCampaign,
  isCampaignV2,
} from '../validation'
import type {
  Campaign,
  CampaignContent,
  CampaignJobAttempt,
} from '../types'
import { AttemptScreenshot } from './AttemptScreenshot'
import {
  ScreenshotPreviewModal,
  type ScreenshotPreviewData,
} from './ScreenshotPreviewModal'

type Props = {
  campaign: Campaign
  contents: CampaignContent[]
  /** Content list GET failure — never treat as zero Content. */
  contentsError?: string | null
  testCompatible: boolean | null
  mode: 'mock' | 'live'
  liveBlockedReason: string | null
  accounts: AccountItem[]
  accountsLoading?: boolean
  scripts: ScriptListItem[]
  scriptsLoading?: boolean
  scriptDetail?: ScriptDetail | null
  onStart: (id: string) => Promise<unknown>
  onPause: (id: string) => Promise<unknown>
  onResume: (id: string) => Promise<unknown>
  onCancel: (id: string) => Promise<unknown>
  onUpdateActionTagInterval?: (
    campaignId: string,
    actionTagKey: string,
    intervalMinutes: number,
  ) => Promise<unknown>
  onRetry: (id: string, status: string) => Promise<unknown>
  onSkip: (id: string) => Promise<unknown>
  onCancelContent: (id: string) => Promise<unknown>
  loadAttempts: (campaignId: string) => Promise<CampaignJobAttempt[]>
  /** Admin/Owner role — gates collapsed Technical Details section. */
  isAdmin?: boolean
}

export function CampaignDetailScreen({
  campaign,
  contents,
  contentsError = null,
  testCompatible,
  mode,
  liveBlockedReason,
  accounts,
  accountsLoading = false,
  scripts,
  scriptsLoading = false,
  scriptDetail = null,
  onStart,
  onPause,
  onResume,
  onCancel,
  onUpdateActionTagInterval,
  onRetry,
  onSkip,
  onCancelContent,
  loadAttempts,
  isAdmin = false,
}: Props) {
  const navigate = useNavigate()
  const [busyAction, setBusyAction] = useState<
    'start' | 'pause' | 'resume' | 'cancel' | 'other' | null
  >(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<CampaignJobAttempt[]>([])
  const [attemptsError, setAttemptsError] = useState<string | null>(null)
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [techExpanded, setTechExpanded] = useState(false)
  const [screenshotPreview, setScreenshotPreview] =
    useState<ScreenshotPreviewData | null>(null)
  const [editingTagKey, setEditingTagKey] = useState<string | null>(null)
  const [intervalDraft, setIntervalDraft] = useState('')
  const [intervalError, setIntervalError] = useState<string | null>(null)
  const [savingInterval, setSavingInterval] = useState(false)
  const savingIntervalRef = useRef(false)
  const attemptsInFlightRef = useRef(false)
  const busy = busyAction !== null
  const canEditInterval = canEditActionTagInterval(
    campaign,
    Boolean(onUpdateActionTagInterval),
  )

  const toggleContentHistory = (contentId: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(contentId)) next.delete(contentId)
      else next.add(contentId)
      return next
    })
  }

  const isV2 = useMemo(() => isCampaignV2(campaign), [campaign])

  const startGate = useMemo(
    () => canStartCampaign(campaign, contents, testCompatible),
    [campaign, contents, testCompatible],
  )

  const pinnedAccount = useMemo(
    () =>
      resolveAccountDisplay(accounts, campaign.account_id, {
        loading: accountsLoading,
      }),
    [accounts, accountsLoading, campaign.account_id],
  )

  const scriptDisplay = useMemo(
    () =>
      resolveScriptDisplay(
        scripts,
        campaign.script_package_key,
        campaign.script_version,
        { loading: scriptsLoading, detail: scriptDetail },
      ),
    [
      campaign.script_package_key,
      campaign.script_version,
      scriptDetail,
      scripts,
      scriptsLoading,
    ],
  )

  const st = campaignStatusBadge(campaign.status)
  const counts = useMemo(
    () => deriveArticleCounts(campaign.summary),
    [campaign.summary],
  )
  const statusMessage = useMemo(
    () => deriveCampaignStatusMessage(campaign, counts),
    [campaign, counts],
  )
  const groupedSiteErrors = useMemo(
    () => groupErrorsBySite(campaign, contents),
    [campaign, contents],
  )
  const attemptsByContent = useMemo(
    () => groupAttemptsByContent(contents, attempts),
    [contents, attempts],
  )

  useEffect(() => {
    if (attemptsInFlightRef.current) return
    let cancelled = false
    attemptsInFlightRef.current = true
    void loadAttempts(campaign.id)
      .then((rows) => {
        if (!cancelled) {
          setAttempts(rows)
          setAttemptsError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // Preserve existing attempts on temporary network failure.
          setAttemptsError(
            err instanceof Error ? err.message : 'Failed to load attempts',
          )
        }
      })
      .finally(() => {
        attemptsInFlightRef.current = false
      })
    return () => {
      cancelled = true
    }
  }, [campaign.id, campaign.status, campaign.updated_at, contents, loadAttempts])

  const run = async (
    fn: () => Promise<unknown>,
    action: 'start' | 'pause' | 'resume' | 'cancel' | 'other' = 'other',
  ) => {
    setBusyAction(action)
    setActionError(null)
    try {
      await fn()
    } catch (err: unknown) {
      setActionError(toSafeApiMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const handleSaveInterval = async (actionTagKey: string) => {
    if (!onUpdateActionTagInterval || savingIntervalRef.current) return
    const check = validateInlineIntervalInput(intervalDraft)
    if (!check.ok) {
      setIntervalError(check.message)
      return
    }
    savingIntervalRef.current = true
    setSavingInterval(true)
    setIntervalError(null)
    try {
      await onUpdateActionTagInterval(campaign.id, actionTagKey, check.value)
      setEditingTagKey(null)
    } catch (err: unknown) {
      setIntervalError(toSafeApiMessage(err))
    } finally {
      savingIntervalRef.current = false
      setSavingInterval(false)
    }
  }

  const confirmStart = () => {
    if (!startGate.ok) {
      window.alert(startGate.reasons.join('\n'))
      return
    }
    if (campaign.run_mode === 'live') {
      if (
        !window.confirm(
          'Start LIVE Mode campaign? Content may be published according to Script behavior.',
        )
      ) {
        return
      }
    } else if (!window.confirm('Start Test Mode campaign?')) {
      return
    }
    void run(() => onStart(campaign.id), 'start')
  }

  const lastCheckLabel = formatSchedulerTimestamp(
    campaign.last_recheck_at ?? campaign.resource_diagnostics?.last_checked_at,
    'Not checked yet',
  )
  const nextCheckLabel = formatSchedulerTimestamp(
    campaign.next_recheck_at ?? campaign.resource_diagnostics?.next_recheck_at,
    'Not scheduled',
  )
  const eligibleClientsValue =
    campaign.eligible_clients_count != null
      ? campaign.eligible_clients_count
      : (campaign.resource_diagnostics?.eligible_clients_count ?? null)

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
      <PageHeader
        title={campaign.name}
        description="Campaign Overview"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/social-automation/campaigns')}
            >
              Back
            </Button>
          </div>
        }
      />

      {liveBlockedReason ? (
        <p className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          {liveBlockedReason}
        </p>
      ) : null}

      <section
        aria-label="Campaign Status Message"
        className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 text-sm"
      >
        {statusMessage}
      </section>

      <section
        aria-label="Scheduler Status"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
          <div className="text-xs text-muted">Campaign Status</div>
          <div className="mt-1">
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
          <div className="text-xs text-muted">Last Resource Check</div>
          <div className="mt-1 text-sm font-medium">{lastCheckLabel}</div>
          <div className="mt-0.5 text-[11px] text-muted">
            Scheduler evaluation (distinct from Client heartbeat)
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
          <div className="text-xs text-muted">Next Scheduled Check</div>
          <div className="mt-1 text-sm font-medium">{nextCheckLabel}</div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
          <div className="text-xs text-muted">Eligible Clients</div>
          <div className="mt-1 font-mono text-base font-semibold">
            {eligibleClientsValue != null ? eligibleClientsValue : '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            From scheduler evaluation
          </div>
        </div>
      </section>

      {isV2 && campaign.action_tags && campaign.action_tags.length > 0 ? (
        <section
          aria-label="Action Tag Intervals"
          className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3"
        >
          <div className="mb-2 text-xs font-medium text-muted">
            Action Tags &amp; Posting Interval
          </div>
          <div className="flex flex-wrap gap-2">
            {campaign.action_tags.map((tag) => {
              const isEditing =
                canEditInterval && editingTagKey === tag.action_tag_key
              return (
                <div
                  key={tag.action_tag_key}
                  className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-border bg-surface-muted/40 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium text-foreground">
                      {tag.action_tag_key}
                    </span>
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          disabled={savingInterval}
                          className="h-7 w-24 font-mono text-xs"
                          aria-label={`Interval minutes for ${tag.action_tag_key}`}
                          value={intervalDraft}
                          onChange={(e) => {
                            setIntervalDraft(e.target.value)
                            if (intervalError) setIntervalError(null)
                          }}
                        />
                        <span className="text-muted">phút</span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingInterval}
                          onClick={() =>
                            void handleSaveInterval(tag.action_tag_key)
                          }
                        >
                          {savingInterval ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={savingInterval}
                          onClick={() => {
                            setEditingTagKey(null)
                            setIntervalError(null)
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Badge variant="neutral">
                          {tag.interval_minutes ?? 0} phút
                        </Badge>
                        {canEditInterval ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-muted hover:text-foreground"
                            aria-label={`Edit interval for ${tag.action_tag_key}`}
                            onClick={() => {
                              setEditingTagKey(tag.action_tag_key)
                              setIntervalDraft(
                                String(tag.interval_minutes ?? 0),
                              )
                              setIntervalError(null)
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        ) : null}
                      </>
                    )}
                    {tag.next_run_at ? (
                      <span className="text-[11px] text-muted">
                        Next eligible:{' '}
                        {formatSchedulerTimestamp(tag.next_run_at, '—')}
                      </span>
                    ) : null}
                  </div>
                  {isEditing && intervalError ? (
                    <div role="alert" className="text-[11px] text-danger">
                      {intervalError}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section
        aria-label="Article Summary"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {(
          [
            ['Waiting Articles', counts.waiting],
            ['Running Articles', counts.running],
            ['Successful Articles', counts.successful],
            ['Failed Articles', counts.failed],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3"
          >
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || !startGate.ok}
          onClick={confirmStart}
          title={
            mode === 'live'
              ? 'Sends POST …/start. Backend Scheduler evaluates resource availability; no Client needs to be online.'
              : undefined
          }
        >
          {busyAction === 'start' ? 'Starting…' : 'Start'}
        </Button>
        {campaign.allowed_actions.includes('pause') ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Pause this campaign?')) return
              void run(() => onPause(campaign.id), 'pause')
            }}
          >
            {busyAction === 'pause' ? 'Pausing…' : 'Pause'}
          </Button>
        ) : null}
        {campaign.allowed_actions.includes('resume') ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Resume this campaign?')) return
              void run(() => onResume(campaign.id), 'resume')
            }}
          >
            {busyAction === 'resume' ? 'Resuming…' : 'Resume'}
          </Button>
        ) : null}
        {campaign.allowed_actions.includes('cancel') ? (
          <Button
            size="sm"
            variant="outline"
            className="text-danger"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Cancel this campaign?')) return
              void run(() => onCancel(campaign.id), 'cancel')
            }}
          >
            {busyAction === 'cancel' ? 'Cancelling…' : 'Cancel'}
          </Button>
        ) : null}
        {campaign.status === 'draft' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigate(
                isV2
                  ? `/social-automation/campaigns/${campaign.id}/edit`
                  : `/social-automation/articles?campaign=${campaign.id}`,
              )
            }
          >
            {isV2 ? 'Assign Articles' : 'Manage Articles'}
          </Button>
        ) : null}
      </section>

      {actionError ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {actionError}
        </div>
      ) : null}

      {!startGate.ok ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-warning">
          {startGate.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      <section
        aria-label="Campaign Contents"
        className="rounded-[var(--radius-card)] border border-border bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Campaign Contents</h2>
            <p className="text-xs text-muted">
              Article status, identifiers, and per-content execution history.
            </p>
          </div>
          <span className="font-mono text-xs text-muted">
            {contents.length} item(s)
          </span>
        </div>

        {contentsError ? (
          <div className="px-4 py-4 text-center text-xs text-danger">
            Failed to load Content list. {contentsError}
          </div>
        ) : contents.length === 0 ? (
          <div className="px-4 py-4 text-center text-xs text-muted">
            No content rows loaded (summary.total={campaign.summary.total}).
          </div>
        ) : (
          <div className="divide-y divide-border">
            {contents.map((c) => {
              const effectiveStatus = resolveEffectiveContentStatus(c)
              const cs = contentStatusBadge(effectiveStatus)
              const site = resolveSiteForContent(campaign, c)
              const assigned = resolveAccountDisplay(
                accounts,
                c.assigned_account_id ?? campaign.account_id,
                { loading: accountsLoading },
              )
              const accountLabel =
                assigned.state === 'resolved'
                  ? assigned.label
                  : c.assigned_account_label?.trim() ||
                    (assigned.state === 'empty' ? null : assigned.label)
              const contentTitle = resolveContentTitle(c)
              const contentUuid = resolveContentUuid(c)
              const contentAttempts = attemptsByContent.get(c.id) ?? []
              const historyExpanded = expandedHistoryIds.has(c.id)
              const queueFeedback = resolveContentQueueFeedback(c)

              return (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-foreground">
                        {contentTitle}
                      </div>
                      <div className="font-mono text-[11px] text-muted">
                        UUID: {contentUuid}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>
                          Site:{' '}
                          <span className="text-foreground">
                            {site.site_name}
                          </span>
                          {site.site_key && site.site_key !== site.site_name ? (
                            <span className="font-mono text-[11px]">
                              {' '}
                              ({site.site_key})
                            </span>
                          ) : null}
                        </span>
                        {accountLabel ? (
                          <span>
                            Account:{' '}
                            <span className="text-foreground">
                              {accountLabel}
                            </span>
                          </span>
                        ) : null}
                        {c.current_job_id ? (
                          <span>
                            Current Job:{' '}
                            <span className="font-mono text-foreground">
                              {c.current_job_id}
                            </span>
                          </span>
                        ) : null}
                      </div>
                      {queueFeedback.kind !== 'none' ? (
                        <div
                          className={
                            queueFeedback.kind === 'error'
                              ? 'text-xs text-danger'
                              : queueFeedback.kind === 'warning'
                                ? 'text-xs text-warning'
                                : 'text-xs text-primary'
                          }
                        >
                          {queueFeedback.message ? (
                            <span>{queueFeedback.message}</span>
                          ) : null}
                          {queueFeedback.code &&
                          queueFeedback.code !== queueFeedback.message ? (
                            <span className="ml-1.5 font-mono text-[11px]">
                              [{queueFeedback.code}]
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Badge variant={cs.variant}>{cs.label}</Badge>
                      {isAdmin ? (
                        <>
                          {c.status === 'failed_locked' ||
                          c.status === 'unknown' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                const msg =
                                  c.status === 'unknown'
                                    ? `${UNKNOWN_RETRY_WARNING}\n\n${RETRY_WARNING}`
                                    : RETRY_WARNING
                                if (!window.confirm(msg)) return
                                void run(() => onRetry(c.id, c.status))
                              }}
                            >
                              Retry
                            </Button>
                          ) : null}
                          {c.status === 'failed_locked' ||
                          c.status === 'unknown' ||
                          effectiveStatus === 'pending' ||
                          effectiveStatus === 'waiting_interval' ||
                          effectiveStatus === 'waiting_resources' ||
                          effectiveStatus === 'blocked_by_failure' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  if (!window.confirm('Skip this content?'))
                                    return
                                  void run(() => onSkip(c.id))
                                }}
                              >
                                Skip
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-danger"
                                disabled={busy}
                                onClick={() => {
                                  if (!window.confirm('Cancel this content?'))
                                    return
                                  void run(() => onCancelContent(c.id))
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-expanded={historyExpanded}
                        onClick={() => toggleContentHistory(c.id)}
                      >
                        {historyExpanded
                          ? 'Hide History'
                          : `Execution History (${contentAttempts.length})`}
                      </Button>
                    </div>
                  </div>

                  {historyExpanded ? (
                    <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-surface-muted/40 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        Execution History
                      </div>
                      {attemptsError ? (
                        <p className="mb-2 text-xs text-danger">
                          {attemptsError}
                        </p>
                      ) : null}
                      {contentAttempts.length === 0 ? (
                        <p className="text-xs text-muted">
                          No execution attempts recorded yet.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {contentAttempts.map((a, idx) => {
                            const ast = contentStatusBadge(a.status)
                            const failure = resolveAttemptFailureDisplay(a)
                            const attemptNumber =
                              a.attempt > 0 ? a.attempt : idx + 1
                            const jobUuid = a.job_uuid ?? a.job_id ?? '—'
                            const attemptUuid = a.attempt_uuid ?? a.id ?? '—'
                            const agentUuid =
                              a.agent_uuid ?? a.agent_label ?? null
                            const browserUuid =
                              a.browser_uuid ?? a.browser_label ?? null

                            return (
                              <div
                                key={a.attempt_uuid ?? a.id ?? `${c.id}-${idx}`}
                                className="rounded-[var(--radius-control)] border border-border bg-surface p-2.5 text-xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 font-medium">
                                    <span>Attempt #{attemptNumber}</span>
                                    <Badge variant={ast.variant}>
                                      {ast.label}
                                    </Badge>
                                  </div>
                                  <div className="text-[11px] text-muted">
                                    {formatSchedulerTimestamp(
                                      a.started_at,
                                      '—',
                                    )}
                                    {a.ended_at
                                      ? ` → ${formatSchedulerTimestamp(a.ended_at, '—')}`
                                      : ''}
                                  </div>
                                </div>

                                {failure.reason ? (
                                  <div className="mt-1.5 text-xs text-danger">
                                    {failure.reason}
                                  </div>
                                ) : null}

                                {failure.stepLabel || failure.errorCode ? (
                                  <div className="mt-1 font-mono text-[11px] text-muted">
                                    {[failure.stepLabel, failure.errorCode]
                                      .filter(Boolean)
                                      .join(' — ')}
                                  </div>
                                ) : null}

                                <dl className="mt-2 grid gap-x-4 gap-y-1 font-mono text-[11px] text-muted sm:grid-cols-2">
                                  <div>
                                    <dt className="inline">Job UUID: </dt>
                                    <dd className="inline text-foreground">
                                      {jobUuid}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="inline">Attempt UUID: </dt>
                                    <dd className="inline text-foreground">
                                      {attemptUuid}
                                    </dd>
                                  </div>
                                  {agentUuid ? (
                                    <div>
                                      <dt className="inline">Agent UUID: </dt>
                                      <dd className="inline text-foreground">
                                        {agentUuid}
                                      </dd>
                                    </div>
                                  ) : null}
                                  {browserUuid ? (
                                    <div>
                                      <dt className="inline">Browser UUID: </dt>
                                      <dd className="inline text-foreground">
                                        {browserUuid}
                                      </dd>
                                    </div>
                                  ) : null}
                                </dl>

                                {a.artifacts.length > 0 ? (
                                  <div className="mt-2.5 flex flex-wrap gap-3 text-[11px]">
                                    {a.artifacts.map((art) =>
                                      isScreenshotArtifact(art) ? (
                                        <AttemptScreenshot
                                          key={art.id}
                                          artifact={art}
                                          onPreview={setScreenshotPreview}
                                        />
                                      ) : (
                                        <span key={art.id}>
                                          <span className="text-muted">
                                            Artifact:{' '}
                                          </span>
                                          {art.url &&
                                          art.url.startsWith(
                                            '/social-automation/api/',
                                          ) ? (
                                            <a
                                              href={art.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="font-mono text-primary underline"
                                            >
                                              {art.label}
                                            </a>
                                          ) : (
                                            <span className="font-mono text-foreground">
                                              {art.label}
                                            </span>
                                          )}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {isAdmin ? (
        <section className="rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Technical Details (Admin)</h2>
              <p className="text-xs text-muted">
                Eligibility diagnostics and payload configuration.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-expanded={techExpanded}
              onClick={() => setTechExpanded((prev) => !prev)}
            >
              {techExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>

          {techExpanded ? (
            <div className="space-y-5 border-t border-border p-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Eligibility &amp; Site Errors (Grouped by Site)
                </h3>
                {campaign.resource_diagnostics?.evaluation_source ? (
                  <p className="font-mono text-[11px] text-muted">
                    evaluation_source: {campaign.resource_diagnostics.evaluation_source}
                  </p>
                ) : null}
                {groupedSiteErrors.length === 0 ? (
                  <p className="text-xs text-muted">
                    No eligibility or article errors recorded.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">Site</th>
                          <th className="px-3 py-2 font-medium">Error Code</th>
                          <th className="px-3 py-2 font-medium">Message</th>
                          <th className="px-3 py-2 font-medium">Affected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {groupedSiteErrors.map((g) => (
                          <tr key={`${g.site_key}-${g.code ?? ''}-${g.message}`}>
                            <td className="px-3 py-2">
                              <div>{g.site_name}</div>
                              <div className="font-mono text-[11px] text-muted">
                                {g.site_key}
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-danger">
                              {g.code ?? '—'}
                            </td>
                            <td className="px-3 py-2">{g.message}</td>
                            <td className="px-3 py-2 text-muted">
                              {g.article_count > 0
                                ? `${g.article_count} article(s)`
                                : 'Scheduler check'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Technical Payload Information
                </h3>
                <dl className="grid gap-2 font-mono text-[11px] text-muted sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt>Campaign ID</dt>
                    <dd className="text-foreground">{campaign.id || '—'}</dd>
                  </div>
                  <div>
                    <dt>Plan / Revision</dt>
                    <dd className="text-foreground">
                      {isV2 ? 'V2' : 'V1'}
                      {campaign.revision != null ? ` · rev ${campaign.revision}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Run / Execution Mode</dt>
                    <dd className="text-foreground">
                      {runModeLabel(campaign.run_mode)} ·{' '}
                      {executionModeLabel(campaign.execution_mode)}
                    </dd>
                  </div>
                  <div>
                    <dt>Script package / version</dt>
                    <dd className="text-foreground">
                      {scriptDisplay.packageKey || campaign.script_package_key || '—'} ·{' '}
                      {scriptDisplay.version || campaign.script_version || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Pinned account_id</dt>
                    <dd className="text-foreground">
                      {pinnedAccount.accountId ?? campaign.account_id ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Schedule</dt>
                    <dd className="text-foreground">
                      {formatScheduleLabel(campaign.schedule)}
                    </dd>
                  </div>
                </dl>

                {isV2 && campaign.action_tags && campaign.action_tags.length > 0 ? (
                  <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">Action Tag</th>
                          <th className="px-3 py-2 font-medium">Site / CMS</th>
                          <th className="px-3 py-2 font-medium">Effective Script</th>
                          <th className="px-3 py-2 font-medium">Pinned Release</th>
                          <th className="px-3 py-2 font-medium">Resolution</th>
                          <th className="px-3 py-2 font-medium">Shortcode Mapping</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {campaign.action_tags.map((tag) => (
                          <tr key={tag.action_tag_key}>
                            <td className="px-3 py-2 font-mono font-medium">
                              {tag.action_tag_key}
                            </td>
                            <td className="px-3 py-2">
                              <div>{tag.site_name}</div>
                              <div className="font-mono text-[11px] text-muted">
                                {tag.site_key}
                                {tag.cms_type ? ` · ${tag.cms_type}` : ''}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div>{tag.script_name}</div>
                              <div className="font-mono text-[11px] text-muted">
                                {tag.script_package_key}
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono">
                              v{tag.script_version || '—'}
                              {tag.release_id != null ? ` (#${tag.release_id})` : ''}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  tag.resolution_source === 'cms_global'
                                    ? 'success'
                                    : tag.resolution_source === 'site_specific'
                                      ? 'primary'
                                      : 'warning'
                                }
                              >
                                {tag.resolution_source}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-muted">
                              {tag.shortcode_mapping?.entries?.length
                                ? tag.shortcode_mapping.entries
                                    .map((e) => `[${e.shortcode}] -> ${e.variable}`)
                                    .join(', ')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <ScreenshotPreviewModal
        preview={screenshotPreview}
        onClose={() => setScreenshotPreview(null)}
      />
    </div>
  )
}
