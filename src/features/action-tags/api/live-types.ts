/** Live staff GET /action-registry/data — fields confirmed in CP8A ActionRegistryController::data */

export type LivePathInput = {
  key: string
  type: string
  required: boolean
}

export type LiveSite = {
  id: number
  key: string
  name: string
  base_url: string
  base_url_mode?: string
  cms_type?: string | null
  test_base_url?: string | null
  description?: string | null
  paths_count?: number
  /** Present only when backend Site Registry exposes it — do not invent. */
  content_max_length?: number | null
}

export type LivePath = {
  id: number
  site_id: number
  site_key: string
  key: string
  name: string
  url_pattern: string
  path_inputs: LivePathInput[]
  description?: string | null
  /** Present when addon exposes sa_paths.is_authentication */
  is_authentication?: boolean
  source?: 'site' | 'template'
  template_key?: string | null
  is_override?: boolean
}

export type LiveAction = {
  id: number
  key: string
  name: string
  description?: string | null
}

export type LiveTag = {
  id: number
  tag_key: string
  site_id?: number | null
  site_key: string
  site_name: string
  path_id?: number | null
  path_key: string
  path_name: string
  action_id?: number | null
  action_key?: string | null
  action_name?: string | null
  name: string
  description?: string | null
  /** Package id (sa_packages.id), not package_key */
  auth_script_id?: number | null
  auth_release_id?: number | null
  scripts_count: number
  ready: boolean
  is_enabled?: boolean
  enabled?: boolean
  published_script_available?: boolean
  latest_request_status?: string | null
  latest_request_id?: string | null
}

export type LiveScriptRequest = {
  id: number
  request_id: string
  action_tag_key: string
  request_type: string
  status: string
  script_id?: string | null
  script_version?: string | null
  error_reason?: string | null
  created_at?: string | null
}

export type LiveActionRegistryDataResponse = {
  ok: boolean
  sites: LiveSite[]
  paths: LivePath[]
  actions: LiveAction[]
  tags: LiveTag[]
  requests: LiveScriptRequest[]
}

/** Live GET /action-registry/authentication-scripts */

export type LiveAuthRelease = {
  id: number
  version: string
  content_digest?: string
  status: string
  published_at?: string | null
}

export type LiveAuthPackage = {
  package_id: number
  package_key: string
  name: string
  description?: string | null
  is_enabled?: boolean
  is_authentication: boolean
  releases: LiveAuthRelease[]
}

export type LiveAuthScriptsCatalogResponse = {
  ok: boolean
  packages: LiveAuthPackage[]
}
