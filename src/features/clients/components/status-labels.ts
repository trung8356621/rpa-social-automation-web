import type { BadgeProps } from '@/components/ui/badge'

import type {
  BrowserOnlinePresence,
  BrowserRuntimeState,
  BrowserRuntimeStatus,
  ClientConnectionState,
  ExecutionState,
  SessionSignalState,
} from '../types'

export function browserStateLabel(state: BrowserRuntimeState): string {
  return state === 'running' ? 'Browser Running' : 'Browser Stopped'
}

export function browserStateVariant(
  state: BrowserRuntimeState,
): BadgeProps['variant'] {
  return state === 'running' ? 'success' : 'neutral'
}

export function runtimeStatusLabel(status: BrowserRuntimeStatus): string {
  switch (status) {
    case 'running':
      return 'Runtime Running'
    case 'stopped':
      return 'Runtime Stopped'
    case 'error':
      return 'Runtime Error'
    case 'crashed':
      return 'Runtime Crashed'
    case 'unknown_stale':
    default:
      return 'Runtime Unknown'
  }
}

export function runtimeStatusVariant(
  status: BrowserRuntimeStatus,
): BadgeProps['variant'] {
  switch (status) {
    case 'running':
      return 'success'
    case 'stopped':
      return 'neutral'
    case 'error':
    case 'crashed':
      return 'danger'
    case 'unknown_stale':
    default:
      return 'warning'
  }
}

/** Backend is_online → Online / Offline / Unknown */
export function onlinePresenceLabel(state: BrowserOnlinePresence): string {
  switch (state) {
    case 'online':
      return 'Online'
    case 'offline':
      return 'Offline'
    case 'unknown':
    default:
      return 'Unknown'
  }
}

export function onlinePresenceVariant(
  state: BrowserOnlinePresence,
): BadgeProps['variant'] {
  switch (state) {
    case 'online':
      return 'success'
    case 'offline':
      return 'neutral'
    case 'unknown':
    default:
      return 'warning'
  }
}

export function connectionLabel(state: ClientConnectionState): string {
  return state === 'online' ? 'Client Online' : 'Client Offline'
}

export function connectionVariant(
  state: ClientConnectionState,
): BadgeProps['variant'] {
  return state === 'online' ? 'primary' : 'neutral'
}

export function sessionLabel(state: SessionSignalState): string {
  switch (state) {
    case 'verified':
      return 'Session Verified'
    case 'needs_login':
      return 'Needs Login'
    case 'candidate':
      return 'Session Candidate'
    case 'present':
      return 'Signal Present'
    case 'absent':
      return 'Signal Absent'
    case 'unknown':
    default:
      return 'Session Unknown'
  }
}

export function sessionVariant(
  state: SessionSignalState,
): BadgeProps['variant'] {
  switch (state) {
    case 'verified':
      return 'success'
    case 'needs_login':
      return 'warning'
    case 'candidate':
    case 'present':
      return 'primary'
    case 'absent':
      return 'neutral'
    case 'unknown':
    default:
      return 'warning'
  }
}

export function executionLabel(state: ExecutionState): string {
  switch (state) {
    case 'running':
      return 'Execution Running'
    case 'succeeded':
      return 'Execution OK'
    case 'failed':
      return 'Execution Failed'
    case 'idle':
      return 'Execution Idle'
    case 'unknown':
    default:
      return 'Execution Unknown'
  }
}

export function executionVariant(
  state: ExecutionState,
): BadgeProps['variant'] {
  switch (state) {
    case 'running':
      return 'primary'
    case 'succeeded':
      return 'success'
    case 'failed':
      return 'danger'
    case 'idle':
      return 'neutral'
    case 'unknown':
    default:
      return 'warning'
  }
}

export function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/** Design Language: Username is Browser title; neutral fallback when null. */
export function browserTitle(username: string | null, accountName: string): string {
  const u = username?.trim()
  if (u) return u
  const account = accountName.trim()
  if (account) return `Username unknown · ${account}`
  return 'Username unknown'
}
