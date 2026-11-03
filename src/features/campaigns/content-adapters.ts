import type {
  CampaignContentInput,
  ManualContentDraft,
  TipTapDocJson,
} from './types.ts'

/** Plain text from a minimal Tiptap doc (paragraphs + hard breaks). */
export function tipTapDocToPlainText(doc: TipTapDocJson | null): string {
  if (!doc || !Array.isArray(doc.content)) return ''
  const lines: string[] = []

  for (const node of doc.content) {
    if (!node || typeof node !== 'object') continue
    const n = node as {
      type?: string
      content?: Array<{ type?: string; text?: string }>
    }
    if (n.type === 'paragraph') {
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
  }

  return lines.join('\n')
}

export function plainTextToTipTapDoc(text: string): TipTapDocJson {
  const paragraphs = text.split(/\n/)
  return {
    type: 'doc',
    content: paragraphs.map((line) => ({
      type: 'paragraph',
      content: line
        ? [{ type: 'text', text: line }]
        : [],
    })),
  }
}

/**
 * Map editor draft → backend Script input contract shape.
 * Does not assume backend stores Tiptap JSON unless CP19C says so.
 */
export function draftToScriptInput(draft: ManualContentDraft): {
  external_ref: string
  source: 'manual'
  input: CampaignContentInput
} {
  const body =
    draft.body ??
    (draft.editor_doc ? tipTapDocToPlainText(draft.editor_doc) : null)

  return {
    external_ref: draft.external_ref?.trim() || `manual-${Date.now()}`,
    source: 'manual',
    input: {
      title: draft.title?.trim() ? draft.title.trim() : null,
      body: body?.trim() ? body : null,
      variables: { ...draft.variables },
    },
  }
}

/** Strip secrets from diagnostic dumps */
export function redactContentInputForDiagnostics(
  input: CampaignContentInput,
): CampaignContentInput {
  const variables: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(input.variables)) {
    if (/password|secret|token|api[_-]?key/i.test(k)) {
      variables[k] = '[REDACTED]'
    } else {
      variables[k] = v
    }
  }
  return {
    title: input.title,
    body: input.body,
    variables,
  }
}
