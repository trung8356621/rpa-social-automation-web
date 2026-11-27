import { staffApiRequest } from '@/lib/api/http'
import { ApiError } from '@/lib/api/errors'

export type Roi = { x: number; y: number; width: number; height: number }
export type TemplateInput = {
  attempt_uuid: string
  artifact_uuid: string
  modal_roi: Roi
  target_roi?: Roi
  match_threshold: number
}
export type Template = {
  visual_template_id: string
  source_artifact_id: number
  modal_roi: Roi
  target_roi: Roi | null
  match_threshold: number
  version: number
  enabled: boolean
}
export type ErrorTag = {
  error_tag_id: string
  name: string
  platform: string
  enabled: boolean
  handler_release_id: number | null
  templates: Template[]
}

const root = '/social-automation/api/recovery-registry/error-tags'
const tagPath = (id: string) => root + '/' + encodeURIComponent(id)

export const recoveryApi = {
  list: (signal?: AbortSignal) => staffApiRequest<{ error_tags: ErrorTag[] }>(root, { signal }),
  create: (body: TemplateInput & { name: string; platform: string }) =>
    staffApiRequest(root, { method: 'POST', body }),
  update: (id: string, body: { name: string; is_enabled: boolean }) =>
    staffApiRequest(tagPath(id), { method: 'PATCH', body }),
  addTemplate: (id: string, body: TemplateInput) =>
    staffApiRequest(tagPath(id) + '/templates', { method: 'POST', body }),
  updateTemplate: (id: string, template: string, body: { is_enabled?: boolean; match_threshold?: number; modal_roi?: Roi; target_roi?: Roi | null }) =>
    staffApiRequest(tagPath(id) + '/templates/' + encodeURIComponent(template), { method: 'PATCH', body }),
  bind: (id: string, release_id: number | null) =>
    staffApiRequest(tagPath(id) + '/handler', { method: 'PUT', body: { release_id } }),
  request: (id: string, notes: string) =>
    staffApiRequest<{ request_uuid: string; idempotent: boolean }>(tagPath(id) + '/handler-request', {
      method: 'POST', body: { notes },
    }),
}

export function recoveryError(error: unknown): string {
  if (error instanceof ApiError && Array.isArray(error.details?.errors)) {
    return error.details.errors.join(', ')
  }
  return error instanceof Error ? error.message : 'Recovery Registry request failed.'
}
