import type { AuthScriptOption } from '../types'

export type AuthPinPayload =
  | { auth_script_id: number; auth_release_id: number }
  | { clear: true }

/**
 * Map UI Auth Script selection (`script_id` = package_key for live) to staff API pin ids.
 * Verified contract: POST tags + PUT auth-pin use integer package id + release id.
 */
export function resolveAuthPinPayload(
  authScripts: AuthScriptOption[],
  scriptId: string | null | undefined,
  options: { forUpdate: boolean },
): AuthPinPayload | null {
  if (!scriptId) {
    return options.forUpdate ? { clear: true } : null
  }

  const option = authScripts.find((s) => s.script_id === scriptId)
  if (!option) {
    throw new Error('Auth Script không tồn tại trong catalog.')
  }
  if (!option.is_authentication || option.status !== 'published') {
    throw new Error(
      'Auth Script không khả dụng. Chỉ Script Authentication đã published mới được chọn.',
    )
  }
  if (option.package_id == null || !Number.isFinite(option.package_id)) {
    throw new Error(
      'Auth Script thiếu package_id (live catalog). Không thể gửi auth pin.',
    )
  }

  const published = option.releases?.find((r) => r.status === 'published')
  const releaseId = published?.release_id ?? option.releases?.[0]?.release_id
  if (releaseId == null || !Number.isFinite(releaseId)) {
    throw new Error('Auth Script không có published release để pin.')
  }

  return {
    auth_script_id: Number(option.package_id),
    auth_release_id: Number(releaseId),
  }
}
