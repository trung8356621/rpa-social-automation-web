import { cn } from '@/lib/utils'

export type ToastState = {
  message: string
  type: 'success' | 'error'
} | null

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-sm rounded-[var(--radius-control)] border px-3 py-2 text-sm shadow-sm',
        toast.type === 'success'
          ? 'border-success/30 bg-surface text-foreground'
          : 'border-danger/30 bg-surface text-foreground',
      )}
    >
      <span
        className={cn(
          'mr-2 font-medium',
          toast.type === 'success' ? 'text-success' : 'text-danger',
        )}
      >
        {toast.type === 'success' ? '✓' : '!'}
      </span>
      {toast.message}
    </div>
  )
}
