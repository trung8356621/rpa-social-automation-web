import type { TipTapDocJson } from './types.ts'
import { SHORTCODE_NAME_PATTERN } from './shortcode-mapping.ts'

export type ShortcodeSegment = {
  name: string
  inner: string
}

const OPEN_CLOSE_RE =
  /\[([a-z][a-z0-9_]*)\]([\s\S]*?)\[\/\1\]/g

/**
 * Reject HTML / Tiptap JSON before send.
 * Backend accepts plain text shortcode only (`richtext_format_unsupported`).
 */
export function assertPlainShortcodeSource(raw: string): void {
  const trimmed = raw.trim()
  if (!trimmed) return
  if (/<\s*\/?\s*[a-zA-Z][^>]*>/.test(raw)) {
    throw new Error(
      'richtext_format_unsupported: Backend accepts plain text shortcode only. Do not send HTML.',
    )
  }
  if (
    (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
    /"type"\s*:\s*"doc"/.test(trimmed)
  ) {
    throw new Error(
      'richtext_format_unsupported: Do not send Tiptap JSON. Use plain shortcode text.',
    )
  }
}

/** Parse `[name]...[/name]` segments (non-overlapping, first-wins). */
export function parseShortcodeSegments(raw: string): ShortcodeSegment[] {
  const segments: ShortcodeSegment[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(OPEN_CLOSE_RE.source, 'g')
  while ((match = re.exec(raw)) !== null) {
    segments.push({ name: match[1], inner: match[2] ?? '' })
  }
  return segments
}

export function serializeShortcodeSegments(
  segments: ShortcodeSegment[],
): string {
  return segments
    .map((s) => `[${s.name}]${s.inner}[/${s.name}]`)
    .join('\n')
}

/**
 * Selection → wrap selected text.
 * No selection → insert empty wrapper at caret.
 */
export function applyShortcodeWrap(
  source: string,
  shortcode: string,
  selectionStart: number,
  selectionEnd: number,
): { text: string; caretStart: number; caretEnd: number } {
  if (!SHORTCODE_NAME_PATTERN.test(shortcode)) {
    throw new Error(`Invalid shortcode name "${shortcode}".`)
  }
  const start = Math.max(0, Math.min(selectionStart, selectionEnd))
  const end = Math.max(0, Math.max(selectionStart, selectionEnd))
  const selected = source.slice(start, end)
  const open = `[${shortcode}]`
  const close = `[/${shortcode}]`
  const wrapped = `${open}${selected}${close}`
  const text = source.slice(0, start) + wrapped + source.slice(end)
  if (selected.length === 0) {
    const caret = start + open.length
    return { text, caretStart: caret, caretEnd: caret }
  }
  return {
    text,
    caretStart: start,
    caretEnd: start + wrapped.length,
  }
}

export function defaultRawSourceForMapping(
  shortcodeNames: string[],
): string {
  const name = shortcodeNames[0] ?? 'body'
  return `[${name}][/${name}]`
}

/** Build a minimal TipTap doc of shortcodeBlock nodes from plain shortcode. */
export function rawSourceToTipTapDoc(raw: string): TipTapDocJson {
  const segments = parseShortcodeSegments(raw)
  if (segments.length === 0) {
    const fallbackInner = raw.trim()
    return {
      type: 'doc',
      content: [
        {
          type: 'shortcodeBlock',
          attrs: { name: 'body' },
          content: [
            {
              type: 'paragraph',
              content: fallbackInner
                ? [{ type: 'text', text: fallbackInner }]
                : [],
            },
          ],
        },
      ],
    }
  }
  return {
    type: 'doc',
    content: segments.map((seg) => ({
      type: 'shortcodeBlock',
      attrs: { name: seg.name },
      content: seg.inner.split('\n').map((line) => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : [],
      })),
    })),
  }
}

/** Serialize TipTap shortcode doc → plain shortcode text (never HTML). */
export function tipTapDocToRawSource(doc: TipTapDocJson | null): string {
  if (!doc || !Array.isArray(doc.content)) return ''
  const segments: ShortcodeSegment[] = []

  for (const node of doc.content) {
    if (!node || typeof node !== 'object') continue
    const n = node as {
      type?: string
      attrs?: { name?: string }
      content?: unknown[]
    }
    if (n.type !== 'shortcodeBlock') continue
    const name =
      typeof n.attrs?.name === 'string' && SHORTCODE_NAME_PATTERN.test(n.attrs.name)
        ? n.attrs.name
        : 'body'
    const inner = paragraphsToPlain(n.content ?? [])
    segments.push({ name, inner })
  }

  return serializeShortcodeSegments(segments)
}

function paragraphsToPlain(nodes: unknown[]): string {
  const lines: string[] = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const n = node as {
      type?: string
      content?: Array<{ type?: string; text?: string }>
    }
    if (n.type !== 'paragraph') continue
    const parts: string[] = []
    for (const child of n.content ?? []) {
      if (child.type === 'text' && typeof child.text === 'string') {
        parts.push(child.text)
      } else if (child.type === 'hardBreak') {
        parts.push('\n')
      }
    }
    lines.push(parts.join(''))
  }
  return lines.join('\n')
}

/** List display helper: prefer raw_source, else legacy title/body. */
export function contentListPreview(row: {
  raw_source?: string | null
  source_format?: string | null
  input: { title: string | null; body: string | null }
}): string {
  if (row.raw_source?.trim()) return row.raw_source.trim()
  const title = row.input.title?.trim()
  const body = row.input.body?.trim()
  if (title && body) return `${title} — ${body}`
  return title || body || ''
}
