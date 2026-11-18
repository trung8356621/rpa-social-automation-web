import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapLiveActionRegistry } from '../src/features/action-tags/api/mappers.ts'
import { MOCK_ACTION_REGISTRY } from '../src/features/action-tags/mock-data.ts'
import {
  buildTagKey,
  findExistingSitePathTag,
  isValidTagKeyFormat,
  MAX_TAG_KEY_LENGTH,
  normalizeTagSegment,
  parseInputsFromPattern,
  resolveUrl,
} from '../src/features/action-tags/utils.ts'
import { filterScriptsForSite } from '../src/features/campaigns/script-compat.ts'

describe('Action Tag Site + Path refactor & legacy compatibility', () => {
  it('1. Builds Tag Key mayhopphat.login from Site + Path without Action enum', () => {
    const site = MOCK_ACTION_REGISTRY.sites.find((s) => s.key === 'mayhopphat')!
    const path = MOCK_ACTION_REGISTRY.paths.find(
      (p) => p.site_id === site.id && p.key === 'login',
    )!
    assert.ok(site)
    assert.ok(path)
    assert.equal(path.url_pattern, '/wp-login.php')

    const key = buildTagKey(site.key, path.key)
    assert.equal(key, 'mayhopphat.login')
    assert.equal(isValidTagKeyFormat(key), true)
  })

  it('2. Builds canonical Tag Keys for other Site + Path combinations', () => {
    assert.equal(buildTagKey('mayhopphat', 'products'), 'mayhopphat.products')
    assert.equal(buildTagKey('facebook', 'group'), 'facebook.group')
    assert.equal(
      buildTagKey('  MayHopPhat ', ' /wp-login.php '),
      'mayhopphat.wp-login_php',
    )
  })

  it('3. Safe normalization and length bounds on Tag Key segments', () => {
    assert.equal(normalizeTagSegment('  Login Page!@#  '), 'login_page')
    const longSite = 'a'.repeat(90)
    const longPath = 'b'.repeat(90)
    const key = buildTagKey(longSite, longPath)
    assert.ok(key.length <= MAX_TAG_KEY_LENGTH)
    assert.equal(isValidTagKeyFormat(key), true)
    assert.equal(isValidTagKeyFormat('invalid key with spaces'), false)
  })

  it('4. Legacy 3-part Tag Keys (e.g. facebook.group.post) remain valid and supported', () => {
    const legacyKey = buildTagKey('facebook', 'group', 'post')
    assert.equal(legacyKey, 'facebook.group.post')
    assert.equal(isValidTagKeyFormat('facebook.group.post'), true)
    assert.equal(isValidTagKeyFormat('facebook.group_composer.post'), true)

    const mapped = mapLiveActionRegistry(
      {
        ok: true,
        sites: [
          {
            id: 1,
            key: 'facebook',
            name: 'Facebook',
            base_url: 'https://www.facebook.com',
          },
          {
            id: 3,
            key: 'mayhopphat',
            name: 'Mayhopphat',
            base_url: 'https://mayhopphat.example.test',
          },
        ],
        paths: [
          {
            id: 10,
            site_id: 1,
            site_key: 'facebook',
            key: 'group',
            name: 'Group',
            url_pattern: '/groups/{group_id}',
            path_inputs: [{ key: 'group_id', type: 'string', required: true }],
          },
          {
            id: 20,
            site_id: 3,
            site_key: 'mayhopphat',
            key: 'login',
            name: 'login',
            url_pattern: '/wp-login.php',
            path_inputs: [],
          },
        ],
        actions: [],
        tags: [
          {
            id: 100,
            tag_key: 'facebook.group.post',
            site_id: 1,
            site_key: 'facebook',
            site_name: 'Facebook',
            path_id: 10,
            path_key: 'group',
            path_name: 'Group',
            action_id: 1,
            action_key: 'post',
            action_name: 'Post',
            name: 'Facebook Group Post',
            scripts_count: 1,
            ready: true,
            latest_request_status: 'published',
            latest_request_id: 'req_legacy_1',
          },
          {
            id: 101,
            tag_key: 'mayhopphat.login',
            site_id: 3,
            site_key: 'mayhopphat',
            site_name: 'Mayhopphat',
            path_id: 20,
            path_key: 'login',
            path_name: 'login',
            action_id: null,
            action_key: null,
            action_name: null,
            name: 'mayhopphat.login',
            scripts_count: 1,
            ready: true,
            latest_request_status: 'published',
            latest_request_id: 'req_new_1',
          },
        ],
        requests: [
          {
            id: 1,
            request_id: 'req_legacy_1',
            action_tag_key: 'facebook.group.post',
            request_type: 'create',
            status: 'published',
            script_id: 'facebook-group-post',
            script_version: '1.0.0',
          },
          {
            id: 2,
            request_id: 'req_new_1',
            action_tag_key: 'mayhopphat.login',
            request_type: 'create',
            status: 'published',
            script_id: 'mayhopphat-login',
            script_version: '1.0.0',
          },
        ],
      },
      [],
    )

    const legacyTag = mapped.tags.find((t) => t.tag_key === 'facebook.group.post')!
    const newTag = mapped.tags.find((t) => t.tag_key === 'mayhopphat.login')!

    assert.equal(legacyTag.action_key, 'post')
    assert.equal(legacyTag.action_name, 'Post')
    assert.equal(legacyTag.scripts_count, 1)
    assert.equal(newTag.action_key, null)
    assert.equal(newTag.action_name, null)
    assert.equal(newTag.scripts_count, 1)
  })

  it('5. Enforces uniqueness per Site + Path and surfaces existing Tag instead of duplicate', () => {
    const existing = findExistingSitePathTag(
      MOCK_ACTION_REGISTRY.tags,
      { id: 1, key: 'facebook' },
      { id: 1, key: 'group_composer' },
    )
    assert.ok(existing)
    assert.equal(existing.tag_key, 'facebook.group_composer.post')

    const nonExisting = findExistingSitePathTag(
      MOCK_ACTION_REGISTRY.tags,
      { id: 3, key: 'mayhopphat' },
      { id: 4, key: 'login' },
    )
    assert.equal(nonExisting, null)
  })

  it('6. Script Registry & Campaign compatibility works with 2-part Tag Keys (mayhopphat.login)', () => {
    const scripts = [
      {
        package_key: 'mayhopphat.login',
        script_id: 'mayhopphat-login',
        name: 'Mayhopphat Login Flow',
        action_tag_key: 'mayhopphat.login',
        version: '1.0.0',
        release_id: 201,
        status: 'published' as const,
        assets_complete: true,
        video_demo_status: 'ready' as const,
        has_playable_video: true,
        has_thumbnail: true,
        video_media_id: 1,
        thumbnail_media_id: 2,
        thumbnail_url: null,
        video_url: null,
        last_sync_label: '',
        updated_by_label: '',
      },
    ]
    const matched = filterScriptsForSite(scripts, 'mayhopphat')
    assert.equal(matched.length, 1)
    assert.equal(matched[0].action_tag_key, 'mayhopphat.login')
  })

  it('7. Editing Site/Path preserves canonical keys and URL resolution', () => {
    const inputs = parseInputsFromPattern('/wp-login.php')
    assert.deepEqual(inputs, [])
    const resolved = resolveUrl(
      'https://mayhopphat.example.test',
      '/wp-login.php',
      {},
    )
    assert.equal(resolved.valid, true)
    assert.equal(resolved.url, 'https://mayhopphat.example.test/wp-login.php')
  })
})
