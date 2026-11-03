import type { Site } from '../action-tags/types.ts'

import type { SiteContentPolicy } from './types.ts'

/**
 * Content max length belongs to Action Tags Site Registry.
 * Do not invent a limit when Site has none configured.
 */
export function siteContentPolicy(site: Site | null | undefined): SiteContentPolicy {
  if (!site) {
    return {
      site_key: '',
      content_max_length: null,
      field_source: 'unavailable',
    }
  }

  const raw = site.content_max_length
  if (raw == null || !Number.isFinite(Number(raw)) || Number(raw) <= 0) {
    return {
      site_key: site.key,
      content_max_length: null,
      field_source: 'unavailable',
    }
  }

  return {
    site_key: site.key,
    content_max_length: Math.floor(Number(raw)),
    field_source: 'site.content_max_length',
  }
}

/**
 * Count grapheme-ish units via Intl.Segmenter when available.
 * Does not claim parity with every social platform — follows Site contract eventually.
 */
export function measureContentLength(text: string): number {
  if (!text) return 0
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      let n = 0
      for (const _ of seg.segment(text)) n += 1
      return n
    }
  } catch {
    // fall through
  }
  return Array.from(text).length
}

export type ContentLengthCheck =
  | { ok: true; length: number; max: number | null; nearLimit: boolean }
  | {
      ok: false
      length: number
      max: number
      nearLimit: true
      message: string
    }

export function checkContentLength(
  text: string,
  policy: SiteContentPolicy,
): ContentLengthCheck {
  const length = measureContentLength(text)
  if (policy.content_max_length == null) {
    return { ok: true, length, max: null, nearLimit: false }
  }
  const max = policy.content_max_length
  const nearLimit = length >= Math.floor(max * 0.9)
  if (length > max) {
    return {
      ok: false,
      length,
      max,
      nearLimit: true,
      message: `Nội dung vượt giới hạn Site (${length} / ${max}).`,
    }
  }
  return { ok: true, length, max, nearLimit }
}
