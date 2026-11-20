import { useEffect, useMemo, useState } from 'react'

import { getRpaApiMode } from '@/lib/api/config'
import { toSafeApiMessage } from '@/lib/api/errors'
import { fetchLiveScriptRegistryDetail } from '@/features/script-registry/api/fetch-script-registry'
import type { ScriptDetail } from '@/features/script-registry/types'

import {
  parseScriptInputSchema,
  resolveTestModeCompatibility,
  unavailableScriptInputSchema,
} from './script-compat'
import type { ScriptInputSchema } from './types'

type Options = {
  packageKey: string
  /** Pinned published release version — prefer matching release variables. */
  scriptVersion?: string
  /** Cached detail from Script Registry drawer (optional). */
  cachedDetail?: ScriptDetail | null
  /** Mock adapter schema when mode=mock. */
  mockSchema?: ScriptInputSchema
}

/**
 * Resolve Script input schema from the authoritative published release detail.
 * LIVE: fetches Script Registry detail when not cached.
 * Never invents variables; fail-closed when detail/release/variables missing.
 */
export function usePublishedScriptSchema(options: Options): {
  schema: ScriptInputSchema
  detail: ScriptDetail | null
  loading: boolean
  error: string | null
} {
  const mode = getRpaApiMode()
  const packageKey = options.packageKey.trim()
  const version = options.scriptVersion?.trim() || ''
  const [detail, setDetail] = useState<ScriptDetail | null>(
    options.cachedDetail ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!packageKey) {
      setDetail(null)
      setError(null)
      setLoading(false)
      return
    }

    if (options.cachedDetail) {
      setDetail(options.cachedDetail)
      setError(null)
      setLoading(false)
      return
    }

    if (mode !== 'live') {
      setDetail(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)

    void fetchLiveScriptRegistryDetail(packageKey)
      .then((row) => {
        if (cancelled) return
        setDetail(row)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setDetail(null)
        setError(toSafeApiMessage(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [packageKey, mode, options.cachedDetail])

  const schema = useMemo(() => {
    if (!packageKey) return unavailableScriptInputSchema(null)

    if (mode === 'mock') {
      return options.mockSchema ?? unavailableScriptInputSchema(null)
    }

    if (loading) return unavailableScriptInputSchema(null)

    if (!detail) {
      return unavailableScriptInputSchema(null)
    }

    const testMode = resolveTestModeCompatibility(
      detail,
      options.mockSchema?.test_mode_compatible,
    )
    return parseScriptInputSchema(detail, {
      testModeCompatible: testMode,
      scriptVersion: version || null,
    })
  }, [
    packageKey,
    mode,
    loading,
    detail,
    version,
    options.mockSchema,
  ])

  return { schema, detail, loading, error }
}
