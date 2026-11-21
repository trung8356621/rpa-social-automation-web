import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { AccountItem } from '@/features/accounts/types'
import type { ScriptDetail, ScriptListItem } from '@/features/script-registry/types'

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
import { contentListPreview } from '../shortcode-source'
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
}: Props) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [attempts, setAttempts] = useState<CampaignJobAttempt[]>([])
  const [attemptsError, setAttemptsError] = useState<string | null>(null)

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
  const s = campaign.summary

  useEffect(() => {
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
  }, [campaign.id, loadAttempts])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const confirmStart = () => {
    if (isV2 || !startGate.ok) {
      if (!isV2) window.alert(startGate.reasons.join('\n'))
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
    void run(() => onStart(campaign.id))
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
      <PageHeader
        title={campaign.name}
        description={`Campaign · ${campaign.id}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {isV2 ? <Badge variant="primary">PLAN V2</Badge> : null}
            {campaign.run_mode === 'test' ? (
              <Badge variant="warning">TEST MODE</Badge>
            ) : (
              <Badge variant="danger">LIVE MODE</Badge>
            )}
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

      <section className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {(
          [
            ['Total', s.total],
            ['Pending', s.pending],
            ['Waiting', s.waiting_resources],
            ['Running', s.running],
            ['Success', s.success],
            ['Failed Locked', s.failed_locked],
            ['Unknown', s.unknown],
            ['Skipped', s.skipped],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2"
          >
            <div className="text-[11px] text-muted">{label}</div>
            <div className="font-mono text-sm font-semibold">{value}</div>
          </div>
        ))}
      </section>

      {isV2 ? (
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Plan V2 — Action Tags &amp; Pinned Releases (
              {campaign.action_tags?.length ?? 0})
            </h2>
            <span className="text-xs text-muted">
              Account-free Draft · {contents.length || campaign.summary.total}{' '}
              Content item(s)
            </span>
          </div>
          {campaign.action_tags && campaign.action_tags.length > 0 ? (
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
          ) : (
            <p className="text-xs text-muted">No Action Tags returned.</p>
          )}
        </section>
      ) : (
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
          <h2 className="text-sm font-semibold">Configuration</h2>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Platform</dt>
              <dd>
                {campaign.site_name} ({campaign.site_key})
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Script</dt>
              <dd
                className={
                  scriptDisplay.state === 'missing'
                    ? 'text-xs text-warning'
                    : 'text-sm'
                }
              >
                {scriptDisplay.label}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Pinned Account</dt>
              <dd
                className={
                  pinnedAccount.state === 'missing'
                    ? 'text-xs text-warning'
                    : 'text-sm'
                }
              >
                {pinnedAccount.label}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Run Mode</dt>
              <dd>{runModeLabel(campaign.run_mode)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Execution Mode</dt>
              <dd>{executionModeLabel(campaign.execution_mode)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Schedule</dt>
              <dd>{formatScheduleLabel(campaign.schedule)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={isV2 || busy || !startGate.ok}
          onClick={confirmStart}
          title={
            isV2
              ? 'V2 Campaign execution is not implemented yet.'
              : mode === 'live'
                ? 'Sends POST …/start. Client Runtime Claim must be approved separately.'
                : undefined
          }
        >
          Start
        </Button>
        {campaign.allowed_actions.includes('pause') ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Pause this campaign?')) return
              void run(() => onPause(campaign.id))
            }}
          >
            Pause
          </Button>
        ) : null}
        {campaign.allowed_actions.includes('resume') ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Resume this campaign?')) return
              void run(() => onResume(campaign.id))
            }}
          >
            Resume
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
              void run(() => onCancel(campaign.id))
            }}
          >
            Cancel
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

      {!startGate.ok ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-warning">
          {startGate.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Content List</h2>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs text-muted">
              <tr>
                <th className="px-3 py-2">Content</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Assigned Account</th>
                <th className="px-3 py-2">Current Job</th>
                <th className="px-3 py-2">Last Result</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contentsError ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-danger">
                    Failed to load Content list. {contentsError}
                  </td>
                </tr>
              ) : campaign.summary.total === 0 && contents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    Zero Content — Start disabled until Articles are added.
                  </td>
                </tr>
              ) : contents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    Content rows not loaded yet (summary.total=
                    {campaign.summary.total}).
                  </td>
                </tr>
              ) : (
                contents.map((c) => {
                  const cs = contentStatusBadge(c.status)
                  const pinUnavailable = isPinnedAccountUnavailable(c)
                  return (
                    <tr key={c.id} className="border-b border-border">
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs">{c.external_ref}</div>
                        <div className="text-[11px] text-muted">
                          {c.source_format}
                          {c.mapping_version != null
                            ? ` · v${c.mapping_version}`
                            : ''}
                        </div>
                        <div className="line-clamp-2 font-mono text-xs text-muted">
                          {contentListPreview(c) || '(empty)'}
                        </div>
                        {c.assignments && c.assignments.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.assignments.map((a, idx) => (
                              <Badge
                                key={`${a.action_tag_key}-${idx}`}
                                variant="neutral"
                              >
                                {a.action_tag_key} · {a.script_package_key} v
                                {a.script_version}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <Badge variant={cs.variant}>{cs.label}</Badge>
                          {pinUnavailable ||
                          c.status === 'waiting_resources' ? (
                            <span className="text-[11px] text-warning">
                              {pinUnavailable
                                ? 'pinned_account_unavailable — no fallback'
                                : 'waiting_resources'}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {(() => {
                          const assigned = resolveAccountDisplay(
                            accounts,
                            c.assigned_account_id ?? campaign.account_id,
                            { loading: accountsLoading },
                          )
                          if (assigned.state === 'empty') return '—'
                          return (
                            <span
                              className={
                                assigned.state === 'missing'
                                  ? 'text-warning'
                                  : undefined
                              }
                            >
                              {assigned.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {c.current_job_id ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.last_error_code || c.last_error_message ? (
                          <span
                            className={
                              pinUnavailable ? 'text-warning' : 'text-danger'
                            }
                          >
                            {[c.last_error_code, c.last_error_message]
                              .filter(Boolean)
                              .join(': ')}
                          </span>
                        ) : (
                          (c.last_result ?? '—')
                        )}
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
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Execution History</h2>
        {attemptsError ? (
          <p className="text-xs text-muted">{attemptsError}</p>
        ) : null}
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs text-muted">
              <tr>
                <th className="px-3 py-2">Attempt</th>
                <th className="px-3 py-2">Content</th>
                <th className="px-3 py-2">Agent / Browser</th>
                <th className="px-3 py-2">Start / End</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2">Artifacts</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    No job attempts yet.
                  </td>
                </tr>
              ) : (
                attempts.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="px-3 py-2 font-mono text-xs">#{a.attempt}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {a.content_id}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {a.agent_label ?? '—'} / {a.browser_label ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {a.started_at ?? '—'}
                      <br />
                      {a.ended_at ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-danger">
                      {a.error ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
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
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
        <h2 className="text-sm font-semibold">Technical Details</h2>
        <dl className="mt-2 grid gap-2 font-mono text-[11px] text-muted sm:grid-cols-2">
          <div>
            <dt>Campaign ID</dt>
            <dd className="text-foreground">{campaign.id || '—'}</dd>
          </div>
          <div>
            <dt>Script package / id</dt>
            <dd className="text-foreground">
              {scriptDisplay.packageKey || campaign.script_package_key || '—'}
            </dd>
          </div>
          <div>
            <dt>Script version</dt>
            <dd className="text-foreground">
              {scriptDisplay.version || campaign.script_version || '—'}
            </dd>
          </div>
          <div>
            <dt>Pinned account_id</dt>
            <dd className="text-foreground">
              {pinnedAccount.accountId ?? campaign.account_id ?? '—'}
            </dd>
          </div>
          {contents.map((c) => (
            <div key={`tech-acc-${c.id}`} className="sm:col-span-2">
              <dt>Content {c.external_ref || c.id} · assigned_account_id</dt>
              <dd className="text-foreground">
                {c.assigned_account_id ?? '—'}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
