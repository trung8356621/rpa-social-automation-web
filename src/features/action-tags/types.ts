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
 * MOCK presentation for Authentication Script options.
 * Backend evidence (Oct 2026): NO verified `is_authentication` flag on packages yet.
 * Existing `sa_action_tag_scripts` links tags→script_id/version but is not Auth-role specific.
 */
export type AuthScriptOption = {
  /** Prefer package/script identity — mirrors sa_action_tag_scripts.script_id shape */
  script_id: string
  name: string
  /** Active release version when known */
  version: string | null
  /** published = selectable; draft/yanked/unavailable = shown disabled in mock */
  status: 'published' | 'draft' | 'yanked' | 'unavailable'
  is_authentication: boolean
  /**
   * MOCK-only site keys this Auth Script is seeded for (e.g. `wordpress`).
   * `null` / omitted = compatibility unknown — show with unverified note; do not invent backend filter.
   * Not derived from script display name. Production contract still missing.
   */
  compatible_site_keys?: string[] | null
}

export type ActionTagAuthScript = {
  script_id: string
  name: string
  version: string | null
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
  /** MOCK local link only until backend Auth Script contract exists */
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
