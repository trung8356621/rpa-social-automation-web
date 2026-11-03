import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { SessionIdentityController } from '../use-session-identity'

type SessionIdentityBadgeProps = {
  identity: SessionIdentityController
}

function roleLabel(role: string): string {
  return role.toUpperCase()
}

export function SessionIdentityBadge({ identity }: SessionIdentityBadgeProps) {
  const { status, user, error, reload, mode } = identity

  if (status === 'loading') {
    return (
      <Badge variant="neutral" aria-busy="true" title="Loading session identity">
        Session…
      </Badge>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex max-w-[min(22rem,70vw)] items-center gap-2">
        <Badge variant="warning">Not signed in</Badge>
        <a className="text-[11px] text-primary underline" href="/login">
          /login
        </a>
      </div>
    )
  }

  if (status === 'forbidden' || status === 'error') {
    return (
      <div className="flex max-w-[min(24rem,75vw)] flex-wrap items-center gap-1.5">
        <Badge variant="danger">
          {status === 'forbidden' ? 'Access denied' : 'Session error'}
        </Badge>
        {error ? (
          <span className="truncate text-[11px] text-muted" title={error}>
            {error}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => void reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!user) return null

  return (
    <Badge
      variant="primary"
      title={`Authenticated · ${mode}`}
      className="max-w-[min(28rem,80vw)] truncate font-normal"
    >
      <span className="truncate font-medium">{user.name}</span>
      <span className="opacity-70"> · </span>
      <span className="font-mono">#{user.id}</span>
      <span className="opacity-70"> · </span>
      <span className="font-semibold tracking-wide">{roleLabel(user.role)}</span>
    </Badge>
  )
}
