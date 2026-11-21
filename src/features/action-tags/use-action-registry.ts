import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { assertPathAuthenticationPersisted } from './api/assert-path-auth'
import { fetchLiveActionRegistry } from './api/fetch-action-registry'
import {
  liveDestroyCmsPathTemplate,
  liveDestroySite,
  liveDestroyTag,
  liveStoreCmsPathTemplate,
  liveStoreCmsType,
  liveStorePath,
  liveStoreSite,
  liveStoreTag,
  liveUpdateAuthPin,
  liveUpdateCmsPathTemplate,
  liveUpdateCmsType,
  liveUpdateCmsTypeEnabled,
  liveUpdatePath,
  liveUpdateSite,
  liveUpdateTagEnabled,
} from './api/mutations'
import { resolveAuthPinPayload } from './api/resolve-auth-pin'
import { EMPTY_REGISTRY } from './mock-data'
import type { ActionRegistryData, CmsType, DemoScenario } from './types'
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
    setData(structuredClone(EMPTY_REGISTRY))
    setError(null)
    setAuthRequired(false)

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
  }, [demo, enabled])

  /** Soft registry refresh — never unmount Sites/Paths (no hard reload). */
  const reload = useCallback(async (): Promise<ActionRegistryData> => {
    const registry = await fetchLiveActionRegistry()
    setData(registry)
    setError(null)
    setAuthRequired(false)
    setLoading(false)
    return registry
  }, [])

  const createTag = useCallback(
    async (payload: {
      site_id: number
      path_id: number
      action_key?: string | null
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
        ...(payload.action_key ? { action_key: payload.action_key } : {}),
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

  const toggleTagEnabled = useCallback(
    async (tagId: number, enabled: boolean) => {
      await liveUpdateTagEnabled(tagId, enabled)
      showToast(
        enabled
          ? 'Đã bật Action Tag (live).'
          : 'Đã tắt Action Tag (live — giữ nguyên dữ liệu & Script).',
      )
      await reload()
    },
    [reload, showToast],
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
      cms_type?: CmsType | null
      description?: string
    }): Promise<{ id?: number }> => {
      const mode = siteData.base_url_mode ?? 'fixed'
      const cmsType = siteData.cms_type ?? null
      // Canonical field only — both Fixed and Dynamic use base_url.
      // Do not send test_base_url from the web editor (CP18D.3B).
      const response = siteData.id
        ? await liveUpdateSite(siteData.id, {
            name: siteData.name,
            base_url_mode: mode,
            cms_type: cmsType,
            base_url: siteData.base_url ?? null,
            description: siteData.description ?? null,
          })
        : await liveStoreSite({
            name: siteData.name,
            base_url_mode: mode,
            cms_type: cmsType,
            base_url: siteData.base_url,
            description: siteData.description ?? null,
          })
      showToast(`Đã lưu Site [${siteData.name}] (live).`)
      const registry = await reload()
      const resolvedId =
        siteData.id ??
        (response.site?.id ? Number(response.site.id) : undefined) ??
        registry.sites.find(
          (s) =>
            s.name === siteData.name &&
            (siteData.base_url ? s.base_url === siteData.base_url : true),
        )?.id
      return { id: resolvedId }
    },
    [reload, showToast],
  )

  const deleteSite = useCallback(
    async (siteId: number, siteName: string) => {
      await liveDestroySite(siteId)
      showToast(`Đã xóa Site [${siteName}] (live).`)
      await reload()
    },
    [reload, showToast],
  )

  const savePath = useCallback(
    async (pathData: {
      id?: number
      site_id: number
      key?: string
      name: string
      url_pattern: string
      description?: string
      is_authentication?: boolean
      template_key?: string | null
    }) => {
      const isAuth = Boolean(pathData.is_authentication)
      const isExistingId = pathData.id != null && pathData.id > 0
      const response = isExistingId
        ? await liveUpdatePath(pathData.id!, {
            name: pathData.name,
            url_pattern: pathData.url_pattern,
            description: pathData.description ?? null,
            is_authentication: isAuth,
            ...(pathData.template_key ? { template_key: pathData.template_key } : {}),
          })
        : await liveStorePath({
            site_id: pathData.site_id,
            ...(pathData.key ? { key: pathData.key } : {}),
            name: pathData.name,
            url_pattern: pathData.url_pattern,
            description: pathData.description ?? null,
            is_authentication: isAuth,
            ...(pathData.template_key ? { template_key: pathData.template_key } : {}),
          })

      // PUT/POST must echo persisted flag — do not toast success on silent ignore.
      assertPathAuthenticationPersisted(response.path, isAuth)

      const registry = await reload()
      const pathId = isExistingId ? pathData.id! : Number(response.path?.id)
      const fromRegistry =
        Number.isFinite(pathId) && pathId > 0
          ? registry.paths.find((p) => p.id === pathId)
          : registry.paths.find(
              (p) =>
                p.site_id === pathData.site_id &&
                p.name === pathData.name &&
                p.url_pattern === pathData.url_pattern,
            )
      assertPathAuthenticationPersisted(fromRegistry, isAuth)

      showToast(`Đã lưu Path [${pathData.name}] (live).`)
      return {
        id: Number(fromRegistry!.id),
        is_authentication: Boolean(fromRegistry!.is_authentication),
      }
    },
    [reload, showToast],
  )

  const saveCmsType = useCallback(
    async (cmsData: {
      id?: number
      key?: string
      name: string
      description?: string | null
      is_enabled?: boolean
    }): Promise<{ id: number; key: string }> => {
      if (cmsData.id) {
        await liveUpdateCmsType(cmsData.id, {
          name: cmsData.name,
          description: cmsData.description ?? null,
          is_enabled: cmsData.is_enabled,
        })
        showToast(`Đã cập nhật CMS Type [${cmsData.name}] (live).`)
        const registry = await reload()
        const updated = registry.cms_types.find((c) => c.id === cmsData.id)
        return {
          id: cmsData.id,
          key: updated?.key ?? cmsData.key ?? '',
        }
      }

      const key = (cmsData.key || cmsData.name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
      const res = await liveStoreCmsType({
        key,
        name: cmsData.name,
        description: cmsData.description ?? null,
        is_enabled: cmsData.is_enabled ?? true,
      })
      showToast(`Đã thêm CMS Type [${cmsData.name}] (live).`)
      const registry = await reload()
      const created =
        (res.cms_type?.id
          ? registry.cms_types.find((c) => c.id === res.cms_type!.id)
          : undefined) ?? registry.cms_types.find((c) => c.key === key)
      return {
        id: created?.id ?? Number(res.cms_type?.id ?? 0),
        key: created?.key ?? key,
      }
    },
    [reload, showToast],
  )

  const toggleCmsTypeEnabled = useCallback(
    async (cmsId: number, enabled: boolean) => {
      await liveUpdateCmsTypeEnabled(cmsId, enabled)
      showToast(
        enabled
          ? 'Đã bật CMS Type (live).'
          : 'Đã tắt CMS Type (live).',
      )
      await reload()
    },
    [reload, showToast],
  )

  const saveCmsPathTemplate = useCallback(
    async (
      cmsTypeId: number,
      tplData: {
        id?: number
        key?: string
        name: string
        url_pattern: string
        description?: string | null
        is_authentication?: boolean
      },
    ) => {
      if (tplData.id) {
        await liveUpdateCmsPathTemplate(cmsTypeId, tplData.id, {
          name: tplData.name,
          url_pattern: tplData.url_pattern,
          description: tplData.description ?? null,
          is_authentication: Boolean(tplData.is_authentication),
        })
      } else {
        const key = (tplData.key || tplData.name)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '')
        await liveStoreCmsPathTemplate(cmsTypeId, {
          key,
          name: tplData.name,
          url_pattern: tplData.url_pattern,
          description: tplData.description ?? null,
          is_authentication: Boolean(tplData.is_authentication),
        })
      }
      showToast(`Đã lưu Path Template [${tplData.name}] (live).`)
      await reload()
    },
    [reload, showToast],
  )

  const deleteCmsPathTemplate = useCallback(
    async (cmsTypeId: number, templateId: number) => {
      await liveDestroyCmsPathTemplate(cmsTypeId, templateId)
      showToast('Đã xóa Path Template (live).')
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
      toggleTagEnabled,
      updateTagAuthScript,
      deleteTag,
      saveSite,
      deleteSite,
      savePath,
      saveCmsType,
      toggleCmsTypeEnabled,
      saveCmsPathTemplate,
      deleteCmsPathTemplate,
      reload,
    }),
    [
      authRequired,
      createTag,
      data,
      deleteCmsPathTemplate,
      deleteSite,
      deleteTag,
      demo,
      error,
      loading,
      reload,
      saveCmsPathTemplate,
      saveCmsType,
      savePath,
      saveSite,
      showToast,
      toast,
      toggleCmsTypeEnabled,
      toggleTagEnabled,
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
