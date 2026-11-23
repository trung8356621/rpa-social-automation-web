import languagesJson from './languages.json' with { type: 'json' }

export type LanguageOption = {
  code: string
  name: string
  nativeName: string
}

const CATALOG: LanguageOption[] = languagesJson as LanguageOption[]

export function getLanguageCatalog(): LanguageOption[] {
  return CATALOG
}

const BCP47_TAG_RE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?$/

function canonicalizeBcp47(raw: string): string {
  const parts = raw.trim().split(/[-_]/)
  if (parts.length === 0) return ''
  const lang = (parts[0] ?? '').toLowerCase()
  const rest = parts.slice(1).map((seg) => {
    if (seg.length === 4) {
      return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
    }
    if (seg.length === 2) {
      return seg.toUpperCase()
    }
    return seg.toLowerCase()
  })
  return [lang, ...rest].filter(Boolean).join('-')
}

/**
 * Normalize legacy (`DEFAULT`, `VI`, `EN`) and BCP 47 (`vi`, `en`, `zh-Hans`, `zh-Hant`)
 * language codes. Returns `null` for unassigned / DEFAULT.
 */
export function normalizeLanguageCode(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const upper = trimmed.toUpperCase()
  if (upper === 'DEFAULT' || upper === 'UNASSIGNED') return null

  const canonical = canonicalizeBcp47(trimmed)
  const matched = CATALOG.find(
    (entry) => entry.code.toLowerCase() === canonical.toLowerCase(),
  )
  if (matched) return matched.code
  if (BCP47_TAG_RE.test(canonical)) return canonical
  return null
}

export function isSupportedLanguageCode(
  raw: string | null | undefined,
): boolean {
  if (raw == null) return true
  const trimmed = raw.trim()
  if (
    !trimmed ||
    trimmed.toUpperCase() === 'DEFAULT' ||
    trimmed.toUpperCase() === 'UNASSIGNED'
  ) {
    return true
  }
  const canonical = canonicalizeBcp47(trimmed)
  return CATALOG.some(
    (entry) => entry.code.toLowerCase() === canonical.toLowerCase(),
  )
}

export function searchLanguages(
  query: string,
  catalog: LanguageOption[] = CATALOG,
): LanguageOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return catalog
  return catalog.filter(
    (item) =>
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.nativeName.toLowerCase().includes(q),
  )
}

export function formatLanguageDisplay(
  code: string | null | undefined,
  catalog: LanguageOption[] = CATALOG,
): string {
  const norm = normalizeLanguageCode(code)
  if (!norm) return 'Default / Unassigned'
  const found = catalog.find(
    (item) => item.code.toLowerCase() === norm.toLowerCase(),
  )
  if (!found) return norm
  if (found.nativeName && found.nativeName !== found.name) {
    return `${found.name} (${found.nativeName}) · ${found.code}`
  }
  return `${found.name} · ${found.code}`
}

export function formatLanguageBadge(
  code: string | null | undefined,
): string | null {
  const norm = normalizeLanguageCode(code)
  return norm ? norm.toUpperCase() : null
}
