import type { AccountItem } from '../accounts/types.ts'
import {
  displayScriptTitle,
  type ScriptDetail,
  type ScriptListItem,
} from '../script-registry/types.ts'

export type AccountDisplay = {
  /** Human-readable Account Name (never invented from UUID) */
  label: string
  /** Internal Account UUID when known */
  accountId: string | null
  state: 'empty' | 'loading' | 'resolved' | 'missing'
}

export type ScriptDisplay = {
  /** Action Tag / Script display name + version */
  label: string
  packageKey: string
  version: string
  state: 'empty' | 'loading' | 'resolved' | 'missing'
}

/**
 * Resolve Account display from Accounts inventory.
 * Never derives a name from the UUID string.
 */
export function resolveAccountDisplay(
  accounts: AccountItem[] | undefined,
  accountId: string | null | undefined,
  options?: { loading?: boolean },
): AccountDisplay {
  const id = accountId?.trim() || ''
  if (!id) {
    return { label: '— (no hard pin)', accountId: null, state: 'empty' }
  }
  if (options?.loading) {
    return { label: 'Loading…', accountId: id, state: 'loading' }
  }
  const list = accounts ?? []
  const hit = list.find((a) => a.account_uuid === id)
  if (!hit) {
    return {
      label: 'Account missing',
      accountId: id,
      state: 'missing',
    }
  }
  const name = hit.account_name?.trim() || ''
  const username = hit.username?.trim() || ''
  // Prefer Account Name; username only when name blank — still registry data, not UUID.
  const label = name || username
  if (!label) {
    return {
      label: 'Account missing',
      accountId: id,
      state: 'missing',
    }
  }
  return { label, accountId: id, state: 'resolved' }
}

/**
 * Resolve Script display from Script Registry list/detail.
 * Match package_key or script_id; never invent a title from the key alone as a "pretty name".
 */
export function resolveScriptDisplay(
  scripts: ScriptListItem[] | undefined,
  scriptKey: string | null | undefined,
  scriptVersion: string | null | undefined,
  options?: {
    loading?: boolean
    detail?: ScriptDetail | null
  },
): ScriptDisplay {
  const key = scriptKey?.trim() || ''
  const version = scriptVersion?.trim() || ''
  if (!key) {
    return {
      label: '—',
      packageKey: '',
      version: '',
      state: 'empty',
    }
  }
  if (options?.loading) {
    return {
      label: 'Loading…',
      packageKey: key,
      version,
      state: 'loading',
    }
  }

  const list = scripts ?? []
  const hit =
    list.find((s) => s.package_key === key) ??
    list.find((s) => s.script_id === key) ??
    null

  const detail = options?.detail ?? null
  const titleSource = hit
    ? { action_tag_key: hit.action_tag_key, name: hit.name }
    : detail
      ? {
          action_tag_key: detail.action_tag_key,
          name: detail.name,
        }
      : null

  if (!titleSource) {
    // Lookup failed — do not pretty-print the key as a name; show missing + key in technical.
    return {
      label: version ? `Script missing · v${version}` : 'Script missing',
      packageKey: key,
      version,
      state: 'missing',
    }
  }

  const title = displayScriptTitle(titleSource)
  const ver = version || hit?.version || ''
  return {
    label: ver ? `${title} · v${ver}` : title,
    packageKey: hit?.package_key ?? detail?.package_key ?? key,
    version: ver,
    state: 'resolved',
  }
}
