import type {
  ActionTagVariantPreference,
  CampaignJobAttempt,
} from './types.ts'

export function formatResourceRecheckLabel(
  seconds: number | null | undefined,
): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return '—'
  }
  const s = Math.trunc(seconds)
  if (s < 60) return `${s} giây`
  if (s % 3600 === 0) return `${s / 3600} giờ`
  if (s % 60 === 0) return `${s / 60} phút`
  const mins = Math.floor(s / 60)
  const rem = s % 60
  return `${mins} phút ${rem} giây`
}

export function formatVariantPreferenceLabel(
  pref: Pick<
    ActionTagVariantPreference,
    'preferred_language_label' | 'preferred_variant_id'
  >,
): { label: string; variant: 'primary' | 'neutral' } {
  const lang = pref.preferred_language_label?.trim()
  if (lang) {
    return { label: `${lang} preferred`, variant: 'primary' }
  }
  const vid =
    pref.preferred_variant_id != null
      ? String(pref.preferred_variant_id).trim()
      : ''
  if (vid) {
    return { label: `Variant #${vid} preferred`, variant: 'primary' }
  }
  return { label: 'Not learned', variant: 'neutral' }
}

/**
 * Surfaces the actual successful language Variant only when Backend provides
 * explicit attempt/result metadata on a successful Attempt.
 * Never infers from screenshot artifacts or initial Variant order.
 */
export function resolveSuccessfulAttemptVariantLabel(
  attempt: Pick<
    CampaignJobAttempt,
    'status' | 'executed_language_label' | 'executed_variant_id'
  >,
): string | null {
  if (attempt.status !== 'success' && attempt.status !== 'completed') {
    return null
  }
  const lang = attempt.executed_language_label?.trim()
  if (lang) return lang
  if (
    attempt.executed_variant_id != null &&
    String(attempt.executed_variant_id).trim() !== ''
  ) {
    return `Variant #${attempt.executed_variant_id}`
  }
  return null
}
