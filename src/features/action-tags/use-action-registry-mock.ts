import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EMPTY_REGISTRY, MOCK_ACTION_REGISTRY } from './mock-data'
import type {
  ActionRegistryData,
  ActionTagAuthScript,
  DemoScenario,
  PathItem,
  Site,
} from './types'
import { delay, parseInputsFromPattern, slugifyKey } from './utils'

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
    return data
  }
  return structuredClone(MOCK_ACTION_REGISTRY)
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
      action_key: string
      auth_script_id?: string | null
    }) => {
      await delay(280)
      const site = data.sites.find((s) => s.id === payload.site_id)
      const path = data.paths.find((p) => p.id === payload.path_id)
      const action =
        data.actions.find((a) => a.key === payload.action_key) ??
        ({ id: 0, key: payload.action_key, name: payload.action_key } as const)

      if (!site || !path) {
        throw new Error('Site hoặc Path không hợp lệ.')
      }

      const tagKey = `${site.key}.${path.key}.${payload.action_key}`
      if (data.tags.some((t) => t.tag_key === tagKey)) {
        throw new Error(`Action Tag [${tagKey}] đã tồn tại.`)
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
            action_id: action.id || null,
            action_key: action.key,
            action_name: action.name,
            name: tagKey,
            scripts_count: 0,
            ready: false,
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

  /**
   * MOCK-only Auth Script link update.
   * Backend evidence: OpenAPI/action-registry has create+delete Tag only — no update endpoint verified.
   */
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
        'Đã cập nhật Auth Script trên mock local. Backend update contract chưa có bằng chứng.',
        'success',
      )
    },
    [data.auth_scripts, showToast],
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
      test_base_url?: string
      description?: string
    }) => {
      await delay(280)
      const mode = siteData.base_url_mode ?? 'fixed'
      const key = slugifyKey(siteData.name)

      setData((prev) => {
        if (siteData.id) {
          const sites = prev.sites.map((s) =>
            s.id === siteData.id
              ? {
                  ...s,
                  name: siteData.name,
                  key: s.key,
                  base_url: mode === 'fixed' ? siteData.base_url || '' : '',
                  base_url_mode: mode,
                  test_base_url: siteData.test_base_url || null,
                  description: siteData.description || null,
                }
              : s,
          )
          return { ...prev, sites }
        }

        const id = nextId(prev.sites)
        const site: Site = {
          id,
          key,
          name: siteData.name,
          base_url: mode === 'fixed' ? siteData.base_url || '' : '',
          base_url_mode: mode,
          test_base_url: siteData.test_base_url || null,
          description: siteData.description || null,
          paths_count: 0,
        }
        return { ...prev, sites: [...prev.sites, site] }
      })

      showToast(`Đã lưu Site [${siteData.name}] thành công!`)
    },
    [showToast],
  )

  const savePath = useCallback(
    async (pathData: {
      id?: number
      site_id: number
      name: string
      url_pattern: string
      description?: string
    }) => {
      await delay(280)
      const site = data.sites.find((s) => s.id === pathData.site_id)
      if (!site) throw new Error('Site không tồn tại.')

      const key = slugifyKey(pathData.name)
      const pathInputs = parseInputsFromPattern(pathData.url_pattern)

      setData((prev) => {
        if (pathData.id) {
          const paths = prev.paths.map((p) =>
            p.id === pathData.id
              ? {
                  ...p,
                  name: pathData.name,
                  url_pattern: pathData.url_pattern,
                  path_inputs: pathInputs,
                  description: pathData.description || null,
                }
              : p,
          )
          return { ...prev, paths }
        }

        const path: PathItem = {
          id: nextId(prev.paths),
          site_id: site.id,
          site_key: site.key,
          key,
          name: pathData.name,
          url_pattern: pathData.url_pattern,
          path_inputs: pathInputs,
          description: pathData.description || null,
        }
        const paths = [...prev.paths, path]
        const sites = prev.sites.map((s) =>
          s.id === site.id
            ? {
                ...s,
                paths_count: paths.filter((p) => p.site_id === s.id).length,
              }
            : s,
        )
        return { ...prev, paths, sites }
      })

      showToast(`Đã lưu Path [${pathData.name}] thành công!`)
    },
    [data.sites, showToast],
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
      updateTagAuthScript,
      deleteTag,
      saveSite,
      savePath,
      reload,
    }),
    [
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
