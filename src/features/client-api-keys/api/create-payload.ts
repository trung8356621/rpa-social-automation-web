/**
 * Pure Client API Key create payload helpers (backend ≥833e2a3).
 * Never includes raw_key; never trusts client-supplied created_by/issued_by.
 */

export type CreateClientApiKeyInput = {
  name: string
  /**
   * Owner/Admin only. Omit / null = designated owner is authenticated actor (legacy).
   * Staff UI must not send this for arbitrary users.
   */
  assigned_to_user_id?: number | null
  /** When false, assigned_to_user_id is stripped even if provided. */
  canAssignToOthers?: boolean
}

export type CreateClientApiKeyBody = {
  name?: string
  assigned_to_user_id?: number
}

export type BuildCreateClientApiKeyResult =
  | { ok: true; body: CreateClientApiKeyBody }
  | { ok: false; message: string; code: string }

const ASSIGNMENT_ERROR_MESSAGES: Record<string, string> = {
  assignment_forbidden:
    'Only Owner/Admin may assign a Client API Key to another user.',
  assigned_user_invalid: 'Assigned user was not found or is invalid.',
  assigned_user_ineligible:
    'Assigned user is not an eligible Staff/Owner in this account scope.',
}

export function buildCreateClientApiKeyBody(
  input: CreateClientApiKeyInput,
): BuildCreateClientApiKeyResult {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const body: CreateClientApiKeyBody = {}
  if (name !== '') {
    body.name = name
  }

  const canAssign = input.canAssignToOthers === true
  const assigned = input.assigned_to_user_id

  if (assigned == null || assigned === undefined) {
    return { ok: true, body }
  }

  if (!canAssign) {
    // Non-Owner: never forward assignment — backend would 403; keep legacy self-create.
    return { ok: true, body }
  }

  if (!Number.isFinite(assigned) || !Number.isInteger(assigned) || assigned <= 0) {
    return {
      ok: false,
      message: 'assigned_to_user_id must be a positive integer.',
      code: 'assigned_user_invalid',
    }
  }

  body.assigned_to_user_id = assigned
  return { ok: true, body }
}

/** Map stable backend error codes to UX copy (fixtures / live ApiError.code). */
export function messageForClientKeyAssignmentError(
  code: string | null | undefined,
  fallback?: string | null,
): string {
  if (code && ASSIGNMENT_ERROR_MESSAGES[code]) {
    return ASSIGNMENT_ERROR_MESSAGES[code]
  }
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim()
  }
  return 'Client API Key creation failed.'
}

/**
 * Strip secret-bearing fields from a create response for diagnostics/tests.
 * Never returns raw_key.
 */
export function redactCreateClientKeyResponseForDiagnostics(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'raw_key' || k === 'encrypted_key' || k === 'key_hash') {
      out[k] = '[redacted]'
      continue
    }
    if (k === 'key' && v && typeof v === 'object' && !Array.isArray(v)) {
      const key = v as Record<string, unknown>
      const safeKey: Record<string, unknown> = {}
      for (const [kk, vv] of Object.entries(key)) {
        if (kk === 'raw_key' || kk === 'encrypted_key' || kk === 'key_hash') {
          safeKey[kk] = '[redacted]'
        } else {
          safeKey[kk] = vv
        }
      }
      out[k] = safeKey
      continue
    }
    out[k] = v
  }
  return out
}
