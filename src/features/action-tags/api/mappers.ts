import type {
  ActionItem,
  ActionRegistryData,
  ActionTagAuthScript,
  ActionTagItem,
  AuthScriptOption,
  PathItem,
  PathInput,
  ScriptRequestItem,
  Site,
} from '../types'
import type {
  LiveAction,
  LiveActionRegistryDataResponse,
  LiveAuthPackage,
  LivePath,
  LivePathInput,
  LiveScriptRequest,
  LiveSite,
  LiveTag,
} from './live-types'

function asBaseUrlMode(value: string | undefined): Site['base_url_mode'] {
  return value === 'dynamic' ? 'dynamic' : 'fixed'
}

function mapPathInputs(inputs: LivePathInput[] | undefined): PathInput[] {
  if (!Array.isArray(inputs)) return []
  return inputs.map((i) => ({
    key: String(i.key ?? ''),
    type: String(i.type ?? 'String'),
    required: Boolean(i.required),
  }))
}

function mapSite(site: LiveSite): Site {
  return {
    id: Number(site.id),
    key: String(site.key ?? ''),
    name: String(site.name ?? ''),
    base_url: String(site.base_url ?? ''),
    base_url_mode: asBaseUrlMode(site.base_url_mode),
    test_base_url: site.test_base_url ?? null,
    description: site.description ?? null,
    paths_count: site.paths_count ?? 0,
  }
}

function mapPath(path: LivePath): PathItem {
  return {
    id: Number(path.id),
    site_id: Number(path.site_id),
    site_key: String(path.site_key ?? ''),
    key: String(path.key ?? ''),
    name: String(path.name ?? ''),
    url_pattern: String(path.url_pattern ?? ''),
    path_inputs: mapPathInputs(path.path_inputs),
    description: path.description ?? null,
  }
}

function mapAction(action: LiveAction): ActionItem {
  return {
    id: Number(action.id),
    key: String(action.key ?? ''),
    name: String(action.name ?? ''),
    description: action.description ?? null,
  }
}

function mapRequestStatus(
  status: string,
): ScriptRequestItem['status'] {
  if (
    status === 'pending' ||
    status === 'developing' ||
    status === 'published' ||
    status === 'needs_fix'
  ) {
    return status
  }
  return 'pending'
}

function mapRequestType(
  type: string,
): ScriptRequestItem['request_type'] {
  return type === 'fix' ? 'fix' : 'create'
}

function mapRequest(req: LiveScriptRequest): ScriptRequestItem {
  return {
    id: Number(req.id),
    request_id: String(req.request_id ?? ''),
    action_tag_key: String(req.action_tag_key ?? ''),
    request_type: mapRequestType(String(req.request_type ?? 'create')),
    status: mapRequestStatus(String(req.status ?? 'pending')),
    script_id: req.script_id ?? null,
    script_version: req.script_version ?? null,
    error_reason: req.error_reason ?? null,
    created_at: req.created_at ?? undefined,
  }
}

/**
 * Map Auth catalog package → UI option.
 * `script_id` stays package_key for mock-compatible labels;
 * live pin IDs are package_id + release id.
 */
export function mapAuthPackage(pkg: LiveAuthPackage): AuthScriptOption {
  const releases = Array.isArray(pkg.releases) ? pkg.releases : []
  const published = releases.filter((r) => r.status === 'published')
  const preferred = published[0] ?? releases[0]
  const hasPublished = published.length > 0

  return {
    script_id: String(pkg.package_key ?? ''),
    package_id: Number(pkg.package_id),
    name: String(pkg.name ?? pkg.package_key ?? ''),
    version: preferred?.version ?? null,
    status: hasPublished ? 'published' : 'unavailable',
    is_authentication: Boolean(pkg.is_authentication),
    compatible_site_keys: null,
    releases: releases.map((r) => ({
      release_id: Number(r.id),
      version: String(r.version ?? ''),
      status: String(r.status ?? ''),
    })),
  }
}

function resolvePinnedAuth(
  tag: LiveTag,
  packagesById: Map<number, LiveAuthPackage>,
): ActionTagAuthScript {
  const packageId =
    tag.auth_script_id === null || tag.auth_script_id === undefined
      ? null
      : Number(tag.auth_script_id)
  const releaseId =
    tag.auth_release_id === null || tag.auth_release_id === undefined
      ? null
      : Number(tag.auth_release_id)

  if (packageId === null && releaseId === null) return null

  const pkg = packageId !== null ? packagesById.get(packageId) : undefined
  if (!pkg) {
    return {
      script_id: packageId !== null ? `package:${packageId}` : 'unknown',
      package_id: packageId ?? undefined,
      release_id: releaseId,
      name:
        packageId !== null
          ? `Unavailable Auth package #${packageId}`
          : 'Unavailable Auth pin',
      version: null,
      status: 'unavailable',
    }
  }

  const release =
    releaseId !== null
      ? pkg.releases.find((r) => Number(r.id) === releaseId)
      : undefined

  return {
    script_id: String(pkg.package_key),
    package_id: Number(pkg.package_id),
    release_id: releaseId,
    name: String(pkg.name ?? pkg.package_key),
    version: release?.version ?? null,
    status: release?.status === 'published' ? 'published' : 'unavailable',
  }
}

function mapTag(
  tag: LiveTag,
  packagesById: Map<number, LiveAuthPackage>,
): ActionTagItem {
  return {
    id: Number(tag.id),
    tag_key: String(tag.tag_key ?? ''),
    site_id: tag.site_id ?? null,
    site_key: String(tag.site_key ?? ''),
    site_name: String(tag.site_name ?? ''),
    path_id: tag.path_id ?? null,
    path_key: String(tag.path_key ?? ''),
    path_name: String(tag.path_name ?? ''),
    action_id: tag.action_id ?? null,
    action_key: String(tag.action_key ?? ''),
    action_name: String(tag.action_name ?? ''),
    name: String(tag.name ?? tag.tag_key ?? ''),
    description: tag.description ?? null,
    scripts_count: Number(tag.scripts_count ?? 0),
    ready: Boolean(tag.ready),
    latest_request_status: tag.latest_request_status ?? null,
    latest_request_id: tag.latest_request_id ?? null,
    auth_script: resolvePinnedAuth(tag, packagesById),
  }
}

export function mapLiveActionRegistry(
  data: LiveActionRegistryDataResponse,
  packages: LiveAuthPackage[],
): ActionRegistryData {
  const packagesById = new Map<number, LiveAuthPackage>()
  for (const pkg of packages) {
    packagesById.set(Number(pkg.package_id), pkg)
  }

  return {
    sites: (data.sites ?? []).map(mapSite),
    paths: (data.paths ?? []).map(mapPath),
    actions: (data.actions ?? []).map(mapAction),
    tags: (data.tags ?? []).map((t) => mapTag(t, packagesById)),
    requests: (data.requests ?? []).map(mapRequest),
    auth_scripts: packages.map(mapAuthPackage),
  }
}
