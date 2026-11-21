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
  CmsPathTemplate,
  CmsType,
  CmsTypeItem,
  DemoScenario,
  PathItem,
  Site,
} from './types'
import {
  buildTagKey,
  delay,
  findExistingSitePathTag,
  normalizeTagSegment,
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
      data.cms_types,
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
    data.cms_types,
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
          prev.cms_types,
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

      const effectivePaths = resolveEffectivePathsForSite(
        site,
        data.paths,
        data.cms_types,
      )
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
          prev.cms_types,
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

  const saveCmsType = useCallback(
    async (cmsData: {
      id?: number
      key?: string
      name: string
      description?: string | null
      is_enabled?: boolean
    }): Promise<{ id: number; key: string }> => {
      await delay(200)
      const trimmedName = cmsData.name.trim()
      if (!trimmedName) throw new Error('Tên CMS Type không được để trống.')

      if (cmsData.id) {
        const existing = data.cms_types.find((c) => c.id === cmsData.id)
        if (!existing) throw new Error('CMS Type không tồn tại.')
        setData((prev) => ({
          ...prev,
          cms_types: prev.cms_types.map((c) =>
            c.id === cmsData.id
              ? {
                  ...c,
                  name: trimmedName,
                  description: cmsData.description ?? null,
                  is_enabled: cmsData.is_enabled ?? c.is_enabled,
                }
              : c,
          ),
        }))
        showToast(`Đã cập nhật CMS Type [${trimmedName}] (MOCK local).`)
        return { id: existing.id, key: existing.key }
      }

      const key = normalizeTagSegment(cmsData.key || trimmedName)
      if (!key || key === 'custom' || key === 'none') {
        throw new Error('CMS Type key không hợp lệ.')
      }
      if (data.cms_types.some((c) => c.key === key)) {
        throw new Error(`CMS Type key [${key}] đã tồn tại.`)
      }

      const id = nextId(data.cms_types)
      const created: CmsTypeItem = {
        id,
        key,
        name: trimmedName,
        description: cmsData.description ?? null,
        is_enabled: cmsData.is_enabled ?? true,
        path_templates: [],
      }
      setData((prev) => ({
        ...prev,
        cms_types: [...prev.cms_types, created],
      }))
      showToast(`Đã thêm CMS Type [${trimmedName}] (MOCK local).`)
      return { id, key }
    },
    [data.cms_types, showToast],
  )

  const toggleCmsTypeEnabled = useCallback(
    async (cmsId: number, enabled: boolean) => {
      await delay(140)
      const target = data.cms_types.find((c) => c.id === cmsId)
      if (!target) throw new Error('CMS Type không tồn tại.')
      setData((prev) => ({
        ...prev,
        cms_types: prev.cms_types.map((c) =>
          c.id === cmsId ? { ...c, is_enabled: enabled } : c,
        ),
      }))
      showToast(
        enabled
          ? `Đã bật CMS Type [${target.name}] (MOCK local).`
          : `Đã tắt CMS Type [${target.name}] (MOCK local).`,
      )
    },
    [data.cms_types, showToast],
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
      await delay(200)
      const cms = data.cms_types.find((c) => c.id === cmsTypeId)
      if (!cms) throw new Error('CMS Type không tồn tại.')

      const trimmedName = tplData.name.trim()
      const trimmedPattern = tplData.url_pattern.trim()
      if (!trimmedName || !trimmedPattern) {
        throw new Error('Vui lòng nhập đầy đủ Tên và URL Pattern cho Path Template.')
      }

      const tplKey = normalizeTagSegment(tplData.key || trimmedName)
      if (!tplKey) throw new Error('Template key không hợp lệ.')

      const duplicate = cms.path_templates.find(
        (t) =>
          t.id !== tplData.id &&
          (normalizeTagSegment(t.key) === tplKey ||
            t.url_pattern.trim() === trimmedPattern),
      )
      if (duplicate) {
        throw new Error(
          `Path Template [${tplKey}] hoặc URL Pattern [${trimmedPattern}] đã tồn tại trong ${cms.name}.`,
        )
      }

      const nextTpl: CmsPathTemplate = {
        id:
          tplData.id ??
          cms.path_templates.reduce((m, t) => Math.max(m, t.id ?? 0), 0) + 1,
        cms_type: cms.key,
        key: tplKey,
        name: trimmedName,
        url_pattern: trimmedPattern,
        path_inputs: parseInputsFromPattern(trimmedPattern),
        description: tplData.description ?? null,
        is_authentication: Boolean(tplData.is_authentication),
      }

      setData((prev) => {
        const nextCmsTypes = prev.cms_types.map((c) => {
          if (c.id !== cmsTypeId) return c
          const nextTemplates = tplData.id
            ? c.path_templates.map((t) => (t.id === tplData.id ? nextTpl : t))
            : [...c.path_templates, nextTpl]
          return { ...c, path_templates: nextTemplates }
        })

        const synced = syncActionTagsForSites(
          prev.sites,
          prev.paths,
          prev.tags,
          prev.requests,
          nextCmsTypes,
        )

        return {
          ...prev,
          cms_types: nextCmsTypes,
          tags: synced.tags,
          requests: synced.requests,
        }
      })

      showToast(`Đã lưu Path Template [${trimmedName}] cho ${cms.name}.`)
    },
    [data.cms_types, showToast],
  )

  const deleteCmsPathTemplate = useCallback(
    async (cmsTypeId: number, templateId: number) => {
      await delay(160)
      const cms = data.cms_types.find((c) => c.id === cmsTypeId)
      if (!cms) throw new Error('CMS Type không tồn tại.')
      setData((prev) => ({
        ...prev,
        cms_types: prev.cms_types.map((c) =>
          c.id === cmsTypeId
            ? {
                ...c,
                path_templates: c.path_templates.filter(
                  (t) => t.id !== templateId,
                ),
              }
            : c,
        ),
      }))
      showToast(`Đã xóa Path Template khỏi ${cms.name}.`)
    },
    [data.cms_types, showToast],
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
      saveCmsType,
      toggleCmsTypeEnabled,
      saveCmsPathTemplate,
      deleteCmsPathTemplate,
      reload,
    }),
    [
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
