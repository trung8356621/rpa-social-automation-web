/**
 * Pure mappers for Staff Session Account create/update (CP18C.2+).
 * `platform` = Action Registry Site.key.
 * `username` = free-text login identifier (not email-validated).
 * `email` is optional — never fabricated from username.
 * Password is never logged here; callers must not persist it.
 */

export type AccountFormInput = {
  name: string
  /** Free-text Social Account username / login id */
  username: string
  platform: string
  /** Required on create. Empty/omitted on update = keep existing password. */
  password?: string
  /** Optional; omit unless explicitly provided. Never invented. */
  email?: string | null
}

export type AccountApiBody = {
  name: string
  username: string
  platform: string
  email?: string
  password?: string
}

export function buildCreateAccountBody(
  input: AccountFormInput,
):
  | { ok: true; body: AccountApiBody & { password: string } }
  | { ok: false; message: string } {
  const name = input.name.trim()
  if (!name) {
    return { ok: false, message: 'Tên tài khoản (Account Name) là bắt buộc.' }
  }
  // Trim edges only — preserve internal special characters (@, digits, etc.).
  const username = input.username.trim()
  if (!username) {
    return { ok: false, message: 'Username là bắt buộc.' }
  }
  const platform = input.platform.trim()
  if (!platform) {
    return { ok: false, message: 'Site (platform) là bắt buộc.' }
  }
  const password = input.password ?? ''
  if (!password.trim()) {
    return { ok: false, message: 'Password là bắt buộc.' }
  }

  const body: AccountApiBody & { password: string } = {
    name,
    username,
    platform,
    password,
  }

  const email = input.email?.trim()
  if (email) {
    body.email = email
  }

  return { ok: true, body }
}

/**
 * Update body. Password included only when non-empty — empty omits field
 * so Laravel preserves the previous encrypted password.
 * Email omitted unless explicitly provided (never invented from username).
 */
export function buildUpdateAccountBody(
  input: AccountFormInput,
):
  | { ok: true; body: AccountApiBody }
  | { ok: false; message: string } {
  const name = input.name.trim()
  if (!name) {
    return { ok: false, message: 'Tên tài khoản (Account Name) là bắt buộc.' }
  }
  const username = input.username.trim()
  if (!username) {
    return { ok: false, message: 'Username là bắt buộc.' }
  }
  const platform = input.platform.trim()
  if (!platform) {
    return { ok: false, message: 'Site (platform) là bắt buộc.' }
  }

  const body: AccountApiBody = {
    name,
    username,
    platform,
  }

  const email = input.email?.trim()
  if (email) {
    body.email = email
  }

  const password = input.password?.trim() ?? ''
  if (password) {
    body.password = password
  }
  return { ok: true, body }
}

/** Strip secrets before any diagnostic serialization. */
export function redactAccountBodyForDiagnostics(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const copy = { ...body }
  if ('password' in copy) copy.password = '[REDACTED]'
  if ('encrypted_password' in copy) copy.encrypted_password = '[REDACTED]'
  return copy
}
