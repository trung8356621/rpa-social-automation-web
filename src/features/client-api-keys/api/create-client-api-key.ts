import { CLIENT_API_KEYS_PATHS } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'
import { staffApiRequest } from '@/lib/api/http'

import type { ClientApiKeyItem } from '../types'
import {
  buildCreateClientApiKeyBody,
  messageForClientKeyAssignmentError,
  type CreateClientApiKeyInput,
} from './create-payload'
import type { LiveCreateClientApiKeyResponse } from './live-types'
import { mapLiveClientApiKeyItem } from './map-client-api-key'

export type { CreateClientApiKeyInput } from './create-payload'

export type CreateClientApiKeyResult = {
  key: ClientApiKeyItem
  /** One-time reveal — caller must hold only in ephemeral UI state. */
  rawKey: string
  message: string
}

/**
 * POST /social-automation/api/client-keys — Staff Session + CSRF.
 * Returns raw_key once; never persists it.
 */
export async function createLiveClientApiKey(
  input: CreateClientApiKeyInput,
  options?: { signal?: AbortSignal },
): Promise<CreateClientApiKeyResult> {
  const built = buildCreateClientApiKeyBody(input)
  if (!built.ok) {
    throw new ApiError(built.message, {
      kind: 'validation',
      status: 422,
      code: built.code,
    })
  }

  let payload: LiveCreateClientApiKeyResponse
  try {
    payload = await staffApiRequest<LiveCreateClientApiKeyResponse>(
      CLIENT_API_KEYS_PATHS.create,
      { method: 'POST', body: built.body, signal: options?.signal },
    )
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw new ApiError(
        messageForClientKeyAssignmentError(err.code, err.message),
        {
          kind: err.kind,
          status: err.status,
          code: err.code,
          details: err.details,
          cause: err,
        },
      )
    }
    throw err
  }

  const rawKey =
    typeof payload.raw_key === 'string' ? payload.raw_key.trim() : ''
  if (!rawKey) {
    throw new ApiError('Create Key response missing raw_key.', {
      kind: 'parse',
      status: null,
    })
  }
  if (!payload.key) {
    throw new ApiError('Create Key response missing key metadata.', {
      kind: 'parse',
      status: null,
    })
  }

  return {
    key: mapLiveClientApiKeyItem(payload.key),
    rawKey,
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : 'Client API Key created. Copy the raw key now — it will not be shown again.',
  }
}
