import { Navigate } from 'react-router-dom'

import { STAFF_LANDING_PATH } from '@/features/session-identity/components/RequireOwnerOrAdmin'
import { useSessionIdentity } from '@/features/session-identity/use-session-identity'

const OWNER_HOME = '/social-automation/action-tags'

/**
 * Role-aware index redirect. Staff → Client Connection landing; Owner/Admin → Action Tags.
 */
export function HomeRedirect() {
  const identity = useSessionIdentity()

  if (identity.status === 'loading') {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading session…</p>
        <div className="mt-4 h-12 animate-pulse rounded bg-surface-muted" />
      </div>
    )
  }

  if (identity.roleResolved && identity.isStaff) {
    return <Navigate to={STAFF_LANDING_PATH} replace />
  }

  return <Navigate to={OWNER_HOME} replace />
}
