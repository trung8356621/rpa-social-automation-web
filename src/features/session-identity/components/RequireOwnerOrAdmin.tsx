import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useSessionIdentity } from '../use-session-identity'

const STAFF_LANDING_PATH = '/social-automation'

type RequireOwnerOrAdminProps = {
  children: ReactNode
}

/**
 * Admin feature routes — Staff must not see management UI.
 * Backend permissions remain authoritative; this only redirects the SPA.
 */
export function RequireOwnerOrAdmin({ children }: RequireOwnerOrAdminProps) {
  const identity = useSessionIdentity()

  if (identity.status === 'loading') {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading session…</p>
        <p className="mt-1 text-sm text-muted">
          Checking role before opening admin pages.
        </p>
        <div className="mt-4 h-16 animate-pulse rounded bg-surface-muted" />
      </div>
    )
  }

  if (identity.roleResolved && identity.isStaff) {
    return <Navigate to={STAFF_LANDING_PATH} replace />
  }

  return children
}

export { STAFF_LANDING_PATH }
