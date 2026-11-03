import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'

import type { Site } from '@/features/action-tags/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import { formatScheduleLabel } from '../schedule'
import {
  campaignStatusBadge,
  executionModeLabel,
  runModeLabel,
} from '../status-labels'
import type { Campaign } from '../types'

type Props = {
  campaigns: Campaign[]
  sites: Site[]
  mode: 'mock' | 'live'
  onPause: (id: string) => Promise<unknown>
  onResume: (id: string) => Promise<unknown>
  onCancel: (id: string) => Promise<unknown>
}

export function CampaignsScreen({
  campaigns,
  sites,
  mode,
  onPause,
  onResume,
  onCancel,
}: Props) {
  const [search, setSearch] = useState('')
  const [siteKey, setSiteKey] = useState('all')
  const [runMode, setRunMode] = useState('all')
  const [executionMode, setExecutionMode] = useState('all')
  const [status, setStatus] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return campaigns.filter((c) => {
      if (siteKey !== 'all' && c.site_key !== siteKey) return false
      if (runMode !== 'all' && c.run_mode !== runMode) return false
      if (executionMode !== 'all' && c.execution_mode !== executionMode)
        return false
      if (status !== 'all' && c.status !== status) return false
      if (!q) return true
      const hay = [c.name, c.site_key, c.site_name, c.script_name, c.id]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [campaigns, search, siteKey, runMode, executionMode, status])

  const runAction = async (
    id: string,
    confirmMsg: string,
    fn: (id: string) => Promise<unknown>,
  ) => {
    if (!window.confirm(confirmMsg)) return
    setBusyId(id)
    try {
      await fn(id)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
      <PageHeader
        title="Campaigns"
        description={
          mode === 'mock'
            ? 'MOCK — Campaign Management UI. Không ghi production.'
            : 'LIVE adapter scaffold — production Campaign mutations chưa kích hoạt cho UI này.'
        }
        actions={
          <Button
            size="sm"
            onClick={() => navigate('/social-automation/campaigns/new')}
          >
            <Plus className="size-3.5" />
            Create Campaign
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted" />
          <Input
            className="pl-8"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search campaigns"
          />
        </div>
        <Select
          aria-label="Filter platform"
          className="w-40"
          value={siteKey}
          onChange={(e) => setSiteKey(e.target.value)}
        >
          <option value="all">All platforms</option>
          {sites.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter run mode"
          className="w-36"
          value={runMode}
          onChange={(e) => setRunMode(e.target.value)}
        >
          <option value="all">All run modes</option>
          <option value="test">Test</option>
          <option value="live">Live</option>
        </Select>
        <Select
          aria-label="Filter execution mode"
          className="w-44"
          value={executionMode}
          onChange={(e) => setExecutionMode(e.target.value)}
        >
          <option value="all">All execution</option>
          <option value="one_account_one_job">1:1</option>
          <option value="one_account_many_jobs">1:N</option>
        </Select>
        <Select
          aria-label="Filter status"
          className="w-36"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All status</option>
          <option value="draft">draft</option>
          <option value="scheduled">scheduled</option>
          <option value="running">running</option>
          <option value="paused">paused</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Campaign Name</th>
              <th className="px-3 py-2 font-medium">Platform</th>
              <th className="px-3 py-2 font-medium">Run Mode</th>
              <th className="px-3 py-2 font-medium">Execution Mode</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Completed</th>
              <th className="px-3 py-2 font-medium">Failed</th>
              <th className="px-3 py-2 font-medium">Waiting</th>
              <th className="px-3 py-2 font-medium">Schedule</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-8 text-center text-sm text-muted"
                >
                  No campaigns match filters.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const st = campaignStatusBadge(c.status)
                const busy = busyId === c.id
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to={`/social-automation/campaigns/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.run_mode === 'test' ? (
                        <Badge variant="warning" className="ml-2">
                          TEST
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{c.site_name || c.site_key}</td>
                    <td className="px-3 py-2">{runModeLabel(c.run_mode)}</td>
                    <td className="px-3 py-2">
                      {executionModeLabel(c.execution_mode)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {c.summary.total}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {c.summary.completed || c.summary.success}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {c.summary.failed || c.summary.failed_locked}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {c.summary.waiting || c.summary.waiting_resources}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatScheduleLabel(c.schedule)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(`/social-automation/campaigns/${c.id}`)
                          }
                        >
                          View
                        </Button>
                        {c.allowed_actions.includes('edit') ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(
                                `/social-automation/campaigns/${c.id}/edit`,
                              )
                            }
                          >
                            Edit
                          </Button>
                        ) : null}
                        {c.allowed_actions.includes('pause') ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                c.id,
                                `Pause campaign "${c.name}"?`,
                                onPause,
                              )
                            }
                          >
                            Pause
                          </Button>
                        ) : null}
                        {c.allowed_actions.includes('resume') ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                c.id,
                                `Resume campaign "${c.name}"?`,
                                onResume,
                              )
                            }
                          >
                            Resume
                          </Button>
                        ) : null}
                        {c.allowed_actions.includes('cancel') ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-danger"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                c.id,
                                `Cancel campaign "${c.name}"? This cannot be undone in UI.`,
                                onCancel,
                              )
                            }
                          >
                            Cancel
                          </Button>
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
  )
}
