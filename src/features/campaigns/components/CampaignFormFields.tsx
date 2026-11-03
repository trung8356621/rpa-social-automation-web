import { useMemo } from 'react'

import type { Site } from '@/features/action-tags/types'
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
  testCompatible: boolean | null
  disabled?: boolean
}

export function CampaignFormFields({
  value,
  onChange,
  sites,
  scripts,
  testCompatible,
  disabled,
}: Props) {
  const compatibleScripts = useMemo(
    () => filterScriptsForSite(scripts, value.site_key),
    [scripts, value.site_key],
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
              Nguồn: Action Tags Site Registry — không hardcode platform.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="script_key">Script</Label>
            <Select
              id="script_key"
              disabled={disabled || !value.site_key}
              value={value.script_package_key}
              onChange={(e) => patch({ script_package_key: e.target.value })}
            >
              <option value="">Select Script Registry…</option>
              {compatibleScripts.map((s) => (
                <option key={s.package_key} value={s.package_key}>
                  {displayScriptTitle(s)} · {s.package_key}
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
    </div>
  )
}
