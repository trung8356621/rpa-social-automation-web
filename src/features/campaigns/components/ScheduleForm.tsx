import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

import {
  RESOURCE_RECHECK_HELPER,
  type ScheduleFormValues,
} from '../schedule'
import type { CampaignScheduleType } from '../types'

type Props = {
  value: ScheduleFormValues
  onChange: (next: ScheduleFormValues) => void
  disabled?: boolean
}

export function ScheduleForm({ value, onChange, disabled }: Props) {
  const patch = (partial: Partial<ScheduleFormValues>) =>
    onChange({ ...value, ...partial })

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Scheduling</legend>

      <div className="space-y-1.5">
        <Label htmlFor="schedule_type">Schedule Type</Label>
        <Select
          id="schedule_type"
          disabled={disabled}
          value={value.type}
          onChange={(e) =>
            patch({ type: e.target.value as CampaignScheduleType })
          }
        >
          <option value="immediate">Run Immediately</option>
          <option value="scheduled">Scheduled Start</option>
          <option value="time_window">Daily Time Window</option>
        </Select>
      </div>

      {value.type !== 'immediate' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              disabled={disabled}
              value={value.start_date}
              onChange={(e) => patch({ start_date: e.target.value })}
            />
          </div>
          {value.type === 'scheduled' ? (
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                disabled={disabled}
                value={value.start_time}
                onChange={(e) => patch({ start_time: e.target.value })}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              disabled={disabled}
              value={value.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="timezone_imm">Timezone</Label>
          <Input
            id="timezone_imm"
            disabled={disabled}
            value={value.timezone}
            onChange={(e) => patch({ timezone: e.target.value })}
          />
        </div>
      )}

      {value.type === 'time_window' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="daily_from">Daily Start Time</Label>
            <Input
              id="daily_from"
              type="time"
              disabled={disabled}
              value={value.daily_from}
              onChange={(e) => patch({ daily_from: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="daily_to">Daily End Time</Label>
            <Input
              id="daily_to"
              type="time"
              disabled={disabled}
              value={value.daily_to}
              onChange={(e) => patch({ daily_to: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min_interval">Minimum Interval (minutes)</Label>
            <Input
              id="min_interval"
              type="number"
              min={1}
              disabled={disabled}
              value={value.min_interval_minutes}
              onChange={(e) =>
                patch({ min_interval_minutes: Number(e.target.value) })
              }
            />
            <p className="text-[11px] text-muted">
              UI dùng phút — API gửi seconds.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
        <p>
          Resource recheck mặc định:{' '}
          <span className="font-mono text-foreground">
            {value.resource_recheck_seconds}s
          </span>{' '}
          (không phải Job retry).
        </p>
        <p className="mt-1">{RESOURCE_RECHECK_HELPER}</p>
        <p className="mt-1">
          Ngoài khung giờ Campaign: Job không hiển thị failed. Scheduling thuộc
          Campaign — không có lịch riêng từng Content.
        </p>
      </div>
    </fieldset>
  )
}
