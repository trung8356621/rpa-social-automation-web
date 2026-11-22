import { toSafeApiMessage } from '../../lib/api/errors.ts'
import {
  generateBulkMockContentsForTag,
  type ResolvedActionTagPlan,
} from '../campaigns/multi-tag-plan.ts'
import { allScriptVariables } from '../campaigns/shortcode-mapping.ts'
import type { ScriptInputSchema } from '../campaigns/types.ts'
import type { SaveLibraryArticleInput } from './types.ts'

export type BulkMockDraftItem = {
  key: string
  payload: SaveLibraryArticleInput
  previewTitle: string
  previewBody: string
  status: 'pending' | 'saving' | 'created' | 'failed'
  error?: string
}

function parseGeneratedTagBlocks(
  rawSource: string,
  schema: ScriptInputSchema,
): Record<string, unknown> {
  const vars = allScriptVariables(schema)
  const typeByKey = new Map(vars.map((v) => [v.key, v.type]))
  const out: Record<string, unknown> = {}

  for (const v of vars) {
    if (v.type === 'secret') continue
    const re = new RegExp(`\\[${v.key}\\]([\\s\\S]*?)\\[\\/${v.key}\\]`)
    const match = re.exec(rawSource)
    if (!match) continue
    const rawVal = match[1] ?? ''
    const fieldType = typeByKey.get(v.key)
    if (fieldType === 'number') {
      const n = Number(rawVal)
      out[v.key] = Number.isFinite(n) ? n : 1
    } else if (fieldType === 'boolean') {
      out[v.key] = rawVal === 'true'
    } else {
      out[v.key] = rawVal
    }
  }

  return out
}

/**
 * Reuse `generateBulkMockContentsForTag` to build independent Article Library
 * payloads (without campaign_id, 1 Action Tag per Article).
 */
export function buildBulkMockArticleDrafts(params: {
  tag: ResolvedActionTagPlan
  schema: ScriptInputSchema
  count: number
  existingRefs?: Iterable<string>
  startSeq?: number
}): { ok: true; items: BulkMockDraftItem[] } | { ok: false; message: string } {
  const count = Math.floor(params.count)
  if (!Number.isFinite(count) || count < 1 || count > 100) {
    return {
      ok: false,
      message: 'Article count must be between 1 and 100.',
    }
  }

  const generated = generateBulkMockContentsForTag({
    tag: params.tag,
    schema: params.schema,
    count,
    existingRefs: params.existingRefs,
    startSeq: params.startSeq,
  })

  if (!generated.ok) return generated

  const items: BulkMockDraftItem[] = generated.items.map((planned, idx) => {
    const input = parseGeneratedTagBlocks(planned.raw_source, params.schema)
    const ref = planned.external_ref
    const titleCandidate =
      typeof input.title === 'string' && input.title.trim()
        ? input.title.trim()
        : typeof input.wp_title === 'string' && input.wp_title.trim()
          ? input.wp_title.trim()
          : `TEST Mock Article #${idx + 1} (${params.tag.site_key} · ${ref})`

    const bodyCandidate =
      typeof input.body === 'string' && input.body.trim()
        ? input.body.trim()
        : typeof input.wp_body === 'string' && input.wp_body.trim()
          ? input.wp_body.trim()
          : Object.values(input)
              .filter((v) => typeof v === 'string' && v.trim())
              .map(String)
              .join(' · ')

    const payload: SaveLibraryArticleInput = {
      title: titleCandidate.slice(0, 255),
      external_ref: ref,
      ...(params.tag.tag_id != null ? { action_tag_id: params.tag.tag_id } : {}),
      action_tag_key: params.tag.tag_key,
      status: 'ready',
      source_format: 'legacy_input',
      input,
    }

    return {
      key: `${ref}-${idx}`,
      payload,
      previewTitle: payload.title,
      previewBody: bodyCandidate,
      status: 'pending',
    }
  })

  return { ok: true, items }
}

/**
 * Sequentially persist pending/failed Bulk Mock items via POST /api/articles.
 * Skips already-created items so retries never produce duplicate Articles.
 */
export async function runBulkMockCreate(
  items: BulkMockDraftItem[],
  createFn: (input: SaveLibraryArticleInput) => Promise<unknown>,
  onProgress?: (updatedItems: BulkMockDraftItem[]) => void,
): Promise<{
  createdCount: number
  failedCount: number
  items: BulkMockDraftItem[]
}> {
  const working = items.map((item) => ({ ...item }))

  for (let i = 0; i < working.length; i++) {
    const current = working[i]!
    if (current.status === 'created') {
      continue
    }

    working[i] = { ...current, status: 'saving', error: undefined }
    onProgress?.([...working])

    try {
      await createFn(current.payload)
      working[i] = { ...current, status: 'created', error: undefined }
    } catch (err: unknown) {
      working[i] = {
        ...current,
        status: 'failed',
        error: toSafeApiMessage(err),
      }
    }
    onProgress?.([...working])
  }

  const createdCount = working.filter((x) => x.status === 'created').length
  const failedCount = working.filter((x) => x.status === 'failed').length
  return { createdCount, failedCount, items: working }
}
