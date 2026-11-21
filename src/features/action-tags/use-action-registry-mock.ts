import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  setActionTagEnabled,
  syncActionTagsForSites,
} from './auto-tag-lifecycle'
import {
  resolveEffectivePathsForSite,
  validateSitePathUniqueness,
} from './cms-templates'
import { EMPTY_REGISTRY, MOCK_ACTION_REGISTRY } from './mock-data'
import type {
  ActionRegistryData,
  ActionTagAuthScript,
  CmsType,
  DemoScenario,
  PathItem,
  Site,
} from './types'
import {
  buildTagKey,
  delay,
  findExistingSitePathTag,
  parseInputsFromPattern,
  slugifyKey,
} from './utils'

function cloneSeed(scenario: DemoScenario): ActionRegistryData {
  if (scenario === 'empty-sites' || scenario === 'error') {
    return structuredClone(EMPTY_REGISTRY)
  }
  if (scenario === 'empty-tags') {
    const data = structuredClone(MOCK_ACTION_REGISTRY)
    data.tags = []
    data.requests = []
    return data
  }
  if (scenario === 'empty-auth-scripts') {
    const data = structuredClone(MOCK_ACTION_REGISTRY)
    data.auth_scripts = []
    data.tags = data.tags.map((t) => ({ ...t, auth_script: null }))
    const synced = syncActionTagsForSites(
      data.sites,
      data.paths,
      data.tags,
      data.requests,
    )
    data.tags = synced.tags
    data.requests = synced.requests
    return data
  }
  const data = structuredClone(MOCK_ACTION_REGISTRY)
  const synced = syncActionTagsForSites(
    data.sites,
    data.paths,
    data.tags,
    data.requests,
  )
  data.tags = synced.tags
  data.requests = synced.requests
  return data
}

function nextId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

export function useActionRegistryMock(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ActionRegistryData>(() => cloneSeed(demo))
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

    let cancelled = false
    setLoading(true)
    setError(null)
    setData(cloneSeed(demo))

    void delay(demo === 'loading' ? 1200 : 180).then(() => {
      if (cancelled) return
      if (demo === 'error') {
        setError('MOCK ERROR — không tải được Action Registry (local demo).')
        setLoading(false)
        return
      }
      if (demo === 'loading') {
        // stay loading for screenshot; resolve shortly after
        window.setTimeout(() => {
          if (!cancelled) {
            setData(cloneSeed('default'))
            setLoading(false)
          }
        }, 800)
        return
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [demo, enabled])

  const createTag = useCallback(
    async (payload: {
      site_id: number
      path_id: number
      action_key?: string | null
      auth_script_id?: string | null
    }) => {
      await delay(280)
      const site = data.sites.find((s) => s.id === payload.site_id)
      const path = data.paths.find((p) => p.id === payload.path_id)

      if (!site || !path) {
        throw new Error('Site hoặc Path không hợp lệ.')
      }

      if (path.site_id !== site.id) {
        throw new Error('Path không thuộc Site đã chọn.')
      }

      const actionKeyTrimmed = payload.action_key?.trim() || null
      const action = actionKeyTrimmed
        ? (data.actions.find((a) => a.key === actionKeyTrimmed) ?? {
            id: 0,
            key: actionKeyTrimmed,
            name: actionKeyTrimmed,
          })
        : null

      const tagKey = buildTagKey(site.key, path.key, action?.key)
      if (!tagKey) {
        throw new Error('Tag Key không hợp lệ.')
      }

      const existing =
        data.tags.find((t) => t.tag_key === tagKey) ??
        (!action ? findExistingSitePathTag(data.tags, site, path) : null)

      if (existing) {
        throw new Error(`Action Tag [${existing.tag_key}] đã tồn tại.`)
      }

      let authScript: ActionTagAuthScript = null
      if (payload.auth_script_id) {
        const option = data.auth_scripts.find(
          (s) => s.script_id === payload.auth_script_id,
        )
        if (!option || option.status !== 'published' || !option.is_authentication) {
          throw new Error(
            'Auth Script không khả dụng (MOCK). Chỉ Script Authentication đã published mới được chọn.',
          )
        }
        authScript = {
          script_id: option.script_id,
          name: option.name,
          version: option.version,
        }
      }

      const requestId = `req_mock_${Date.now()}`
      const tagId = nextId(data.tags)

      setData((prev) => ({
        ...prev,
        tags: [
          {
            id: tagId,
            tag_key: tagKey,
            site_id: site.id,
            site_key: site.key,
            site_name: site.name,
            path_id: path.id,
            path_key: path.key,
            path_name: path.name,
            action_id: action?.id || null,
            action_key: action?.key ?? null,
            action_name: action?.name ?? null,
            name: tagKey,
            scripts_count: 0,
            ready: false,
            enabled: true,
            published_script_available: false,
            latest_request_status: 'pending',
            latest_request_id: requestId,
            auth_script: authScript,
          },
          ...prev.tags,
        ],
        requests: [
          {
            id: nextId(prev.requests),
            request_id: requestId,
            action_tag_key: tagKey,
            request_type: 'create',
            status: 'pending',
            created_at: new Date().toISOString(),
          },
          ...prev.requests,
        ],
      }))

      showToast(
        authScript
          ? `Đã tạo Action Tag [${tagKey}] + Auth Script (MOCK local).`
          : `Đã tạo Action Tag [${tagKey}] và tự động tạo Script Request!`,
      )
    },
    [data.actions, data.auth_scripts, data.paths, data.sites, data.tags, showToast],
  )

  /** MOCK Auth Script pin update (mirrors live PUT .../auth-pin). */
  const updateTagAuthScript = useCallback(
    async (tagId: number, authScriptId: string | null) => {
      await delay(220)
      let authScript: ActionTagAuthScript = null
      if (authScriptId) {
        const option = data.auth_scripts.find((s) => s.script_id === authScriptId)
        if (!option || option.status !== 'published' || !option.is_authentication) {
          throw new Error(
            'Auth Script không khả dụng (MOCK). Chỉ Script Authentication đã published mới được chọn.',
          )
        }
        authScript = {
          script_id: option.script_id,
          name: option.name,
          version: option.version,
        }
      }

      setData((prev) => ({
        ...prev,
        tags: prev.tags.map((t) =>
          t.id === tagId ? { ...t, auth_script: authScript } : t,
        ),
      }))

      showToast(
        authScript
          ? 'Đã cập nhật Auth Script trên mock local.'
          : 'Đã gỡ Auth Script trên mock local.',
        'success',
      )
    },
    [data.auth_scripts, showToast],
  )

  const toggleTagEnabled = useCallback(
    async (tagId: number, enabled: boolean) => {
      await delay(140)
      const target = data.tags.find((t) => t.id === tagId)
      setData((prev) => ({
        ...prev,
        tags: setActionTagEnabled(prev.tags, tagId, enabled),
      }))
      showToast(
        enabled
          ? `Đã bật Action Tag [${target?.tag_key ?? tagId}] (MOCK local).`
          : `Đã tắt Action Tag [${target?.tag_key ?? tagId}] (MOCK local — giữ nguyên dữ liệu & Script).`,
      )
    },
    [data.tags, showToast],
  )

  const deleteTag = useCallback(
    async (tagId: number, tagKey: string) => {
      if (!window.confirm(`Bạn có chắc muốn xóa Action Tag [${tagKey}] không?`)) {
        return
      }
      await delay(180)
      setData((prev) => ({
        ...prev,
        tags: prev.tags.filter((t) => t.id !== tagId),
      }))
      showToast(`Đã xóa Action Tag [${tagKey}] thành công!`)
    },
    [showToast],
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
      await delay(280)
      const mode = siteData.base_url_mode ?? 'fixed'
      const cmsType = siteData.cms_type ?? null
      const key = slugifyKey(siteData.name)
      const baseUrl = siteData.base_url || ''
      const savedId = siteData.id ?? nextId(data.sites)

      setData((prev) => {
        const nextSites = siteData.id
          ? prev.sites.map((s) =>
              s.id === siteData.id
                ? {
                    ...s,
                    name: siteData.name,
                    key: s.key,
                    base_url: baseUrl,
                    base_url_mode: mode,
                    cms_type: cmsType,
                    description: siteData.description || null,
                  }
                : s,
            )
          : [
              ...prev.sites,
              {
                id: savedId,
                key,
                name: siteData.name,
                base_url: baseUrl,
                base_url_mode: mode,
                cms_type: cmsType,
                description: siteData.description || null,
                paths_count: 0,
              } satisfies Site,
            ]

        const synced = syncActionTagsForSites(
          nextSites,
          prev.paths,
          prev.tags,
          prev.requests,
        )

        return {
          ...prev,
          sites: nextSites,
          tags: synced.tags,
          requests: synced.requests,
        }
      })

      showToast(`Đã lưu Site [${siteData.name}] thành công!`)
      return { id: savedId }
    },
    [data.sites, showToast],
  )

  const deleteSite = useCallback(
    async (siteId: number, siteName: string) => {
      await delay(200)
      const siteTags = data.tags.filter((t) => t.site_id === siteId)
      const hasPublishedScript = siteTags.some(
        (t) => t.scripts_count > 0 || t.published_script_available,
      )
      if (hasPublishedScript) {
        throw new Error(
          `Không thể xóa Site [${siteName}] vì đang có Action Tag gắn Script đã xuất bản.`,
        )
      }
      const removedTagKeys = new Set(siteTags.map((t) => t.tag_key))
      setData((prev) => ({
        ...prev,
        sites: prev.sites.filter((s) => s.id !== siteId),
        paths: prev.paths.filter((p) => p.site_id !== siteId),
        tags: prev.tags.filter((t) => t.site_id !== siteId),
        requests: prev.requests.filter(
          (r) => !removedTagKeys.has(r.action_tag_key),
        ),
      }))
      showToast(`Đã xóa Site [${siteName}] thành công!`)
    },
    [data.tags, showToast],
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
      await delay(280)
      const site = data.sites.find((s) => s.id === pathData.site_id)
      if (!site) throw new Error('Site không tồn tại.')

      const effectivePaths = resolveEffectivePathsForSite(site, data.paths)
      const isExistingPersistedPath =
        pathData.id != null && pathData.id > 0
      const existingPath = isExistingPersistedPath
        ? data.paths.find((p) => p.id === pathData.id)
        : undefined
      const key =
        pathData.key?.trim() ||
        existingPath?.key ||
        pathData.template_key?.trim() ||
        slugifyKey(pathData.name)

      const uniqueness = validateSitePathUniqueness(effectivePaths, {
        id: isExistingPersistedPath ? pathData.id : undefined,
        key,
        url_pattern: pathData.url_pattern,
        template_key: pathData.template_key ?? existingPath?.template_key,
      })
      if (!uniqueness.ok) {
        throw new Error(uniqueness.error)
      }

      const pathInputs = parseInputsFromPattern(pathData.url_pattern)
      const isAuth = Boolean(pathData.is_authentication)
      const savedId = isExistingPersistedPath
        ? pathData.id!
        : nextId(data.paths)

      setData((prev) => {
        const nextPaths = isExistingPersistedPath
          ? prev.paths.map((p) =>
              p.id === savedId
                ? {
                    ...p,
                    name: pathData.name,
                    url_pattern: pathData.url_pattern,
                    path_inputs: pathInputs,
                    description: pathData.description || null,
                    is_authentication: isAuth,
                  }
                : p,
            )
          : [
              ...prev.paths,
              {
                id: savedId,
                site_id: site.id,
                site_key: site.key,
                key,
                name: pathData.name,
                url_pattern: pathData.url_pattern,
                path_inputs: pathInputs,
                description: pathData.description || null,
                is_authentication: isAuth,
                source: 'site',
                template_key: pathData.template_key ?? null,
                is_override: Boolean(pathData.template_key),
              } satisfies PathItem,
            ]

        const nextSites = prev.sites.map((s) =>
          s.id === site.id
            ? {
                ...s,
                paths_count: nextPaths.filter((p) => p.site_id === s.id).length,
              }
            : s,
        )

        const synced = syncActionTagsForSites(
          nextSites,
          nextPaths,
          prev.tags,
          prev.requests,
        )

        return {
          ...prev,
          paths: nextPaths,
          sites: nextSites,
          tags: synced.tags,
          requests: synced.requests,
        }
      })

      showToast(`Đã lưu Path [${pathData.name}] thành công!`)
      return { id: savedId, is_authentication: isAuth }
    },
    [data.sites, data.paths, showToast],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    await delay(300)
    setData(cloneSeed(demo === 'loading' ? 'default' : demo))
    setLoading(false)
  }, [demo])

  return useMemo(
    () => ({
      demo,
      loading,
      error,
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
      reload,
    }),
    [
      createTag,
      data,
      deleteSite,
      deleteTag,
      demo,
      error,
      loading,
      reload,
      savePath,
      saveSite,
      showToast,
      toast,
      toggleTagEnabled,
      updateTagAuthScript,
    ],
  )
}
