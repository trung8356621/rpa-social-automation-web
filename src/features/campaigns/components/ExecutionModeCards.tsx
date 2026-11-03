import { cn } from '@/lib/utils'

import type { CampaignExecutionMode } from '../types'

const OPTIONS: Array<{
  value: CampaignExecutionMode
  title: string
  description: string
}> = [
  {
    value: 'one_account_one_job',
    title: '1 Account : 1 Job',
    description:
      'Each Account executes at most one logical Job/Content in this Campaign.',
  },
  {
    value: 'one_account_many_jobs',
    title: '1 Account : N Job',
    description:
      'An Account may execute multiple Jobs sequentially, never concurrently.',
  },
]

type Props = {
  value: CampaignExecutionMode
  onChange: (value: CampaignExecutionMode) => void
  disabled?: boolean
}

export function ExecutionModeCards({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        Execution Mode
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <label
              key={opt.value}
              className={cn(
                'cursor-pointer rounded-[var(--radius-card)] border px-3 py-2.5',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface hover:bg-surface-muted',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name="execution_mode"
                value={opt.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(opt.value)}
              />
              <div className="text-sm font-medium">{opt.title}</div>
              <p className="mt-1 text-xs text-muted">{opt.description}</p>
            </label>
          )
        })}
      </div>
      <p className="text-xs text-muted">
        Account Lease internals are not exposed in this UI.
      </p>
    </fieldset>
  )
}
