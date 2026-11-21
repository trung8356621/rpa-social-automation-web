import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapLiveActionRegistry } from '../src/features/action-tags/api/mappers.ts'
import {
  isCmsManagedSite,
  resolveActionTagAuthDisplay,
} from '../src/features/action-tags/auth-display.ts'
import type { ActionTagItem, Site } from '../src/features/action-tags/types.ts'

describe('CMS-managed vs Non-CMS Auth Script Display', () => {
  const wpSite: Site = {
    id: 10,
    key: 'mayhopphat',
    name: 'Mayhopphat',
    base_url: 'https://mayhopphat.example.test',
    cms_type: 'wordpress',
  }

  const nonCmsSite: Site = {
    id: 1,
    key: 'facebook',
    name: 'Facebook',
    base_url: 'https://www.facebook.com',
    cms_type: null,
  }

  it('1. CMS Global Auth display: hides manual Edit Auth Script and shows CMS Global resolution', () => {
    assert.equal(isCmsManagedSite(wpSite), true)
    assert.equal(isCmsManagedSite(nonCmsSite), false)

    const mapped = mapLiveActionRegistry(
      {
        ok: true,
        sites: [
          {
            id: 10,
            key: 'mayhopphat',
            name: 'Mayhopphat',
            base_url: 'https://mayhopphat.example.test',
            cms_type: 'wordpress',
          },
        ],
        paths: [],
        actions: [],
        tags: [
          {
            id: 201,
            tag_key: 'mayhopphat.create_post',
            site_id: 10,
            site_key: 'mayhopphat',
            site_name: 'Mayhopphat',
            path_key: 'create_post',
            path_name: 'Create Post',
            name: 'mayhopphat.create_post',
            scripts_count: 1,
            ready: true,
            is_enabled: true,
            effective_auth_script: {
              package_id: 7,
              release_id: 14,
              package_key: 'mayhopphat.login',
              name: 'WordPress Login',
              version: '1.0.0',
              status: 'published',
            },
            auth_resolution_source: 'cms_global',
          },
        ],
        requests: [],
      },
      [],
    )

    const display = resolveActionTagAuthDisplay(
      mapped.tags[0],
      mapped.sites[0],
    )
    assert.equal(display.allowManualEdit, false)
    assert.equal(display.isMissing, false)
    assert.equal(display.source, 'cms_global')
    assert.equal(display.sourceLabel, 'CMS Global')
    assert.equal(display.script?.name, 'WordPress Login')
    assert.equal(display.script?.version, '1.0.0')
  })

  it('2. Legacy Auth pins: preserves existing pin on CMS Site (read-only) and allows manual edit on non-CMS Site', () => {
    const legacyCmsTag: ActionTagItem = {
      id: 202,
      tag_key: 'mayhopphat.products',
      site_id: 10,
      site_key: 'mayhopphat',
      site_name: 'Mayhopphat',
      path_key: 'products',
      path_name: 'Products',
      name: 'mayhopphat.products',
      scripts_count: 1,
      ready: true,
      enabled: true,
      auth_script: {
        script_id: 'wordpress.login',
        package_id: 7,
        release_id: 14,
        name: 'WordPress Login',
        version: '1.0.0',
        status: 'published',
      },
    }

    const cmsLegacyDisplay = resolveActionTagAuthDisplay(legacyCmsTag, wpSite)
    assert.equal(cmsLegacyDisplay.allowManualEdit, false)
    assert.equal(cmsLegacyDisplay.isMissing, false)
    assert.equal(cmsLegacyDisplay.source, 'legacy_pin')
    assert.equal(cmsLegacyDisplay.sourceLabel, 'Legacy Pin')
    assert.equal(cmsLegacyDisplay.script?.script_id, 'wordpress.login')

    const nonCmsTag: ActionTagItem = {
      ...legacyCmsTag,
      id: 203,
      tag_key: 'facebook.group_composer.post',
      site_id: 1,
      site_key: 'facebook',
      site_name: 'Facebook',
    }
    const nonCmsDisplay = resolveActionTagAuthDisplay(nonCmsTag, nonCmsSite)
    assert.equal(nonCmsDisplay.allowManualEdit, true)
    assert.equal(nonCmsDisplay.source, 'site_specific')
    assert.equal(nonCmsDisplay.sourceLabel, 'Site-specific')
  })

  it('3. Missing Auth Script: never infers Auth resolution from frontend data alone', () => {
    const unconfirmedCmsTag: ActionTagItem = {
      id: 204,
      tag_key: 'bepxinh.create_post',
      site_id: 11,
      site_key: 'bepxinh',
      site_name: 'Bepxinh',
      path_key: 'create_post',
      path_name: 'Create Post',
      name: 'bepxinh.create_post',
      scripts_count: 0,
      ready: false,
      enabled: true,
      auth_script: null,
      effective_auth_script: null,
      auth_resolution_source: null,
    }

    const missingDisplay = resolveActionTagAuthDisplay(unconfirmedCmsTag, {
      ...wpSite,
      id: 11,
      key: 'bepxinh',
      name: 'Bepxinh',
    })
    assert.equal(missingDisplay.allowManualEdit, false)
    assert.equal(missingDisplay.script, null)
    assert.equal(missingDisplay.isMissing, true)
    assert.equal(missingDisplay.source, 'missing')
    assert.equal(missingDisplay.sourceLabel, 'Missing Auth Script')

    const unavailablePinTag: ActionTagItem = {
      ...unconfirmedCmsTag,
      auth_script: {
        script_id: 'package:999',
        package_id: 999,
        name: 'Unavailable Auth package #999',
        version: null,
        status: 'unavailable',
      },
    }
    const unavailableDisplay = resolveActionTagAuthDisplay(
      unavailablePinTag,
      wpSite,
    )
    assert.equal(unavailableDisplay.isMissing, true)
    assert.equal(unavailableDisplay.allowManualEdit, false)
  })
})
