export type PathInput = {
  key: string
  type: string
  required: boolean
}

export type BaseUrlMode = 'fixed' | 'dynamic'

export type Site = {
  id: number
  key: string
  name: string
  base_url: string
  base_url_mode?: BaseUrlMode
  test_base_url?: string | null
  description?: string | null
  paths_count?: number
}

export type PathItem = {
  id: number
  site_id: number
  site_key: string
  key: string
  name: string
  url_pattern: string
  path_inputs: PathInput[]
  description?: string | null
}

export type ActionItem = {
  id: number
  key: string
  name: string
  description?: string | null
}

/**
 * Authentication Script catalog option.
 * Live CP8A: `package_id` + `package_key` + published `releases[]`.
 * Mock: `script_id` string seed (e.g. wordpress.login); `compatible_site_keys` remains MOCK-only.
 */
export type AuthScriptOption = {
  /** Display / mock identity — live maps from package_key */
  script_id: string
  /** Live sa_packages.id — required for future auth-pin mutations */
  package_id?: number
  name: string
  /** Preferred published release version when known */
  version: string | null
  /** published = selectable; draft/yanked/unavailable = shown disabled */
  status: 'published' | 'draft' | 'yanked' | 'unavailable'
  is_authentication: boolean
  /**
   * MOCK-only site keys this Auth Script is seeded for (e.g. `wordpress`).
   * Live catalog does not provide this — keep null and do not invent filters.
   */
  compatible_site_keys?: string[] | null
  /** Live published releases for explicit pin (D3) */
  releases?: Array<{
    release_id: number
    version: string
    status: string
  }>
}

export type ActionTagAuthScript = {
  script_id: string
  package_id?: number
  release_id?: number | null
  name: string
  version: string | null
  status?: 'published' | 'unavailable'
} | null

export type ActionTagItem = {
  id: number
  tag_key: string
  site_id?: number | null
  site_key: string
  site_name: string
  path_id?: number | null
  path_key: string
  path_name: string
  action_id?: number | null
  action_key: string
  action_name: string
  name: string
  description?: string | null
  scripts_count: number
  ready: boolean
  latest_request_status?: string | null
  latest_request_id?: string | null
  /** Resolved pin summary (mock local or live join of auth_* ids + catalog) */
  auth_script?: ActionTagAuthScript
}

export type ScriptRequestItem = {
  id: number
  request_id: string
  action_tag_key: string
  request_type: 'create' | 'fix'
  status: 'pending' | 'developing' | 'published' | 'needs_fix'
  script_id?: string | null
  script_version?: string | null
  error_reason?: string | null
  created_at?: string
}

export type ActionRegistryData = {
  sites: Site[]
  paths: PathItem[]
  actions: ActionItem[]
  tags: ActionTagItem[]
  requests: ScriptRequestItem[]
  /** Candidate Auth Scripts for the select (mock catalog) */
  auth_scripts: AuthScriptOption[]
}

export type ActionTagsView = 'tags' | 'sites_paths'

export type DemoScenario =
  | 'default'
  | 'loading'
  | 'empty-sites'
  | 'empty-tags'
  | 'empty-auth-scripts'
  | 'error'

export function formatAuthScriptLabel(
  script: { name: string; version: string | null } | null | undefined,
): string {
  if (!script) return '—'
  return script.version ? `${script.name} · v${script.version}` : script.name
}
