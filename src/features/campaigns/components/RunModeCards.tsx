import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { CampaignRunMode } from '../types'

type Props = {
  value: CampaignRunMode
  onChange: (value: CampaignRunMode) => void
  disabled?: boolean
  testCompatible: boolean | null
}

export function RunModeCards({
  value,
  onChange,
  disabled,
  testCompatible,
}: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">Run Mode</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label
          className={cn(
            'cursor-pointer rounded-[var(--radius-card)] border px-3 py-2.5',
            value === 'test'
              ? 'border-warning bg-warning/10'
              : 'border-border bg-surface hover:bg-surface-muted',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            className="sr-only"
            name="run_mode"
            value="test"
            checked={value === 'test'}
            disabled={disabled}
            onChange={() => onChange('test')}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Test Mode</span>
            <Badge variant="warning">TEST</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Execute a compatible test Script. Stop before publishing. Capture
            screenshot as final evidence.
          </p>
        </label>

        <label
          className={cn(
            'cursor-pointer rounded-[var(--radius-card)] border px-3 py-2.5',
            value === 'live'
              ? 'border-danger/40 bg-danger/5'
              : 'border-border bg-surface hover:bg-surface-muted',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            className="sr-only"
            name="run_mode"
            value="live"
            checked={value === 'live'}
            disabled={disabled}
            onChange={() => onChange('live')}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Live Mode</span>
            <Badge variant="danger">LIVE</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Execute the Script according to normal production behavior. Explicit
            confirmation required before Start.
          </p>
        </label>
      </div>

      {value === 'test' ? (
        <div className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          {testCompatible === true
            ? 'Script được đánh dấu tương thích Test Mode.'
            : testCompatible === false
              ? 'Script không tương thích Test Mode — Start sẽ bị khóa.'
              : 'Không xác định được Test Mode compatibility từ contract — Start bị vô hiệu hóa. Không giả định Script an toàn chỉ vì chọn Test Mode.'}
        </div>
      ) : null}
    </fieldset>
  )
}
