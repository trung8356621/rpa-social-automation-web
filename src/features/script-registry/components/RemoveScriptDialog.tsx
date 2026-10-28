import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

type RemoveScriptDialogProps = {
  open: boolean
  packageKey: string | null
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function RemoveScriptDialog({
  open,
  packageKey,
  busy = false,
  onCancel,
  onConfirm,
}: RemoveScriptDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open || !packageKey) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close confirm overlay"
        className="absolute inset-0 bg-foreground/40"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-script-title"
        className="relative z-10 w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-4"
      >
        <h2 id="remove-script-title" className="text-base font-semibold">
          Remove Script
        </h2>
        <p className="mt-2 text-sm text-muted">
          Gỡ Script khỏi registry mock? Hành động chỉ trên dữ liệu local — không
          gọi API production.
        </p>
        <p className="mt-2 break-all font-mono text-xs text-foreground">
          {packageKey}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="bg-danger text-primary-foreground hover:bg-danger/90"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      </div>
    </div>
  )
}
