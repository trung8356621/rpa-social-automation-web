import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

import type { Campaign } from '../types'

type DeleteCampaignDialogProps = {
  campaign: Campaign | null
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteCampaignDialog({
  campaign,
  busy = false,
  onCancel,
  onConfirm,
}: DeleteCampaignDialogProps) {
  useEffect(() => {
    if (!campaign) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [campaign, busy, onCancel])

  if (!campaign) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close delete confirmation"
        className="absolute inset-0 bg-foreground/40"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-campaign-title"
        aria-describedby="delete-campaign-description"
        className="relative z-10 w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-lg"
      >
        <h2
          id="delete-campaign-title"
          className="text-base font-semibold text-foreground"
        >
          Delete Cancelled Campaign
        </h2>
        <p className="mt-2 text-sm font-medium text-foreground">
          {campaign.name}
        </p>
        <div
          id="delete-campaign-description"
          className="mt-2 space-y-1.5 text-sm text-muted"
        >
          <p>
            This cancelled campaign will be hidden from the normal campaign list.
          </p>
          <p>Execution history is retained.</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="bg-danger text-primary-foreground hover:bg-danger/90"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Confirm Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}
