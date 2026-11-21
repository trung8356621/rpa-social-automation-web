import { useEffect, useMemo, useState } from 'react'

import { fetchLiveScriptRegistryDetail } from '@/features/script-registry/api/fetch-script-registry'
import type { ScriptDetail } from '@/features/script-registry/types'
import { getRpaApiMode } from '@/lib/api/config'
import { toSafeApiMessage } from '@/lib/api/errors'

import { scriptTargetKey, type ScriptSchemaLookup } from './multi-tag-plan'
import {
  parseScriptInputSchema,
  resolveTestModeCompatibility,
  unavailableScriptInputSchema,
} from './script-compat'
import type { ScriptInputSchema } from './types'

export type ScriptTargetRef = {
  packageKey: string
  scriptVersion: string
}

type FetchState = {
  details: Record<string, ScriptDetail>
  loading: Record<string, boolean>
  errors: Record<string, string>
}

/**
 * Resolve published ScriptInputSchema for multiple (packageKey, scriptVersion)
 * targets. Uses cached Script Registry details first; fetches missing details
 * in LIVE mode; uses mockSchemaLookup in MOCK mode. Never invents variables.
 */
export function useMultiScriptSchemas(params: {
  targets: ScriptTargetRef[]
  cachedDetails: Record<string, ScriptDetail>
  getMockSchema: (packageKey: string) => ScriptInputSchema | undefined
}): ScriptSchemaLookup {
  const mode = getRpaApiMode()
  const [state, setState] = useState<FetchState>({
    details: {},
    loading: {},
    errors: {},
  })

  const uniquePackages = useMemo(() => {
    const set = new Set<string>()
    for (const t of params.targets) {
      const pk = t.packageKey.trim()
      if (pk) set.add(pk)
    }
    return Array.from(set).sort()
  }, [params.targets])

  const packagesKey = uniquePackages.join('|')

  useEffect(() => {
    if (mode !== 'live' || uniquePackages.length === 0) return

    let cancelled = false
    const toFetch = uniquePackages.filter(
      (pk) => !params.cachedDetails[pk] && !state.details[pk],
    )
    if (toFetch.length === 0) return

    setState((prev) => {
      const nextLoading = { ...prev.loading }
      for (const pk of toFetch) nextLoading[pk] = true
      return { ...prev, loading: nextLoading }
    })

    for (const pk of toFetch) {
      void fetchLiveScriptRegistryDetail(pk)
        .then((detail) => {
          if (cancelled) return
          setState((prev) => ({
            details: { ...prev.details, [pk]: detail },
            loading: { ...prev.loading, [pk]: false },
            errors: prev.errors,
          }))
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setState((prev) => ({
            details: prev.details,
            loading: { ...prev.loading, [pk]: false },
            errors: { ...prev.errors, [pk]: toSafeApiMessage(err) },
          }))
        })
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, packagesKey, params.cachedDetails])

  return useMemo(() => {
    const lookup: ScriptSchemaLookup = {}
    for (const target of params.targets) {
      const pk = target.packageKey.trim()
      const ver = target.scriptVersion.trim()
      if (!pk) continue
      const tKey = scriptTargetKey(pk, ver)
      if (lookup[tKey]) continue

      if (mode === 'mock') {
        const mockSchema = params.getMockSchema(pk)
        lookup[tKey] = {
          schema:
            mockSchema ??
            unavailableScriptInputSchema(
              null,
              `Mock schema unavailable for ${pk}.`,
            ),
          loading: false,
          error: mockSchema ? null : `Mock schema unavailable for ${pk}.`,
        }
        continue
      }

      const detail = params.cachedDetails[pk] ?? state.details[pk] ?? null
      const isLoading = Boolean(state.loading[pk]) && !detail
      const err = state.errors[pk] ?? null

      if (isLoading) {
        lookup[tKey] = {
          schema: unavailableScriptInputSchema(null),
          loading: true,
          error: null,
        }
        continue
      }

      if (!detail) {
        lookup[tKey] = {
          schema: unavailableScriptInputSchema(null, err),
          loading: false,
          error: err,
        }
        continue
      }

      const testMode = resolveTestModeCompatibility(detail, undefined)
      const parsed = parseScriptInputSchema(detail, {
        testModeCompatible: testMode,
        scriptVersion: ver || null,
      })
      lookup[tKey] = {
        schema: parsed,
        loading: false,
        error: parsed.schema_available ? null : parsed.unavailable_reason,
      }
    }
    return lookup
  }, [
    mode,
    params.targets,
    params.cachedDetails,
    params.getMockSchema,
    state.details,
    state.loading,
    state.errors,
  ])
}
