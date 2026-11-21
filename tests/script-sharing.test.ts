import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  mapLiveScriptDetail,
  mapLiveScriptListItem,
} from '../src/features/script-registry/api/map-script-registry.ts'
import {
  findCmsGlobalScriptForActionTag,
  formatGlobalConflictLabel,
  formatSharingErrorMessage,
} from '../src/features/script-registry/sharing.ts'
import { SCRIPT_REGISTRY_PATHS } from '../src/lib/api/config.ts'
import { ApiError } from '../src/lib/api/errors.ts'

describe('Global Script Sharing UI & LIVE Contract', () => {
  it('1. Defaults OFF (site_specific) for mayhopphat.create_post and preserves identity/version', () => {
    const mapped = mapLiveScriptListItem({
      package_key: 'mayhopphat.create_post',
      script_id: 'mayhopphat.create_post',
      name: 'Mayhopphat Create Post',
      version: '1.0.0',
      release_id: 12,
      status: 'published',
      is_authentication: false,
      action_tag_key: 'mayhopphat.create_post',
      assets_complete: true,
      video_demo_status: 'ready',
      sharing_mode: 'site_specific',
      global_scope: null,
      global_eligible: true,
      eligible_global_scope: {
        cms_type: 'wordpress',
        path_template_key: 'create_post',
        global_scope: 'wordpress:create_post',
      },
      global_conflict: null,
    })

    assert.equal(mapped.sharing_mode, 'site_specific')
    assert.equal(mapped.global_scope, null)
    assert.equal(mapped.global_eligible, true)
    assert.equal(mapped.eligible_global_scope?.cms_type, 'wordpress')
    assert.equal(mapped.eligible_global_scope?.path_template, 'create_post')
    assert.equal(mapped.eligible_global_scope?.scope, 'wordpress:create_post')
    assert.equal(mapped.package_key, 'mayhopphat.create_post')
    assert.equal(mapped.action_tag_key, 'mayhopphat.create_post')
    assert.equal(mapped.version, '1.0.0')
  })

  it('2. Toggle ON reflects cms_global and wordpress:create_post; toggle OFF restores site_specific', () => {
    const enabledDetail = mapLiveScriptDetail({
      package_key: 'mayhopphat.create_post',
      script_id: 'mayhopphat.create_post',
      name: 'Mayhopphat Create Post',
      action_tag_key: 'mayhopphat.create_post',
      sharing_mode: 'cms_global',
      global_scope: 'wordpress:create_post',
      global_eligible: true,
      eligible_global_scope: 'wordpress:create_post',
      releases: [
        {
          id: 12,
          version: '1.0.0',
          status: 'published',
          content_digest: 'sha256:abc',
        },
      ],
    })

    assert.equal(enabledDetail.sharing_mode, 'cms_global')
    assert.equal(enabledDetail.global_scope, 'wordpress:create_post')
    assert.equal(enabledDetail.eligible_global_scope?.cms_type, 'wordpress')
    assert.equal(
      enabledDetail.eligible_global_scope?.path_template,
      'create_post',
    )
    assert.equal(enabledDetail.releases[0].version, '1.0.0')

    const restoredDetail = mapLiveScriptDetail({
      package_key: 'mayhopphat.create_post',
      name: 'Mayhopphat Create Post',
      action_tag_key: 'mayhopphat.create_post',
      sharing_mode: 'site_specific',
      global_scope: null,
      global_eligible: true,
      releases: [
        {
          id: 12,
          version: '1.0.0',
          status: 'published',
          content_digest: 'sha256:abc',
        },
      ],
    })

    assert.equal(restoredDetail.sharing_mode, 'site_specific')
    assert.equal(restoredDetail.global_scope, null)
    assert.equal(restoredDetail.package_key, 'mayhopphat.create_post')
    assert.equal(restoredDetail.action_tag_key, 'mayhopphat.create_post')
  })

  it('3. Maps global_eligible=false, ineligible reason, and existing global_conflict', () => {
    const ineligible = mapLiveScriptListItem({
      package_key: 'facebook.group.post',
      script_id: 'facebook.group.post',
      name: 'Facebook Group Post',
      version: '1.0.0',
      status: 'published',
      is_authentication: false,
      action_tag_key: 'facebook.group.post',
      assets_complete: true,
      video_demo_status: 'missing',
      sharing_mode: 'site_specific',
      global_eligible: false,
      global_ineligible_reason: 'Site does not belong to a shared CMS Type.',
      global_conflict: {
        package_key: 'other.wp.create_post',
        name: 'Other WP Post',
        global_scope: 'wordpress:create_post',
      },
    })

    assert.equal(ineligible.global_eligible, false)
    assert.equal(
      ineligible.global_ineligible_reason,
      'Site does not belong to a shared CMS Type.',
    )
    assert.equal(
      formatGlobalConflictLabel(ineligible.global_conflict),
      'Other WP Post (wordpress:create_post)',
    )
  })

  it('4. LIVE sharing route and error handling (409, 422, 401/403)', () => {
    assert.equal(
      SCRIPT_REGISTRY_PATHS.sharing('mayhopphat.create_post'),
      '/social-automation/api/script-registry/mayhopphat.create_post/sharing',
    )

    const conflictErr = new ApiError('Conflict', {
      kind: 'unknown',
      status: 409,
      code: 'global_scope_conflict',
    })
    assert.match(formatSharingErrorMessage(conflictErr), /409/)

    const ineligibleErr = new ApiError('Ineligible', {
      kind: 'validation',
      status: 422,
      code: 'ineligible',
    })
    assert.match(formatSharingErrorMessage(ineligibleErr), /422/)

    const authErr = new ApiError('Authentication required.', {
      kind: 'auth',
      status: 401,
      isAuthRequired: true,
    })
    assert.match(formatSharingErrorMessage(authErr), /Authentication required/)
  })

  it('5. Optional display: detects target Action Tag resolving via CMS Global without extra endpoints', () => {
    const globalScript = mapLiveScriptListItem({
      package_key: 'mayhopphat.create_post',
      script_id: 'mayhopphat.create_post',
      name: 'Mayhopphat Create Post',
      version: '1.0.0',
      status: 'published',
      is_authentication: false,
      action_tag_key: 'mayhopphat.create_post',
      assets_complete: true,
      video_demo_status: 'ready',
      sharing_mode: 'cms_global',
      global_scope: 'wordpress:create_post',
      global_eligible: true,
    })

    const resolved = findCmsGlobalScriptForActionTag(
      { tag_key: 'bepxinh.create_post', path_key: 'create_post' },
      'wordpress',
      [globalScript],
    )
    assert.equal(resolved?.package_key, 'mayhopphat.create_post')

    const siteSpecificOnly = { ...globalScript, sharing_mode: 'site_specific' as const, global_scope: null }
    assert.equal(
      findCmsGlobalScriptForActionTag(
        { tag_key: 'bepxinh.create_post', path_key: 'create_post' },
        'wordpress',
        [siteSpecificOnly],
      ),
      null,
    )
  })
})
