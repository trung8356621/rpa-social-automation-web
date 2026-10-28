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
  test_base_url?: string | null
  description?: string | null
  paths_count?: number
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
  action_key: string
  action_name: string
  name: string
  description?: string | null
  /** Package id (sa_packages.id), not package_key */
  auth_script_id?: number | null
  auth_release_id?: number | null
  scripts_count: number
  ready: boolean
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
