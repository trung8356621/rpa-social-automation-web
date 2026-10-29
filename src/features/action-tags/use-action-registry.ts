import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { fetchLiveActionRegistry } from './api/fetch-action-registry'
import {
  liveDestroyTag,
  liveStorePath,
  liveStoreSite,
  liveStoreTag,
  liveUpdateAuthPin,
  liveUpdatePath,
  liveUpdateSite,
} from './api/mutations'
import { resolveAuthPinPayload } from './api/resolve-auth-pin'
import { EMPTY_REGISTRY } from './mock-data'
import type { ActionRegistryData, DemoScenario } from './types'
import { useActionRegistryMock } from './use-action-registry-mock'

function useActionRegistryLive(enabled: boolean) {
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'

  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [data, setData] = useState<ActionRegistryData>(() =>
    structuredClone(EMPTY_REGISTRY),
  )
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 3500)
    },
    [],
  )

  useEffect(() => {
    if (!enabled) return

    // demo=* helpers are visual QA only — never inject mock WordPress/tag rows in live
    if (demo === 'loading') {
      setLoading(true)
      setError(null)
      setAuthRequired(false)
      return
    }
    if (demo === 'error') {
      setLoading(false)
      setAuthRequired(false)
      setData(structuredClone(EMPTY_REGISTRY))
      setError('LIVE ERROR — Action Registry request failed (local QA scenario).')
      return
    }
    if (
      demo === 'empty-tags' ||
      demo === 'empty-sites' ||
      demo === 'empty-auth-scripts'
    ) {
      setLoading(false)
      setAuthRequired(false)
      setError(null)
      setData(structuredClone(EMPTY_REGISTRY))
      return
    }

    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)
    setAuthRequired(false)
    setData(structuredClone(EMPTY_REGISTRY))

    void fetchLiveActionRegistry({ signal: controller.signal })
      .then((registry) => {
        if (cancelled) return
        setData(registry)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setData(structuredClone(EMPTY_REGISTRY))
          setLoading(false)
          return
        }
        setAuthRequired(false)
        setError(toSafeApiMessage(err))
        setData(structuredClone(EMPTY_REGISTRY))
        setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [demo, enabled, reloadToken])

  const reload = useCallback(async () => {
    setReloadToken((n) => n + 1)
  }, [])

  const createTag = useCallback(
    async (payload: {
      site_id: number
      path_id: number
      action_key: string
      auth_script_id?: string | null
    }) => {
      const pin = resolveAuthPinPayload(
        data.auth_scripts,
        payload.auth_script_id,
        { forUpdate: false },
      )
      const body = {
        site_id: payload.site_id,
        path_id: payload.path_id,
        action_key: payload.action_key,
        ...(pin && 'auth_script_id' in pin
          ? {
              auth_script_id: pin.auth_script_id,
              auth_release_id: pin.auth_release_id,
            }
          : {}),
      }

      await liveStoreTag(body)
      showToast(
        pin && 'auth_script_id' in pin
          ? 'Đã tạo Action Tag + Auth Script pin (live). Script Request đã được tạo.'
          : 'Đã tạo Action Tag (live). Script Request đã được tạo.',
      )
      await reload()
    },
    [data.auth_scripts, reload, showToast],
  )

  const updateTagAuthScript = useCallback(
    async (tagId: number, authScriptId: string | null) => {
      const pin = resolveAuthPinPayload(data.auth_scripts, authScriptId, {
        forUpdate: true,
      })
      if (!pin) {
        throw new Error('Không xác định được Auth pin payload.')
      }
      await liveUpdateAuthPin(tagId, pin)
      showToast(
        'clear' in pin
          ? 'Đã gỡ Auth Script pin (live).'
          : 'Đã cập nhật Auth Script pin (live).',
      )
      await reload()
    },
    [data.auth_scripts, reload, showToast],
  )

  const deleteTag = useCallback(
    async (tagId: number, tagKey: string) => {
      if (!window.confirm(`Bạn có chắc muốn xóa Action Tag [${tagKey}] không?`)) {
        return
      }
      await liveDestroyTag(tagId)
      showToast(`Đã xóa Action Tag [${tagKey}] (live).`)
      await reload()
    },
    [reload, showToast],
  )

  const saveSite = useCallback(
    async (siteData: {
      id?: number
      name: string
      base_url?: string
      base_url_mode?: 'fixed' | 'dynamic'
      test_base_url?: string
      description?: string
    }) => {
      const mode = siteData.base_url_mode ?? 'fixed'
      if (siteData.id) {
        await liveUpdateSite(siteData.id, {
          name: siteData.name,
          base_url_mode: mode,
          base_url: siteData.base_url ?? null,
          test_base_url: siteData.test_base_url ?? null,
          description: siteData.description ?? null,
        })
      } else {
        await liveStoreSite({
          name: siteData.name,
          base_url_mode: mode,
          base_url: siteData.base_url,
          test_base_url: siteData.test_base_url ?? null,
          description: siteData.description ?? null,
        })
      }
      showToast(`Đã lưu Site [${siteData.name}] (live).`)
      await reload()
    },
    [reload, showToast],
  )

  const savePath = useCallback(
    async (pathData: {
      id?: number
      site_id: number
      name: string
      url_pattern: string
      description?: string
    }) => {
      if (pathData.id) {
        await liveUpdatePath(pathData.id, {
          name: pathData.name,
          url_pattern: pathData.url_pattern,
          description: pathData.description ?? null,
        })
      } else {
        await liveStorePath({
          site_id: pathData.site_id,
          name: pathData.name,
          url_pattern: pathData.url_pattern,
          description: pathData.description ?? null,
        })
      }
      showToast(`Đã lưu Path [${pathData.name}] (live).`)
      await reload()
    },
    [reload, showToast],
  )

  return useMemo(
    () => ({
      mode: 'live' as const satisfies RpaApiMode,
      mutationsEnabled: true,
      demo,
      loading,
      error,
      authRequired,
      data,
      toast,
      showToast,
      createTag,
      updateTagAuthScript,
      deleteTag,
      saveSite,
      savePath,
      reload,
    }),
    [
      authRequired,
      createTag,
      data,
      deleteTag,
      demo,
      error,
      loading,
      reload,
      savePath,
      saveSite,
      showToast,
      toast,
      updateTagAuthScript,
    ],
  )
}

/**
 * Action Tags data hook — mock (default) or live staff API (read + verified mutations).
 * Live never silently falls back to mock records.
 */
export function useActionRegistry() {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const mock = useActionRegistryMock({ enabled: !isLive })
  const live = useActionRegistryLive(isLive)

  if (isLive) return live

  return {
    mode: 'mock' as const satisfies RpaApiMode,
    mutationsEnabled: true,
    authRequired: false,
    ...mock,
  }
}

export type ActionRegistryController = ReturnType<typeof useActionRegistry>
