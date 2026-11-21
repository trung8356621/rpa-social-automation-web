import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  resolveTagPublishedScriptStatus,
  setActionTagEnabled,
  syncActionTagsForSites,
} from '../src/features/action-tags/auto-tag-lifecycle.ts'
import {
  computeSiteDeleteSummary,
  DEFAULT_CMS_PATH_TEMPLATES,
  formatCmsTypeLabel,
  getCmsPathTemplates,
  resolveEffectivePathsForSite,
  validateSitePathUniqueness,
} from '../src/features/action-tags/cms-templates.ts'
import { mapLiveActionRegistry } from '../src/features/action-tags/api/mappers.ts'
import { ACTION_REGISTRY_PATHS } from '../src/lib/api/config.ts'
import type {
  ActionTagItem,
  PathItem,
  ScriptRequestItem,
  Site,
} from '../src/features/action-tags/types.ts'
import { filterScriptsForSite } from '../src/features/campaigns/script-compat.ts'
import type { ScriptListItem } from '../src/features/script-registry/types.ts'

describe('Dynamic CMS Path Reuse & Automatic Action Tag Lifecycle', () => {
  it('1. Two WordPress sites share Path Templates without auto-classifying unrelated Dynamic CMS sites', () => {
    const wpSiteA: Site = {
      id: 10,
      key: 'mayhopphat',
      name: 'Mayhopphat',
      base_url: 'https://mayhopphat.example.test',
      base_url_mode: 'dynamic',
      cms_type: 'wordpress',
    }
    const wpSiteB: Site = {
      id: 11,
      key: 'bepxinh',
      name: 'Bepxinh',
      base_url: 'https://bepxinh.example.test',
      base_url_mode: 'dynamic',
      cms_type: 'wordpress',
    }
    const unrelatedDynamicSite: Site = {
      id: 12,
      key: 'customshop',
      name: 'Custom Shop',
      base_url: 'https://customshop.example.test',
      base_url_mode: 'dynamic',
      cms_type: null,
    }

    const pathsA = resolveEffectivePathsForSite(wpSiteA, [])
    const pathsB = resolveEffectivePathsForSite(wpSiteB, [])
    const pathsCustom = resolveEffectivePathsForSite(unrelatedDynamicSite, [])

    assert.equal(pathsA.length, 2)
    assert.deepEqual(
      pathsA.map((p) => [p.key, p.url_pattern, p.is_authentication, p.source]),
      [
        ['create_post', '/wp-admin/post-new.php', false, 'template'],
        ['login', '/wp-login.php', true, 'template'],
      ],
    )

    assert.equal(pathsB.length, 2)
    assert.deepEqual(
      pathsB.map((p) => [p.key, p.url_pattern, p.is_authentication, p.source]),
      [
        ['create_post', '/wp-admin/post-new.php', false, 'template'],
        ['login', '/wp-login.php', true, 'template'],
      ],
    )

    // Unrelated Dynamic CMS site must NOT be classified as WordPress
    assert.equal(pathsCustom.length, 0)
  })

  it('2. Site-specific override customizes one Site without mutating shared template or other Sites, and prevents duplicate effective Paths', () => {
    const wpSiteA: Site = {
      id: 10,
      key: 'mayhopphat',
      name: 'Mayhopphat',
      base_url: 'https://mayhopphat.example.test',
      cms_type: 'wordpress',
    }
    const wpSiteB: Site = {
      id: 11,
      key: 'bepxinh',
      name: 'Bepxinh',
      base_url: 'https://bepxinh.example.test',
      cms_type: 'wordpress',
    }

    const siteAPaths: PathItem[] = [
      {
        id: 501,
        site_id: 10,
        site_key: 'mayhopphat',
        key: 'login',
        name: 'Custom WP Login',
        url_pattern: '/secret-wp-login.php',
        path_inputs: [],
        is_authentication: true,
        template_key: 'login',
      },
    ]

    const effectiveA = resolveEffectivePathsForSite(wpSiteA, siteAPaths)
    const effectiveB = resolveEffectivePathsForSite(wpSiteB, siteAPaths)

    assert.equal(effectiveA.length, 2)
    const overriddenLogin = effectiveA.find((p) => p.key === 'login')!
    assert.equal(overriddenLogin.id, 501)
    assert.equal(overriddenLogin.url_pattern, '/secret-wp-login.php')
    assert.equal(overriddenLogin.source, 'site')
    assert.equal(overriddenLogin.is_override, true)

    // Shared template and Site B remain untouched
    assert.equal(
      DEFAULT_CMS_PATH_TEMPLATES.wordpress.find((t) => t.key === 'login')
        ?.url_pattern,
      '/wp-login.php',
    )
    assert.equal(
      effectiveB.find((p) => p.key === 'login')?.url_pattern,
      '/wp-login.php',
    )

    // Duplicate effective Path key or url_pattern is rejected
    const dupKey = validateSitePathUniqueness(effectiveA, {
      key: 'create_post',
      url_pattern: '/wp-admin/custom.php',
    })
    assert.equal(dupKey.ok, false)

    const dupPattern = validateSitePathUniqueness(effectiveA, {
      key: 'another_post',
      url_pattern: '/wp-admin/post-new.php/',
    })
    assert.equal(dupPattern.ok, false)

    // Overriding the inherited create_post template with its template_key is allowed
    const validOverride = validateSitePathUniqueness(effectiveA, {
      key: 'create_post',
      url_pattern: '/wp-admin/post-new.php?post_type=product',
      template_key: 'create_post',
    })
    assert.equal(validOverride.ok, true)
  })

  it('3. Automatic Tag creation defaults to enabled and is idempotent on repeated syncs', () => {
    const sites: Site[] = [
      {
        id: 10,
        key: 'mayhopphat',
        name: 'Mayhopphat',
        base_url: 'https://mayhopphat.example.test',
        cms_type: 'wordpress',
      },
    ]

    const first = syncActionTagsForSites(sites, [], [], [])
    assert.equal(first.tags.length, 2)
    assert.deepEqual(
      first.tags.map((t) => t.tag_key),
      ['mayhopphat.create_post', 'mayhopphat.login'],
    )
    assert.ok(first.tags.every((t) => t.enabled === true))
    assert.equal(first.requests.length, 2)

    // Repeated sync produces zero duplicates and reuses existing identities
    const second = syncActionTagsForSites(
      sites,
      [],
      first.tags,
      first.requests,
    )
    assert.equal(second.createdTagKeys.length, 0)
    assert.equal(second.tags.length, 2)
    assert.equal(second.requests.length, 2)
    assert.deepEqual(
      second.tags.map((t) => [t.id, t.tag_key]),
      first.tags.map((t) => [t.id, t.tag_key]),
    )
  })

  it('4. Disable/re-enable preserves Tag identity and Script/Auth references', () => {
    const initialTag: ActionTagItem = {
      id: 42,
      tag_key: 'mayhopphat.create_post',
      site_id: 10,
      site_key: 'mayhopphat',
      site_name: 'Mayhopphat',
      path_id: 100,
      path_key: 'create_post',
      path_name: 'Create Post',
      name: 'mayhopphat.create_post',
      scripts_count: 1,
      ready: true,
      enabled: true,
      published_script_available: true,
      latest_request_status: 'published',
      latest_request_id: 'req_42',
      auth_script: {
        script_id: 'wordpress.login',
        package_id: 7,
        release_id: 14,
        name: 'WordPress Login',
        version: '1.0.0',
        status: 'published',
      },
    }

    const disabled = setActionTagEnabled([initialTag], 42, false)
    assert.equal(disabled.length, 1)
    assert.equal(disabled[0].id, 42)
    assert.equal(disabled[0].tag_key, 'mayhopphat.create_post')
    assert.equal(disabled[0].enabled, false)
    assert.equal(disabled[0].scripts_count, 1)
    assert.equal(disabled[0].auth_script?.script_id, 'wordpress.login')

    // Syncing while disabled does NOT create a duplicate tag or overwrite enabled=false
    const sites: Site[] = [
      {
        id: 10,
        key: 'mayhopphat',
        name: 'Mayhopphat',
        base_url: 'https://mayhopphat.example.test',
        cms_type: 'wordpress',
      },
    ]
    const syncedWhileDisabled = syncActionTagsForSites(
      sites,
      [],
      disabled,
      [],
    )
    const createPostTag = syncedWhileDisabled.tags.find(
      (t) => t.tag_key === 'mayhopphat.create_post',
    )!
    assert.equal(createPostTag.id, 42)
    assert.equal(createPostTag.enabled, false)

    // Re-enabling reuses the exact same Tag identity
    const reenabled = setActionTagEnabled(syncedWhileDisabled.tags, 42, true)
    const target = reenabled.find((t) => t.id === 42)!
    assert.equal(target.tag_key, 'mayhopphat.create_post')
    assert.equal(target.enabled, true)
    assert.equal(target.auth_script?.release_id, 14)
  })

  it('5. Existing live Tag Keys (mayhopphat.create_post, mayhopphat.login) and Campaign/Script compatibility remain intact', () => {
    const mapped = mapLiveActionRegistry(
      {
        ok: true,
        sites: [
          {
            id: 3,
            key: 'mayhopphat',
            name: 'Mayhopphat',
            base_url: 'https://mayhopphat.example.test',
            base_url_mode: 'dynamic',
            cms_type: 'wordpress',
          },
        ],
        paths: [
          {
            id: 21,
            site_id: 3,
            site_key: 'mayhopphat',
            key: 'create_post',
            name: 'Create Post',
            url_pattern: '/wp-admin/post-new.php',
            path_inputs: [],
            is_authentication: false,
          },
          {
            id: 22,
            site_id: 3,
            site_key: 'mayhopphat',
            key: 'login',
            name: 'Login',
            url_pattern: '/wp-login.php',
            path_inputs: [],
            is_authentication: true,
          },
        ],
        actions: [],
        tags: [
          {
            id: 301,
            tag_key: 'mayhopphat.create_post',
            site_id: 3,
            site_key: 'mayhopphat',
            site_name: 'Mayhopphat',
            path_id: 21,
            path_key: 'create_post',
            path_name: 'Create Post',
            name: 'mayhopphat.create_post',
            scripts_count: 1,
            ready: true,
          },
          {
            id: 302,
            tag_key: 'mayhopphat.login',
            site_id: 3,
            site_key: 'mayhopphat',
            site_name: 'Mayhopphat',
            path_id: 22,
            path_key: 'login',
            path_name: 'Login',
            name: 'mayhopphat.login',
            scripts_count: 1,
            ready: true,
          },
        ],
        requests: [],
      },
      [],
    )

    const synced = syncActionTagsForSites(
      mapped.sites,
      mapped.paths,
      mapped.tags,
      mapped.requests as ScriptRequestItem[],
    )
    assert.equal(synced.createdTagKeys.length, 0)
    assert.deepEqual(
      synced.tags.map((t) => [t.id, t.tag_key, t.enabled]),
      [
        [301, 'mayhopphat.create_post', true],
        [302, 'mayhopphat.login', true],
      ],
    )

    const scripts: ScriptListItem[] = [
      {
        package_key: 'mayhopphat.create_post',
        script_id: 'mayhopphat.create_post',
        name: 'Mayhopphat Create Post',
        action_tag_key: 'mayhopphat.create_post',
        version: '1.0.0',
        release_id: 1,
        status: 'published',
        assets_complete: true,
        video_demo_status: 'ready',
        has_playable_video: true,
        has_thumbnail: true,
        video_media_id: 1,
        thumbnail_media_id: 1,
        thumbnail_url: null,
        video_url: null,
        last_sync_label: 'now',
        updated_by_label: 'admin',
        is_authentication: false,
      },
    ]

    const compatible = filterScriptsForSite(scripts, 'mayhopphat')
    assert.equal(compatible.length, 1)
    assert.equal(compatible[0].action_tag_key, 'mayhopphat.create_post')
  })

  it('6. Distinguishes Tag enabled availability from Missing Published Script', () => {
    const enabledTagMissingScript: ActionTagItem = {
      id: 99,
      tag_key: 'bepxinh.create_post',
      site_id: 11,
      site_key: 'bepxinh',
      site_name: 'Bepxinh',
      path_id: null,
      path_key: 'create_post',
      path_name: 'Create Post',
      name: 'bepxinh.create_post',
      scripts_count: 0,
      ready: false,
      enabled: true,
      published_script_available: false,
    }

    const draftOnlyScripts: ScriptListItem[] = [
      {
        package_key: 'bepxinh.create_post',
        script_id: 'bepxinh.create_post',
        name: 'Bepxinh Create Post',
        action_tag_key: 'bepxinh.create_post',
        version: '0.1.0',
        release_id: 5,
        status: 'draft',
        assets_complete: false,
        video_demo_status: 'missing',
        has_playable_video: false,
        has_thumbnail: false,
        video_media_id: null,
        thumbnail_media_id: null,
        thumbnail_url: null,
        video_url: null,
        last_sync_label: 'now',
        updated_by_label: 'admin',
      },
    ]

    const missingResult = resolveTagPublishedScriptStatus(
      enabledTagMissingScript,
      draftOnlyScripts,
    )
    assert.equal(enabledTagMissingScript.enabled, true)
    assert.equal(missingResult.hasPublishedScript, false)
    assert.equal(missingResult.matchedScript, null)

    const publishedScripts: ScriptListItem[] = [
      { ...draftOnlyScripts[0], status: 'published', version: '1.0.0' },
    ]
    const availableResult = resolveTagPublishedScriptStatus(
      enabledTagMissingScript,
      publishedScripts,
    )
    assert.equal(availableResult.hasPublishedScript, true)
    assert.equal(availableResult.matchedScript?.version, '1.0.0')
  })

  it('7. Selecting WordPress immediately provides inherited Path Templates and switching Sites preserves them', () => {
    const wpTemplates = getCmsPathTemplates('wordpress')
    assert.equal(wpTemplates.length, 2)
    assert.deepEqual(
      wpTemplates.map((t) => [t.key, t.url_pattern, Boolean(t.is_authentication)]),
      [
        ['create_post', '/wp-admin/post-new.php', false],
        ['login', '/wp-login.php', true],
      ],
    )

    const customSite: Site = {
      id: 20,
      key: 'facebook',
      name: 'Facebook',
      base_url: 'https://www.facebook.com',
      cms_type: null,
    }
    const wpSite: Site = {
      id: 21,
      key: 'new_wp',
      name: 'New WP',
      base_url: 'https://newwp.example.test',
      cms_type: 'wordpress',
    }

    // Switching from a custom site (0 paths) to a WordPress site immediately resolves its inherited paths
    assert.equal(resolveEffectivePathsForSite(customSite, []).length, 0)
    const wpEffective = resolveEffectivePathsForSite(wpSite, [])
    assert.equal(wpEffective.length, 2)
    assert.ok(wpEffective.every((p) => p.source === 'template'))
  })

  it('8. LIVE contract paths & mapper preserve disabled tags, cms_type, and site delete route', () => {
    assert.equal(
      ACTION_REGISTRY_PATHS.site(42),
      '/social-automation/api/action-registry/sites/42',
    )
    assert.equal(
      ACTION_REGISTRY_PATHS.tagEnabled(99),
      '/social-automation/api/action-registry/tags/99/enabled',
    )

    const liveMapped = mapLiveActionRegistry(
      {
        ok: true,
        sites: [
          {
            id: 50,
            key: 'wp_live',
            name: 'WP Live',
            base_url: 'https://wplive.example.test',
            base_url_mode: 'dynamic',
            cms_type: 'wordpress',
          },
        ],
        paths: [],
        actions: [],
        tags: [
          {
            id: 500,
            tag_key: 'wp_live.create_post',
            site_id: 50,
            site_key: 'wp_live',
            site_name: 'WP Live',
            path_id: null,
            path_key: 'create_post',
            path_name: 'Create Post',
            name: 'wp_live.create_post',
            scripts_count: 0,
            ready: false,
            is_enabled: false,
            published_script_available: false,
          },
        ],
        requests: [],
      },
      [],
    )

    assert.equal(liveMapped.sites[0].cms_type, 'wordpress')
    assert.equal(liveMapped.tags[0].enabled, false)
    assert.equal(liveMapped.tags[0].published_script_available, false)

    // Effective paths for the live WordPress site still resolve even when paths[] has no overrides
    const effective = resolveEffectivePathsForSite(
      liveMapped.sites[0],
      liveMapped.paths,
    )
    assert.equal(effective.length, 2)
    assert.equal(effective[0].source, 'template')
  })

  it('9. Dynamic CMS Types from LIVE backend & Delete Site dependent-record summary', () => {
    assert.equal(
      ACTION_REGISTRY_PATHS.cmsTypes,
      '/social-automation/api/action-registry/cms-types',
    )
    assert.equal(
      ACTION_REGISTRY_PATHS.cmsTypeEnabled(5),
      '/social-automation/api/action-registry/cms-types/5/enabled',
    )
    assert.equal(
      ACTION_REGISTRY_PATHS.cmsTypeTemplate(5, 12),
      '/social-automation/api/action-registry/cms-types/5/templates/12',
    )

    const mapped = mapLiveActionRegistry(
      {
        ok: true,
        sites: [
          {
            id: 60,
            key: 'myshop',
            name: 'My Shop',
            base_url: 'https://myshop.example.test',
            cms_type: 'shopify',
          },
        ],
        paths: [],
        actions: [],
        tags: [],
        requests: [],
        cms_types: [
          {
            id: 1,
            key: 'wordpress',
            name: 'WordPress',
            is_enabled: true,
            path_templates: [
              {
                id: 1,
                key: 'create_post',
                name: 'Create Post',
                url_pattern: '/wp-admin/post-new.php',
                is_authentication: false,
              },
            ],
          },
          {
            id: 2,
            key: 'shopify',
            name: 'Shopify Store',
            is_enabled: true,
            path_templates: [
              {
                id: 10,
                key: 'new_product',
                name: 'New Product',
                url_pattern: '/admin/products/new',
                is_authentication: false,
              },
            ],
          },
        ],
      },
      [],
    )

    assert.equal(mapped.cms_types.length, 2)
    assert.equal(
      formatCmsTypeLabel('shopify', mapped.cms_types),
      'Shopify Store',
    )

    const effective = resolveEffectivePathsForSite(
      mapped.sites[0],
      mapped.paths,
      mapped.cms_types,
    )
    assert.equal(effective.length, 1)
    assert.equal(effective[0].key, 'new_product')
    assert.equal(effective[0].url_pattern, '/admin/products/new')

    const synced = syncActionTagsForSites(
      mapped.sites,
      mapped.paths,
      mapped.tags,
      [],
      mapped.cms_types,
    )
    assert.equal(synced.tags.length, 1)
    assert.equal(synced.tags[0].tag_key, 'myshop.new_product')

    const summary = computeSiteDeleteSummary(
      60,
      [
        {
          id: 901,
          site_id: 60,
          site_key: 'myshop',
          key: 'custom',
          name: 'Custom',
          url_pattern: '/custom',
          path_inputs: [],
        },
      ],
      [
        {
          ...synced.tags[0],
          scripts_count: 1,
          published_script_available: true,
          auth_script: {
            script_id: 'auth.login',
            name: 'Auth Login',
            version: '1.0.0',
          },
        },
      ],
    )
    assert.deepEqual(summary, {
      sitePathsCount: 1,
      tagsCount: 1,
      publishedScriptsCount: 1,
      authPinsCount: 1,
    })
  })
})
