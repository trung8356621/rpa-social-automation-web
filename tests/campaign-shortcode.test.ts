import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildLiveCampaignContentBody } from '../src/features/campaigns/api/build-content-payload.ts'
import { buildLiveCampaignCreateBody } from '../src/features/campaigns/api/build-create-payload.ts'
import {
  CAMPAIGN_CONTENT_PATHS,
  CAMPAIGN_PATHS,
} from '../src/features/campaigns/api/paths.ts'
import { mapLiveContent, mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import {
  mockCampaignAdapter,
  resetMockCampaignStore,
} from '../src/features/campaigns/api/mock-adapter.ts'
import { emptyScheduleForm } from '../src/features/campaigns/schedule.ts'
import {
  allScriptVariables,
  defaultShortcodeMappingForm,
  preferredDefaultVariable,
  validateShortcodeMappingForm,
} from '../src/features/campaigns/shortcode-mapping.ts'
import {
  applyShortcodeWrap,
  assertPlainShortcodeSource,
  defaultRawSourceForMapping,
  parseShortcodeSegments,
  rawSourceToTipTapDoc,
  serializeShortcodeSegments,
  tipTapDocToRawSource,
} from '../src/features/campaigns/shortcode-source.ts'
import { mapLiveScriptDetail } from '../src/features/script-registry/api/map-script-registry.ts'
import {
  diagnoseReleaseVariableProjection,
  parseScriptInputSchema,
  selectPublishedRelease,
} from '../src/features/campaigns/script-compat.ts'
import { validateCampaignForm } from '../src/features/campaigns/validation.ts'
import type { ScriptInputSchema } from '../src/features/campaigns/types.ts'
import type { ScriptDetail } from '../src/features/script-registry/types.ts'

const titleOnlySchema: ScriptInputSchema = {
  fields: [],
  test_mode_compatible: null,
  title_required: true,
  body_required: false,
  schema_available: true,
  title_supported: true,
  body_supported: false,
  unavailable_reason: null,
}

describe('Campaign Shortcode V2', () => {
  it('detects Staff detail projection gap: variable_count without variables[]', () => {
    const mapped = mapLiveScriptDetail({
      package_key: 'mayhopphat.create_post',
      script_id: 'mayhopphat.create_post',
      name: 'create_post',
      releases: [
        {
          id: 1,
          version: '1',
          status: 'published',
          content_digest: 'abc',
          // StaffScriptRegistryController::mapRelease strips variables:
          variable_count: 1,
          step_count: 0,
          asset_count: 0,
          runtime_requirements: [],
        },
      ],
    })
    const release = selectPublishedRelease(mapped, '1')
    assert.ok(release)
    assert.equal(release!.variables, null)
    assert.equal(release!.variable_count, 1)
    const diag = diagnoseReleaseVariableProjection(release!)
    assert.equal(diag.ok, false)
    if (!diag.ok) {
      assert.match(diag.reason, /CONTRACT GAP/)
      assert.match(diag.reason, /releases\[\]\.variables/)
      assert.match(diag.reason, /variable_count=1/)
    }
    const schema = parseScriptInputSchema(mapped, { scriptVersion: '1' })
    assert.equal(schema.schema_available, false)
    assert.match(String(schema.unavailable_reason), /CONTRACT GAP/)
  })

  it('extracts title when Staff projects variables[] (Backend fromManifest shape)', () => {
    const mapped = mapLiveScriptDetail({
      package_key: 'mayhopphat.create_post',
      name: 'create_post',
      releases: [
        {
          id: 1,
          version: '1',
          status: 'published',
          variable_count: 1,
          variables: [
            { key: 'title', type: 'string', required: true, label: 'Title' },
          ],
        },
      ],
    })
    const schema = parseScriptInputSchema(mapped, { scriptVersion: '1' })
    assert.equal(schema.schema_available, true)
    assert.equal(schema.title_supported, true)
    assert.equal(preferredDefaultVariable(schema), 'title')
  })

  it('selects published release by pinned version for variables', () => {
    const detail: ScriptDetail = {
      package_key: 'mayhopphat.create_post',
      name: 'create_post',
      action_tag_key: null,
      description: null,
      updated_by_label: 'test',
      releases: [
        {
          id: 9,
          version: '2',
          content_digest: '',
          status: 'draft',
          published_at: null,
          variables: [{ key: 'wrong', type: 'string', required: true }],
          variable_count: 1,
          steps: [],
          assets: [],
          runtime_requirements: [],
          video_demo: null,
          video_demo_status: 'missing',
          video_media_id: null,
          thumbnail_media_id: null,
          thumbnail_url: null,
          video_url: null,
        },
        {
          id: 1,
          version: '1',
          content_digest: '',
          status: 'published',
          published_at: null,
          variables: [
            { key: 'title', type: 'string', required: true, label: 'Title' },
          ],
          variable_count: 1,
          steps: [],
          assets: [],
          runtime_requirements: [],
          video_demo: null,
          video_demo_status: 'missing',
          video_media_id: null,
          thumbnail_media_id: null,
          thumbnail_url: null,
          video_url: null,
        },
      ],
    }
    const release = selectPublishedRelease(detail, '1')
    assert.equal(release?.version, '1')
    const schema = parseScriptInputSchema(detail, { scriptVersion: '1' })
    assert.equal(schema.schema_available, true)
    assert.equal(schema.title_supported, true)
    assert.equal(preferredDefaultVariable(schema), 'title')

    // Pinned draft version must fail closed — do not invent from another release.
    assert.equal(selectPublishedRelease(detail, '2'), null)
    assert.equal(
      parseScriptInputSchema(detail, { scriptVersion: '2' }).schema_available,
      false,
    )
  })

  it('default shortcode is body without assuming Script body variable', () => {
    const vars = allScriptVariables(titleOnlySchema)
    assert.deepEqual(
      vars.map((v) => v.key),
      ['title'],
    )
    assert.equal(preferredDefaultVariable(titleOnlySchema), 'title')
    const form = defaultShortcodeMappingForm('title')
    assert.equal(form[0]?.shortcode, 'body')
    assert.equal(form[0]?.variable, 'title')
  })

  it('rejects duplicate shortcode names and variable targets', () => {
    const dupName = validateShortcodeMappingForm(
      [
        { id: '1', shortcode: 'body', variable: 'title' },
        { id: '2', shortcode: 'body', variable: 'title' },
      ],
      titleOnlySchema,
    )
    assert.equal(dupName.ok, false)

    const multiVarSchema: ScriptInputSchema = {
      ...titleOnlySchema,
      fields: [
        { key: 'group_id', type: 'string', required: true, label: 'Group' },
      ],
      title_required: false,
      title_supported: false,
      body_supported: true,
      body_required: true,
    }
    const dupVar = validateShortcodeMappingForm(
      [
        { id: '1', shortcode: 'body', variable: 'body' },
        { id: '2', shortcode: 'group', variable: 'body' },
      ],
      multiVarSchema,
    )
    assert.equal(dupVar.ok, false)
  })

  it('create allows zero contents with shortcode_mapping', () => {
    const validated = validateCampaignForm(
      {
        name: 'Shortcode V2 Empty',
        site_key: 'mayhopphat',
        script_package_key: 'mayhopphat.create_post',
        script_version: '1',
        execution_mode: 'one_account_one_job',
        run_mode: 'live',
        schedule: emptyScheduleForm(),
        account_id: 'ff0035e0-a6d8-42af-8370-f5be9e453f2d',
        shortcode_mapping: [
          { id: '1', shortcode: 'body', variable: 'title' },
        ],
      },
      { requireAccountPin: true, schema: titleOnlySchema },
    )
    assert.equal(validated.ok, true)
    if (!validated.ok) return
    assert.equal(validated.value.contents?.length ?? 0, 0)
    const body = buildLiveCampaignCreateBody(validated.value)
    assert.equal(body.contents.length, 0)
    assert.deepEqual(body.shortcode_mapping, {
      entries: [{ shortcode: 'body', variable: 'title' }],
    })
  })

  it('shortcode wrap: selection wraps; empty inserts at caret', () => {
    const wrapped = applyShortcodeWrap('hello world', 'body', 0, 5)
    assert.equal(wrapped.text, '[body]hello[/body] world')

    const inserted = applyShortcodeWrap('ab', 'body', 1, 1)
    assert.equal(inserted.text, 'a[body][/body]b')
    assert.equal(inserted.caretStart, 1 + '[body]'.length)
  })

  it('raw_source round-trip via TipTap shortcode doc', () => {
    const raw = '[body]POC Draft Title[/body]'
    const doc = rawSourceToTipTapDoc(raw)
    assert.equal(tipTapDocToRawSource(doc), raw)
    assert.equal(defaultRawSourceForMapping(['body']), '[body][/body]')
    assert.deepEqual(parseShortcodeSegments(raw), [
      { name: 'body', inner: 'POC Draft Title' },
    ])
    assert.equal(
      serializeShortcodeSegments([{ name: 'body', inner: 'x' }]),
      '[body]x[/body]',
    )
  })

  it('rejects HTML / TipTap JSON before send', () => {
    assert.throws(() => assertPlainShortcodeSource('<p>hi</p>'))
    assert.throws(() =>
      assertPlainShortcodeSource('{"type":"doc","content":[]}'),
    )
    assert.doesNotThrow(() =>
      assertPlainShortcodeSource('[body]plain[/body]'),
    )
  })

  it('content payload prefers raw_source plain text', () => {
    const body = buildLiveCampaignContentBody(
      {
        campaign_id: 'c1',
        title: null,
        body: null,
        variables: {},
        raw_source: '[body]POC Draft Title[/body]',
        editor_doc: null,
      },
      { schema: titleOnlySchema, preferShortcode: true },
    )
    assert.equal(body.raw_source, '[body]POC Draft Title[/body]')
    assert.equal(body.input, undefined)
  })

  it('maps list rows with raw_source / source_format / mapping_version / legacy', () => {
    const shortcode = mapLiveContent({
      id: '1',
      source_format: 'shortcode',
      raw_source: '[body]A[/body]',
      mapping_version: 1,
      input: { title: 'A' },
      status: 'pending',
    })
    assert.equal(shortcode.source_format, 'shortcode')
    assert.equal(shortcode.raw_source, '[body]A[/body]')
    assert.equal(shortcode.mapping_version, 1)

    const legacy = mapLiveContent({
      id: '2',
      input: { title: 'Legacy', body: 'old' },
      status: 'pending',
    })
    assert.equal(legacy.source_format, 'legacy_input')
    assert.equal(legacy.raw_source, null)

    const campaign = mapLiveCampaign({
      id: 'camp',
      name: 'N',
      platform: 'mayhopphat',
      script_id: 'mayhopphat.create_post',
      shortcode_mapping: {
        entries: [{ shortcode: 'body', variable: 'title' }],
      },
      shortcode_mapping_version: 1,
    })
    assert.equal(campaign.shortcode_mapping?.entries[0]?.variable, 'title')
    assert.equal(campaign.shortcode_mapping_version, 1)
  })

  it('mock preview/save paths + adapter quantity-only', async () => {
    assert.equal(
      CAMPAIGN_PATHS.mockPreview('abc'),
      '/social-automation/api/campaigns/abc/contents/mock-preview',
    )
    assert.equal(
      CAMPAIGN_CONTENT_PATHS.mockSave('abc'),
      '/social-automation/api/campaigns/abc/contents/mock-save',
    )

    resetMockCampaignStore()
    const created = await mockCampaignAdapter.createCampaign({
      name: 'Mock Shortcode',
      site_key: 'mayhopphat',
      script_package_key: 'mayhopphat.create_post',
      script_version: '1',
      execution_mode: 'one_account_one_job',
      run_mode: 'live',
      schedule: {
        type: 'immediate',
        timezone: 'Asia/Ho_Chi_Minh',
        start_at: null,
        daily_window: null,
        min_interval_seconds: null,
        resource_recheck_seconds: 3600,
      },
      account_id: 'ff0035e0-a6d8-42af-8370-f5be9e453f2d',
      shortcode_mapping: {
        entries: [{ shortcode: 'body', variable: 'title' }],
      },
      contents: [],
    })
    const preview = await mockCampaignAdapter.mockPreviewContents(created.id, 5)
    assert.equal(preview.count, 5)
    assert.equal(preview.articles.length, 5)
    assert.match(preview.articles[0]!.raw_source, /\[body\].*\[\/body\]/)

    const saved = await mockCampaignAdapter.mockSaveContents(
      created.id,
      1,
      'mock-batch-test-1',
    )
    assert.equal(saved.count, 1)
    assert.equal(saved.contents[0]?.source_format, 'shortcode')
    assert.ok(saved.contents[0]?.raw_source)
  })
})
