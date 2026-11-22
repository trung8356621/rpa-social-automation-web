import { useEffect, useState, type FormEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  CAMPAIGN_SCHEDULER_DESCRIPTION,
  canEditSchedulerSettings,
  getMinuteBounds,
  secondsToMinutes,
  validateSchedulerMinutes,
  type SchedulerPermissionIdentity,
} from '../scheduler-settings'
import type { UseSchedulerSettingsResult } from '../use-scheduler-settings'

type CampaignSchedulerSettingsCardProps = {
  scheduler: UseSchedulerSettingsResult
  identity: SchedulerPermissionIdentity
}

export function CampaignSchedulerSettingsCard({
  scheduler,
  identity,
}: CampaignSchedulerSettingsCardProps) {
  const { settings } = scheduler
  const bounds = getMinuteBounds(settings)
  const canEdit = canEditSchedulerSettings(identity)

  const [minutesInput, setMinutesInput] = useState<string>(() =>
    settings ? String(secondsToMinutes(settings.scheduler_interval_seconds)) : '',
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (!settings) return
    setMinutesInput(String(secondsToMinutes(settings.scheduler_interval_seconds)))
    setValidationError(null)
  }, [settings])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit || scheduler.saving) return

    const check = validateSchedulerMinutes(minutesInput, bounds)
    if (!check.valid) {
      setValidationError(check.error)
      return
    }

    setValidationError(null)
    await scheduler.saveIntervalSeconds(check.seconds)
  }

  if (scheduler.loading) {
    return (
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          Campaign Scheduler Interval
        </h2>
        <p className="mt-1 text-sm text-muted">
          {CAMPAIGN_SCHEDULER_DESCRIPTION}
        </p>
        <p className="mt-4 text-sm text-muted">
          Loading scheduler settings…
        </p>
        <div className="mt-3 h-16 animate-pulse rounded bg-surface-muted" />
      </section>
    )
  }

  if (scheduler.authRequired) {
    return (
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          Campaign Scheduler Interval
        </h2>
        <p className="mt-1 text-sm text-muted">
          Authentication required to load settings.
        </p>
        <p className="mt-2 text-sm text-muted">
          Sign in at{' '}
          <a className="text-primary underline" href="/login">
            /login
          </a>
          , then retry.
        </p>
        <Button className="mt-4" onClick={() => void scheduler.reload()}>
          Retry
        </Button>
      </section>
    )
  }

  if (scheduler.unavailable && !settings) {
    return (
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">
            Campaign Scheduler Interval
          </h2>
          <Badge variant="warning">API Unavailable</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {CAMPAIGN_SCHEDULER_DESCRIPTION}
        </p>
        <div className="mt-4 rounded-[var(--radius-control)] border border-border bg-surface-muted p-4 text-sm text-muted">
          {scheduler.error ??
            'Scheduler Settings API is currently unavailable on this server (404/503).'}
        </div>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void scheduler.reload()}
        >
          Retry
        </Button>
      </section>
    )
  }

  if (scheduler.error && !settings) {
    return (
      <section className="rounded-[var(--radius-card)] border border-danger/30 bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          Campaign Scheduler Interval
        </h2>
        <p className="mt-2 text-sm text-danger">{scheduler.error}</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void scheduler.reload()}
        >
          Retry
        </Button>
      </section>
    )
  }

  if (!settings) return null

  const liveCheck = validateSchedulerMinutes(minutesInput, bounds)
  const defaultMinutes = secondsToMinutes(settings.default_interval_seconds)

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            Campaign Scheduler Interval
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            {CAMPAIGN_SCHEDULER_DESCRIPTION}
          </p>
        </div>
        <Badge variant="neutral">
          {scheduler.mode === 'live' ? 'LIVE' : 'MOCK'}
        </Badge>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="scheduler-interval-minutes">
            Check interval (minutes)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="scheduler-interval-minutes"
              type="number"
              inputMode="numeric"
              min={bounds.minMinutes}
              max={bounds.maxMinutes}
              step={1}
              value={minutesInput}
              disabled={!canEdit || scheduler.saving}
              onChange={(e) => {
                setMinutesInput(e.target.value)
                setValidationError(null)
                scheduler.clearSaveFeedback()
              }}
            />
            <span className="shrink-0 text-sm text-muted">minutes</span>
          </div>
          <p className="text-xs text-muted">
            Allowed range: {bounds.minMinutes}–{bounds.maxMinutes} minutes (
            {settings.min_interval_seconds}–{settings.max_interval_seconds}s).
            Default: {defaultMinutes} minutes (
            {settings.default_interval_seconds}s).
            {liveCheck.valid
              ? ` Saving as ${liveCheck.seconds} seconds.`
              : ''}
          </p>
        </div>

        {settings.updated_at ? (
          <p className="text-xs text-muted">
            Last updated: <span className="font-mono">{settings.updated_at}</span>
          </p>
        ) : null}

        {!canEdit ? (
          <p className="text-xs text-muted">
            Admin or Owner access is required to modify scheduler settings.
          </p>
        ) : null}

        {validationError ? (
          <p role="alert" className="text-sm text-danger">
            {validationError}
          </p>
        ) : null}

        {scheduler.saveError ? (
          <p role="alert" className="text-sm text-danger">
            {scheduler.saveError}
          </p>
        ) : null}

        {scheduler.saveSuccess ? (
          <p role="status" className="text-sm text-primary">
            {scheduler.saveSuccess}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={!canEdit || scheduler.saving}
          >
            {scheduler.saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={scheduler.saving}
            onClick={() => void scheduler.reload()}
          >
            Reload
          </Button>
        </div>
      </form>
    </section>
  )
}
