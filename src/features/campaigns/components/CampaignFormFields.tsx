import { useMemo } from 'react'

import type { Site } from '@/features/action-tags/types'
import type { AccountItem } from '@/features/accounts/types'
import type { ScriptListItem } from '@/features/script-registry/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { displayScriptTitle } from '@/features/script-registry/types'

import { filterScriptsForSite } from '../script-compat'
import type { CampaignFormValues } from '../validation'
import { ExecutionModeCards } from './ExecutionModeCards'
import { RunModeCards } from './RunModeCards'
import { ScheduleForm } from './ScheduleForm'

type Props = {
  value: CampaignFormValues
  onChange: (next: CampaignFormValues) => void
  sites: Site[]
  scripts: ScriptListItem[]
  accounts?: AccountItem[]
  testCompatible: boolean | null
  disabled?: boolean
}

export function CampaignFormFields({
  value,
  onChange,
  sites,
  scripts,
  accounts = [],
  testCompatible,
  disabled,
}: Props) {
  const compatibleScripts = useMemo(
    () => filterScriptsForSite(scripts, value.site_key),
    [scripts, value.site_key],
  )

  const selectedScript = useMemo(
    () =>
      compatibleScripts.find((s) => s.package_key === value.script_package_key) ??
      null,
    [compatibleScripts, value.script_package_key],
  )

  const platformAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          value.site_key &&
          a.platform.toLowerCase() === value.site_key.toLowerCase(),
      ),
    [accounts, value.site_key],
  )

  const patch = (partial: Partial<CampaignFormValues>) =>
    onChange({ ...value, ...partial })

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          A — General
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="campaign_name">Campaign Name</Label>
          <Input
            id="campaign_name"
            disabled={disabled}
            value={value.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="site_key">Platform / Site</Label>
            <Select
              id="site_key"
              disabled={disabled}
              value={value.site_key}
              onChange={(e) => {
                const site_key = e.target.value
                const nextScripts = filterScriptsForSite(scripts, site_key)
                const stillOk = nextScripts.some(
                  (s) => s.package_key === value.script_package_key,
                )
                patch({
                  site_key,
                  script_package_key: stillOk ? value.script_package_key : '',
                  script_version: stillOk ? value.script_version : '',
                  account_id: '',
                })
              }}
            >
              <option value="">Select Site Registry…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.key}>
                  {s.name} ({s.key})
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-muted">
              OpenAPI <code className="font-mono">platform</code> = Site.key
              (POC: mayhopphat).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="script_key">Script</Label>
            <Select
              id="script_key"
              disabled={disabled || !value.site_key}
              value={value.script_package_key}
              onChange={(e) => {
                const script_package_key = e.target.value
                const script = compatibleScripts.find(
                  (s) => s.package_key === script_package_key,
                )
                patch({
                  script_package_key,
                  script_version: script?.version ?? '',
                })
              }}
            >
              <option value="">Select Script Registry…</option>
              {compatibleScripts.map((s) => (
                <option key={s.package_key} value={s.package_key}>
                  {displayScriptTitle(s)} · {s.package_key} · v{s.version}
                </option>
              ))}
            </Select>
            {!value.site_key ? (
              <p className="text-[11px] text-muted">Chọn Site trước.</p>
            ) : compatibleScripts.length === 0 ? (
              <p className="text-[11px] text-warning">
                Không có Script tương thích Site này trong Registry.
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="script_version">Script version (pin)</Label>
            <Input
              id="script_version"
              disabled={disabled}
              value={value.script_version}
              onChange={(e) => patch({ script_version: e.target.value })}
              placeholder="Published release version"
            />
            <p className="text-[11px] text-muted">
              OpenAPI <code className="font-mono">script_id</code> +{' '}
              <code className="font-mono">script_version</code>
              {selectedScript
                ? ` · registry suggests v${selectedScript.version}`
                : ''}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account_id">Account pin (required)</Label>
            <Select
              id="account_id"
              disabled={disabled || !value.site_key}
              value={value.account_id}
              onChange={(e) => patch({ account_id: e.target.value })}
            >
              <option value="">Select Account UUID…</option>
              {platformAccounts.map((a) => (
                <option key={a.account_uuid} value={a.account_uuid}>
                  {a.account_name || a.username || a.account_uuid} (
                  {a.account_uuid})
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-muted">
              OpenAPI <code className="font-mono">account_id</code> hard pin.
              If Account offline/unavailable → content stays{' '}
              <code className="font-mono">waiting_resources</code> /{' '}
              <code className="font-mono">pinned_account_unavailable</code> —
              never silent fallback.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          B — Content (create-time contents[])
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="content_title">Title (required)</Label>
            <Input
              id="content_title"
              disabled={disabled}
              value={value.content_title}
              onChange={(e) => patch({ content_title: e.target.value })}
              placeholder="WordPress draft title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="content_ref">External ref (optional)</Label>
            <Input
              id="content_ref"
              disabled={disabled}
              value={value.content_external_ref}
              onChange={(e) => patch({ content_external_ref: e.target.value })}
              placeholder="poc-draft-001"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted">
          Title-only POC — body omitted. LIVE create requires contents[]
          (OpenAPI minItems: 1).
        </p>
      </section>

      <ExecutionModeCards
        value={value.execution_mode}
        disabled={disabled}
        onChange={(execution_mode) => patch({ execution_mode })}
      />

      <RunModeCards
        value={value.run_mode}
        disabled={disabled}
        testCompatible={testCompatible}
        onChange={(run_mode) => patch({ run_mode })}
      />

      <ScheduleForm
        value={value.schedule}
        disabled={disabled}
        onChange={(schedule) => patch({ schedule })}
      />
      <p className="text-[11px] text-muted">
        Run Immediately = leave schedule Immediate, create as draft, then Start
        manually. LIVE create only sends resource_recheck_seconds (no schedule
        object in OpenAPI).
      </p>
    </div>
  )
}
