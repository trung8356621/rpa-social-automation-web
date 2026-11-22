import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toSafeApiMessage } from '@/lib/api/errors'

import type { AccountItem } from '@/features/accounts/types'
import type { ScriptDetail, ScriptListItem } from '@/features/script-registry/types'

import {
  deriveArticleCounts,
  deriveCampaignStatusMessage,
  formatSchedulerTimestamp,
  groupErrorsBySite,
} from '../campaign-detail-view'
import {
  resolveAccountDisplay,
  resolveScriptDisplay,
} from '../display-resolve'
import { formatScheduleLabel } from '../schedule'
import { contentListPreview } from '../shortcode-source'
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
  isPinnedAccountUnavailable,
} from '../validation'
import type {
  Campaign,
  CampaignContent,
  CampaignJobAttempt,
} from '../types'

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
  const [techExpanded, setTechExpanded] = useState(false)
  const busy = busyAction !== null

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

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    void loadAttempts(campaign.id)
      .then((rows) => {
        if (!cancelled) {
          setAttempts(rows)
          setAttemptsError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAttempts([])
          setAttemptsError(
            err instanceof Error ? err.message : 'Failed to load attempts',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [campaign.id, isAdmin, loadAttempts])

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
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            navigate(`/social-automation/articles?campaign=${campaign.id}`)
          }
        >
          Manage Articles
        </Button>
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

      {isAdmin ? (
        <section className="rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Technical Details (Admin)</h2>
              <p className="text-xs text-muted">
                Execution history, UUIDs, eligibility diagnostics, and payload configuration.
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

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Execution History
                </h3>
                {attemptsError ? (
                  <p className="text-xs text-muted">{attemptsError}</p>
                ) : null}
                <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
                  <table className="w-full min-w-[52rem] text-left text-xs">
                    <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Attempt / Attempt UUID</th>
                        <th className="px-3 py-2 font-medium">Content</th>
                        <th className="px-3 py-2 font-medium">Agent UUID</th>
                        <th className="px-3 py-2 font-medium">Browser UUID</th>
                        <th className="px-3 py-2 font-medium">Start / End</th>
                        <th className="px-3 py-2 font-medium">Error</th>
                        <th className="px-3 py-2 font-medium">Artifacts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {attempts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-muted">
                            No job attempts yet.
                          </td>
                        </tr>
                      ) : (
                        attempts.map((a) => (
                          <tr key={a.id}>
                            <td className="px-3 py-2 font-mono">
                              <div>#{a.attempt}</div>
                              <div className="text-[11px] text-muted">
                                {a.attempt_uuid ?? a.id}
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono">{a.content_id}</td>
                            <td className="px-3 py-2 font-mono">
                              {a.agent_uuid ?? a.agent_label ?? '—'}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {a.browser_uuid ?? a.browser_label ?? '—'}
                            </td>
                            <td className="px-3 py-2">
                              {a.started_at ?? '—'}
                              <br />
                              {a.ended_at ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-danger">
                              {a.error ?? '—'}
                            </td>
                            <td className="px-3 py-2">
                              {a.artifacts.length === 0
                                ? '—'
                                : a.artifacts.map((x) => x.label).join(', ')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted">
                    Content Technical Payload &amp; Admin Actions
                  </h4>
                  <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
                    <table className="w-full min-w-[56rem] text-left text-xs">
                      <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">Content</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Assigned Account</th>
                          <th className="px-3 py-2 font-medium">Current Job</th>
                          <th className="px-3 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {contentsError ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-danger">
                              Failed to load Content list. {contentsError}
                            </td>
                          </tr>
                        ) : contents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-muted">
                              No content rows loaded (summary.total={campaign.summary.total}).
                            </td>
                          </tr>
                        ) : (
                          contents.map((c) => {
                            const cs = contentStatusBadge(c.status)
                            const pinUnavailable = isPinnedAccountUnavailable(c)
                            const assigned = resolveAccountDisplay(
                              accounts,
                              c.assigned_account_id ?? campaign.account_id,
                              { loading: accountsLoading },
                            )
                            return (
                              <tr key={c.id}>
                                <td className="px-3 py-2">
                                  <div className="font-mono">{c.external_ref || c.id}</div>
                                  <div className="text-[11px] text-muted">
                                    {c.source_format}
                                    {c.mapping_version != null
                                      ? ` · v${c.mapping_version}`
                                      : ''}
                                  </div>
                                  <div className="line-clamp-1 font-mono text-[11px] text-muted">
                                    {contentListPreview(c) || '(empty)'}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant={cs.variant}>{cs.label}</Badge>
                                  {pinUnavailable ? (
                                    <div className="mt-1 text-[11px] text-warning">
                                      pinned_account_unavailable
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 font-mono">
                                  {assigned.state === 'empty'
                                    ? '—'
                                    : assigned.accountId ?? assigned.label}
                                </td>
                                <td className="px-3 py-2 font-mono">
                                  {c.current_job_id ?? '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap gap-1">
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
                                    c.status === 'pending' ||
                                    c.status === 'waiting_resources' ? (
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
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
