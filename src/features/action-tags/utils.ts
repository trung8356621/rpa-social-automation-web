import type { ActionTagItem, PathInput } from './types'

export const MAX_TAG_SEGMENT_LENGTH = 60
export const MAX_TAG_KEY_LENGTH = 128

export function normalizeTagSegment(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, MAX_TAG_SEGMENT_LENGTH)
}

export function buildTagKey(
  siteKey: string,
  pathKey: string,
  actionKey?: string | null,
): string {
  const s = normalizeTagSegment(siteKey)
  const p = normalizeTagSegment(pathKey)
  if (!s || !p) return ''

  const a = actionKey ? normalizeTagSegment(actionKey) : ''
  const combined = a ? `${s}.${p}.${a}` : `${s}.${p}`
  return combined.slice(0, MAX_TAG_KEY_LENGTH).replace(/^[._-]+|[._-]+$/g, '')
}

export function isValidTagKeyFormat(tagKey: string): boolean {
  const trimmed = (tagKey || '').trim()
  if (!trimmed || trimmed.length > MAX_TAG_KEY_LENGTH) return false
  return /^[a-z0-9][a-z0-9._-]{1,126}[a-z0-9]$/.test(trimmed)
}

export function findExistingSitePathTag(
  tags: ActionTagItem[],
  site: { id?: number | null; key?: string | null } | null | undefined,
  path: { id?: number | null; key?: string | null } | null | undefined,
): ActionTagItem | null {
  if (!site || !path) return null
  const targetKey =
    site.key && path.key ? buildTagKey(site.key, path.key) : ''

  // 1. Prefer canonical 2-part tag_key match ({site_key}.{path_key})
  if (targetKey) {
    const exact = tags.find((t) => t.tag_key === targetKey)
    if (exact) return exact
  }

  // 2. Match by site_id + path_id when present
  if (site.id != null && path.id != null) {
    const byId = tags.find(
      (t) => t.site_id === site.id && t.path_id === path.id,
    )
    if (byId) return byId
  }

  // 3. Fallback match by site_key + path_key
  if (site.key && path.key) {
    const normSite = normalizeTagSegment(site.key)
    const normPath = normalizeTagSegment(path.key)
    const byKeys = tags.find(
      (t) =>
        normalizeTagSegment(t.site_key) === normSite &&
        normalizeTagSegment(t.path_key) === normPath,
    )
    if (byKeys) return byKeys
  }

  return null
}

export function parseInputsFromPattern(pattern: string): PathInput[] {
  if (!pattern) return []
  const matches = pattern.matchAll(/\{([a-zA-Z0-9_]+)\}/g)
  const keys = Array.from(new Set(Array.from(matches, (m) => m[1])))
  return keys.map((key) => ({
    key,
    type: 'String',
    required: true,
  }))
}

export function resolveUrl(
  baseUrl: string,
  pattern: string,
  inputValues: Record<string, string>,
): {
  url: string
  missing: string[]
  valid: boolean
  error?: string | null
} {
  const normBase = (baseUrl || '').trim().replace(/\/+$/, '')
  let normPattern = (pattern || '').trim()
  if (!normPattern) normPattern = '/'
  if (!normPattern.startsWith('/')) normPattern = `/${normPattern}`

  const inputs = parseInputsFromPattern(normPattern)
  const missing: string[] = []
  let resolved = normPattern

  if (!normBase) {
    missing.push('base_url')
  }

  for (const input of inputs) {
    const val = inputValues[input.key]?.trim() ?? ''
    if (!val) {
      missing.push(input.key)
    } else {
      resolved = resolved.replace(
        new RegExp(`\\{${input.key}\\}`, 'g'),
        encodeURIComponent(val),
      )
    }
  }

  const fullUrl = normBase ? normBase + (resolved === '/' ? '' : resolved) : ''
  const isValid = missing.length === 0

  let error: string | null = null
  if (!isValid) {
    if (missing.includes('base_url')) {
      error = 'Base URL không được để trống.'
    } else {
      error = `Chưa điền đủ tham số: ${missing.join(', ')}`
    }
  }

  return {
    url: fullUrl,
    missing,
    valid: isValid,
    error,
  }
}

export function slugifyKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'site'
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
