import { RouteSkeleton } from '@/components/shared/RouteSkeleton'

export function ClientApiKeysPage() {
  return (
    <RouteSkeleton
      title="Client API Keys"
      description="Key identity management. Secret masked in lists. One key = one logical Client; max one active lease."
      layoutHint="Planned composition for the next checkpoint (mock only):"
      plannedSections={[
        'Table — Key ID, label, masked secret, lease status, last heartbeat',
        'Create (one-time secret copy if supported) + revoke with confirmation',
        'No Release Lease control until contract verifies it',
      ]}
    />
  )
}
