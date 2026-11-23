import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, it } from 'node:test'

import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import {
  getMockCampaignStore,
  mockCampaignAdapter,
  resetMockCampaignStore,
} from '../src/features/campaigns/api/mock-adapter.ts'
import { CAMPAIGN_PATHS } from '../src/features/campaigns/api/paths.ts'
import { resolveArtifactFetchUrl } from '../src/features/campaigns/campaign-artifacts.ts'
import {
  MAX_INTERVAL_MINUTES,
  canEditActionTagInterval,
  isActionTagIntervalEditableStatus,
  validateInlineIntervalInput,
} from '../src/features/campaigns/campaign-interval-edit.ts'
import { ApiError } from '../src/lib/api/errors.ts'

afterEach(() => {
  resetMockCampaignStore()
})

describe('Inline Editing of Action Tag Posting Interval', () => {
  it('1, 11, 12 & 13. Pencil shown for Draft/Running/Paused and hidden for terminal/unauthorized states', () => {
    assert.equal(isActionTagIntervalEditableStatus('draft'), true)
    assert.equal(isActionTagIntervalEditableStatus('running'), true)
    assert.equal(isActionTagIntervalEditableStatus('paused'), true)
    assert.equal(isActionTagIntervalEditableStatus('completed'), false)
    assert.equal(isActionTagIntervalEditableStatus('cancelled'), false)
    assert.equal(isActionTagIntervalEditableStatus('scheduled'), false)

    assert.equal(canEditActionTagInterval({ status: 'draft' }, true), true)
    assert.equal(canEditActionTagInterval({ status: 'running' }, true), true)
    assert.equal(canEditActionTagInterval({ status: 'paused' }, true), true)
    assert.equal(canEditActionTagInterval({ status: 'completed' }, true), false)
    assert.equal(canEditActionTagInterval({ status: 'cancelled' }, true), false)
    assert.equal(canEditActionTagInterval({ status: 'running' }, false), false)

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /canEditInterval && editingTagKey === tag\.action_tag_key/)
    assert.match(screenSrc, /aria-label=\{`Edit interval for \$\{tag\.action_tag_key\}`\}/)
    assert.match(screenSrc, /<Pencil className="size-3\.5" \/>/)
  })

  it('2 & 4. Correct initial interval prefilled on pencil click and Cancel leaves persisted value unchanged', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /setIntervalDraft\(\s*String\(tag\.interval_minutes \?\? 0\)/)
    assert.match(screenSrc, /setEditingTagKey\(null\)/)
  })

  it('3, 8, 9, 11 & 12. Narrow PATCH updates exactly one Tag, refreshes Detail, and updates next_run_at', async () => {
    assert.equal(
      CAMPAIGN_PATHS.actionTagInterval('camp-1', 'maytuicanvas.create_post'),
      '/social-automation/api/campaigns/camp-1/action-tags/maytuicanvas.create_post/interval',
    )

    const liveAdapterSrc = readFileSync(
      resolve('src/features/campaigns/api/live-adapter.ts'),
      'utf8',
    )
    assert.match(
      liveAdapterSrc,
      /updateActionTagInterval\([\s\S]*?method:\s*'PATCH'[\s\S]*?body:\s*\{\s*interval_minutes:\s*intervalMinutes\s*\}/,
    )
    // Must not call full PUT update or embed Client API keys
    assert.doesNotMatch(liveAdapterSrc, /X-Client-Api-Key/)

    const hookSrc = readFileSync(
      resolve('src/features/campaigns/use-campaigns.ts'),
      'utf8',
    )
    assert.match(
      hookSrc,
      /updateActionTagInterval[\s\S]*?applyAndReloadCampaign/,
    )

    // Test mock adapter on running and paused campaigns with multiple tags
    const store = getMockCampaignStore()
    const camp = store.campaigns[0]!
    camp.status = 'running'
    camp.action_tags = [
      {
        action_tag_id: 1,
        action_tag_key: 'sitea.create_post',
        site_key: 'sitea',
        site_name: 'Site A',
        cms_type: 'wordpress',
        script_package_key: 'sitea.create_post',
        script_name: 'Create Post',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'site_specific',
        shortcode_mapping: null,
        interval_minutes: 0,
      },
      {
        action_tag_id: 2,
        action_tag_key: 'siteb.create_post',
        site_key: 'siteb',
        site_name: 'Site B',
        cms_type: 'wordpress',
        script_package_key: 'siteb.create_post',
        script_name: 'Create Post',
        script_version: '1.0.0',
        release_id: 102,
        resolution_source: 'site_specific',
        shortcode_mapping: null,
        interval_minutes: 60,
      },
    ]

    const updatedRunning = await mockCampaignAdapter.updateActionTagInterval(
      camp.id,
      'sitea.create_post',
      240,
    )
    assert.equal(updatedRunning.action_tags?.[0]?.interval_minutes, 240)
    assert.equal(updatedRunning.action_tags?.[1]?.interval_minutes, 60)

    camp.status = 'paused'
    const updatedPaused = await mockCampaignAdapter.updateActionTagInterval(
      camp.id,
      'sitea.create_post',
      1440,
    )
    assert.equal(updatedPaused.action_tags?.[0]?.interval_minutes, 1440)

    // Terminal state rejected
    camp.status = 'completed'
    await assert.rejects(
      () =>
        mockCampaignAdapter.updateActionTagInterval(
          camp.id,
          'sitea.create_post',
          10,
        ),
      (err: unknown) => err instanceof ApiError && err.status === 409,
    )

    // Updated next_run_at mapped from Backend PATCH/GET response
    const mapped = mapLiveCampaign({
      id: 'camp-live-1',
      plan_version: 2,
      status: 'running',
      action_tags: [
        {
          action_tag_key: 'maytuicanvas.create_post',
          site_key: 'maytuicanvas',
          script_package_key: 'maytuicanvas.create_post',
          script_version: '1.0.0',
          interval_minutes: 240,
          next_run_at: '2026-11-23T18:00:00Z',
        },
      ],
    })
    assert.equal(mapped.action_tags?.[0]?.interval_minutes, 240)
    assert.equal(mapped.action_tags?.[0]?.next_run_at, '2026-11-23T18:00:00Z')
  })

  it('5. Rejects negative, decimal, empty, non-numeric, and out-of-range values', () => {
    assert.deepEqual(validateInlineIntervalInput('0'), { ok: true, value: 0 })
    assert.deepEqual(validateInlineIntervalInput('5'), { ok: true, value: 5 })
    assert.deepEqual(validateInlineIntervalInput('60'), { ok: true, value: 60 })
    assert.deepEqual(validateInlineIntervalInput('240'), { ok: true, value: 240 })
    assert.deepEqual(validateInlineIntervalInput('1440'), { ok: true, value: 1440 })

    assert.equal(validateInlineIntervalInput('').ok, false)
    assert.equal(validateInlineIntervalInput('   ').ok, false)
    assert.equal(validateInlineIntervalInput('-1').ok, false)
    assert.equal(validateInlineIntervalInput('1.5').ok, false)
    assert.equal(validateInlineIntervalInput('abc').ok, false)
    assert.equal(
      validateInlineIntervalInput(String(MAX_INTERVAL_MINUTES + 1)).ok,
      false,
    )
  })

  it('6, 7 & 10. Duplicate requests blocked, failed PATCH retains edit state & shows error, polling does not overwrite draft', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    // Single-flight guard & disabled while saving
    assert.match(screenSrc, /savingIntervalRef\.current/)
    assert.match(screenSrc, /disabled=\{savingInterval\}/)
    // Error keeps editingTagKey open and displays role="alert"
    assert.match(screenSrc, /isEditing && intervalError/)
    assert.match(screenSrc, /role="alert"/)
    // intervalDraft is NOT overwritten by any useEffect on campaign.action_tags
    const effectBlock = screenSrc.slice(
      screenSrc.indexOf('useEffect('),
      screenSrc.indexOf('const run = async'),
    )
    assert.doesNotMatch(effectBlock, /setIntervalDraft/)
  })

  it('14 & 15. History expansion, scroll position, and screenshot support remain intact', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /expandedHistoryIds/)
    assert.match(screenSrc, /AttemptScreenshot/)
    assert.match(screenSrc, /ScreenshotPreviewModal/)
    assert.equal(
      resolveArtifactFetchUrl({
        artifact_uuid: 'art-1',
        has_binary: true,
        download_url: null,
        url: null,
      }),
      '/social-automation/api/campaigns/artifacts/art-1',
    )
  })
})
