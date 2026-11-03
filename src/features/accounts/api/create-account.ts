import { ACCOUNTS_PATHS } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'
import { staffApiRequest } from '@/lib/api/http'

import type { AccountItem } from '../types'
import {
  buildCreateAccountBody,
  buildUpdateAccountBody,
  type AccountFormInput,
} from './account-payload'
import type { LiveAccountItem } from './live-types'
import { mapLiveAccountItem } from './map-account'

export type CreateAccountInput = AccountFormInput

export type UpdateAccountInput = AccountFormInput & {
  id: number
}

export type LiveAccountMutationResponse = {
  ok?: boolean
  message?: string
  account?: LiveAccountItem
}

export { buildCreateAccountBody, buildUpdateAccountBody } from './account-payload'

/**
 * POST /social-automation/api/accounts — CP18C.2 create.
 * Sends free-text `username`; does not invent `email`.
 */
export async function createLiveAccount(
  input: CreateAccountInput,
  options?: { signal?: AbortSignal },
): Promise<{ account: AccountItem; message: string }> {
  const built = buildCreateAccountBody(input)
  if (!built.ok) {
    throw new ApiError(built.message, {
      kind: 'validation',
      status: 422,
      code: 'client_validation',
    })
  }

  const payload = await staffApiRequest<LiveAccountMutationResponse>(
    ACCOUNTS_PATHS.list,
    { method: 'POST', body: built.body, signal: options?.signal },
  )

  if (!payload.account) {
    throw new ApiError('Create Account response missing account', {
      kind: 'parse',
      status: null,
    })
  }

  return {
    account: mapLiveAccountItem(payload.account),
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : 'Tài khoản đã được tạo thành công.',
  }
}

/**
 * PUT /social-automation/api/accounts/{id} — CP18C.2 update.
 * Empty password omitted; previous credential preserved.
 */
export async function updateLiveAccount(
  input: UpdateAccountInput,
  options?: { signal?: AbortSignal },
): Promise<{ account: AccountItem; message: string }> {
  const built = buildUpdateAccountBody(input)
  if (!built.ok) {
    throw new ApiError(built.message, {
      kind: 'validation',
      status: 422,
      code: 'client_validation',
    })
  }

  const payload = await staffApiRequest<LiveAccountMutationResponse>(
    ACCOUNTS_PATHS.account(input.id),
    { method: 'PUT', body: built.body, signal: options?.signal },
  )

  if (!payload.account) {
    throw new ApiError('Update Account response missing account', {
      kind: 'parse',
      status: null,
    })
  }

  return {
    account: mapLiveAccountItem(payload.account),
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : 'Cập nhật tài khoản thành công.',
  }
}
