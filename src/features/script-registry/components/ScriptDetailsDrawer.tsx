import { useEffect, useMemo, useState } from 'react'
import { Play, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toSafeApiMessage } from '@/lib/api/errors'

import { formatLanguageBadge, normalizeLanguageCode } from '../languages'
import { findCompatibleScriptsForAction } from '../operational-settings'
import type {
  ScriptDetail,
  ScriptListItem,
  ScriptOperationalSettingsInput,
  ScriptReleaseDetail,
  ScriptSharingMode,
} from '../types'
import { displayScriptTitle } from '../types'
import { LanguageSelector } from './LanguageSelector'
import { ScriptSharingPanel } from './ScriptSharingPanel'
import type { VideoPlayerTarget } from './VideoPlayerModal'

type ScriptDetailsDrawerProps = {
  open: boolean
  detail: ScriptDetail | null
  allScripts?: ScriptListItem[]
  mode?: 'mock' | 'live'
  operationalSettingsSupported?: boolean
  onClose: () => void
  onPlayRelease: (target: VideoPlayerTarget) => void
  onUpdateSharing?: (
    packageKey: string,
    sharingMode: ScriptSharingMode,
  ) => Promise<void>
  onSaveOperationalSettings?: (
    packageKey: string,
    settings: ScriptOperationalSettingsInput,
  ) => Promise<void>
}

function videoLabel(release: ScriptReleaseDetail): string {
  switch (release.video_demo_status) {
    case 'ready':
      return 'Ready'
    case 'missing':
      return 'Missing demo'
    case 'thumbnail_unavailable':
      return 'Thumbnail unavailable'
    case 'processing':
      return 'Processing'
    case 'error':
      return 'Error'
    default:
      return release.video_demo_status
  }
}

export function ScriptDetailsDrawer({
  open,
  detail,
  allScripts = [],
  mode = 'mock',
  operationalSettingsSupported = mode === 'mock',
  onClose,
  onPlayRelease,
  onUpdateSharing,
  onSaveOperationalSettings,
}: ScriptDetailsDrawerProps) {
  const [isEnabled, setIsEnabled] = useState(true)
  const [languageCode, setLanguageCode] = useState<string | null>(null)
  const [isPrimary, setIsPrimary] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    if (!detail) return
    setIsEnabled(detail.is_enabled !== false)
    setLanguageCode(normalizeLanguageCode(detail.language_code))
    setIsPrimary(detail.is_primary === true)
    setSettingsError(null)
    setSettingsSaved(false)
  }, [detail])

  const compatibleScripts = useMemo(
    () => (detail ? findCompatibleScriptsForAction(detail, allScripts) : []),
    [detail, allScripts],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !detail) return null

  const title = displayScriptTitle(detail)
  const hasPublishedRelease = detail.releases.some((r) => r.status === 'published')

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-foreground/20"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-detail-title"
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-border bg-surface"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="script-detail-title"
                className="text-base font-semibold break-all"
              >
                {title}
              </h2>
              {detail.is_authentication ? (
                <Badge variant="primary">Authentication</Badge>
              ) : null}
            </div>
            <p className="mt-0.5 break-all font-mono text-xs text-muted">
              {detail.package_key}
            </p>
            {detail.action_tag_key &&
            detail.name !== detail.action_tag_key ? (
              <p className="mt-1 text-xs text-muted">
                Script: <span className="text-foreground">{detail.name}</span>
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Description
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {detail.description?.trim() || '—'}
            </p>
          </div>

          {hasPublishedRelease ? (
            <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted/40 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                  Operational Settings
                </h3>
                {!operationalSettingsSupported ? (
                  <Badge variant="warning">Read-only</Badge>
                ) : null}
              </div>

              {!operationalSettingsSupported ? (
                <p className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  Operational Settings API is not available on this server yet.
                  Settings are read-only in LIVE mode.
                </p>
              ) : null}

              {settingsError ? (
                <div
                  role="alert"
                  className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
                >
                  {settingsError}
                </div>
              ) : null}

              {settingsSaved ? (
                <p className="text-xs text-success">Operational settings saved.</p>
              ) : null}

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={!operationalSettingsSupported || savingSettings}
                  onChange={(e) => {
                    setIsEnabled(e.target.checked)
                    setSettingsSaved(false)
                  }}
                />
                <span>Enabled</span>
              </label>

              <div className="space-y-1">
                <label
                  htmlFor="script-language-selector"
                  className="block text-xs font-medium text-muted"
                >
                  Language
                </label>
                <LanguageSelector
                  id="script-language-selector"
                  value={languageCode}
                  disabled={!operationalSettingsSupported || savingSettings}
                  onChange={(code) => {
                    setLanguageCode(code)
                    setSettingsSaved(false)
                  }}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  disabled={!operationalSettingsSupported || savingSettings}
                  onChange={(e) => {
                    setIsPrimary(e.target.checked)
                    setSettingsSaved(false)
                  }}
                />
                <span>Set as Primary Script for its Action</span>
              </label>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !operationalSettingsSupported ||
                    !onSaveOperationalSettings ||
                    savingSettings
                  }
                  onClick={() => {
                    if (!onSaveOperationalSettings || !operationalSettingsSupported) {
                      return
                    }
                    setSavingSettings(true)
                    setSettingsError(null)
                    setSettingsSaved(false)
                    void onSaveOperationalSettings(detail.package_key, {
                      is_enabled: isEnabled,
                      language_code: languageCode,
                      is_primary: isPrimary,
                    })
                      .then(() => {
                        setSettingsSaved(true)
                      })
                      .catch((err: unknown) => {
                        setSettingsError(toSafeApiMessage(err))
                      })
                      .finally(() => {
                        setSavingSettings(false)
                      })
                  }}
                >
                  {savingSettings ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          ) : null}

          {compatibleScripts.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                Compatible Scripts Sharing Action
              </h3>
              <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Script</th>
                      <th className="px-3 py-2 font-medium">Language</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {compatibleScripts.map((row) => (
                      <tr key={row.package_key}>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {row.name}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="neutral">
                            {formatLanguageBadge(row.language_code) ?? 'DEFAULT'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={row.is_enabled ? 'success' : 'warning'}>
                            {row.is_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={row.is_primary ? 'primary' : 'neutral'}>
                            {row.priority_label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {hasPublishedRelease ? (
            <ScriptSharingPanel
              packageKey={detail.package_key}
              sharingMode={detail.sharing_mode}
              globalScope={detail.global_scope}
              globalEligible={detail.global_eligible}
              globalIneligibleReason={detail.global_ineligible_reason}
              eligibleGlobalScope={detail.eligible_global_scope}
              globalConflict={detail.global_conflict}
              onUpdateSharing={onUpdateSharing}
            />
          ) : null}

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Release history
            </h3>
            <ul className="mt-2 space-y-3">
              {detail.releases.map((release) => (
                <li
                  key={release.id}
                  className="rounded-[var(--radius-control)] border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      Release {release.version}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {release.published_at
                          ? new Date(release.published_at).toLocaleString()
                          : '—'}
                      </span>
                    </p>
                    <Badge
                      variant={
                        release.status === 'yanked' ? 'neutral' : 'success'
                      }
                    >
                      {release.status}
                    </Badge>
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted">
                    digest {release.content_digest}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">
                      Video demo: {videoLabel(release)}
                    </span>
                    {release.video_demo_status === 'ready' &&
                    (release.video_url || release.video_media_id) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onPlayRelease({
                            title: `${title} · v${release.version}`,
                            video_demo_status: release.video_demo_status,
                            video_url: release.video_url,
                            thumbnail_url: release.thumbnail_url,
                            has_playable_video: Boolean(
                              release.video_url || release.video_media_id,
                            ),
                          })
                        }
                      >
                        <Play className="size-3.5" />
                        Play
                      </Button>
                    ) : null}
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-primary">
                      Variables / Steps / Assets
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-[var(--radius-control)] bg-surface-muted p-2 font-mono text-[11px] leading-relaxed text-foreground">
                      {JSON.stringify(
                        {
                          variables: release.variables,
                          steps: release.steps,
                          assets: release.assets,
                          runtime_requirements: release.runtime_requirements,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted">
            Updated by {detail.updated_by_label || '—'}
          </p>
        </div>
      </aside>
    </div>
  )
}
