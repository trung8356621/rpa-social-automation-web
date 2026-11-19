/**
 * Verify Authentication Path was actually persisted by the staff API.
 * Never treat a 200 without matching `is_authentication` as success.
 */
export function assertPathAuthenticationPersisted(
  path: { is_authentication?: boolean | null } | null | undefined,
  expected: boolean,
): void {
  if (path == null || typeof path !== 'object') {
    throw new Error(
      'Backend không trả Path sau khi Save — không xác nhận được Authentication Path.',
    )
  }
  if (path.is_authentication === undefined || path.is_authentication === null) {
    throw new Error(
      'Backend không trả is_authentication. Migration/schema Authentication Path chưa sẵn sàng (sa_paths.is_authentication) hoặc addon chưa deploy.',
    )
  }
  if (Boolean(path.is_authentication) !== expected) {
    throw new Error(
      `Authentication Path không được lưu (gửi ${expected ? 'true' : 'false'}, nhận ${String(path.is_authentication)}).`,
    )
  }
}
