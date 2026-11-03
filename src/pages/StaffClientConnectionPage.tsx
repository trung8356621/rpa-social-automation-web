import { Navigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { useSessionIdentity } from '@/features/session-identity/use-session-identity'
import { StaffClientConnectionPanel } from '@/features/staff-client-connection/components/StaffClientConnectionPanel'
import { useStaffClientConnection } from '@/features/staff-client-connection/use-staff-client-connection'

const OWNER_HOME = '/social-automation/action-tags'

/**
 * Staff-only landing — Client Connection is the sole Social Automation surface.
 * Owner/Admin must not see this page globally.
 */
export function StaffClientConnectionPage() {
  const identity = useSessionIdentity()
  const controller = useStaffClientConnection({
    enabled: identity.roleResolved && identity.isStaff,
  })

  if (identity.status === 'loading') {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading session…</p>
        <div className="mt-4 h-16 animate-pulse rounded bg-surface-muted" />
      </div>
    )
  }

  if (identity.roleResolved && identity.isOwnerOrAdmin) {
    return <Navigate to={OWNER_HOME} replace />
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4">
      <PageHeader
        title="Client Connection"
        description="Kết nối RPA Client trên máy của bạn. Không có menu quản trị Owner."
      />
      <StaffClientConnectionPanel controller={controller} variant="page" />
    </div>
  )
}
