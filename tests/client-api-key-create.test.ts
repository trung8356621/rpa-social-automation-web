import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildCreateClientApiKeyBody,
  messageForClientKeyAssignmentError,
  redactCreateClientKeyResponseForDiagnostics,
} from '../src/features/client-api-keys/api/create-payload.ts'
import {
  mapLiveAssignableUser,
  mapLiveClientApiKeyItem,
} from '../src/features/client-api-keys/api/map-client-api-key.ts'

describe('Client API Key LIVE create payload (≥833e2a3)', () => {
  it('Owner self-assign: legacy name-only body (no assigned_to_user_id)', () => {
    const built = buildCreateClientApiKeyBody({
      name: 'Owner Self Key',
      canAssignToOthers: true,
      assigned_to_user_id: null,
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.deepEqual(built.body, { name: 'Owner Self Key' })
    assert.equal('assigned_to_user_id' in built.body, false)
    assert.equal('created_by' in built.body, false)
    assert.equal('issued_by' in built.body, false)
  })

  it('Owner selects another eligible User → assigned_to_user_id sent', () => {
    const built = buildCreateClientApiKeyBody({
      name: 'QA Staff Key',
      canAssignToOthers: true,
      assigned_to_user_id: 42,
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.deepEqual(built.body, {
      name: 'QA Staff Key',
      assigned_to_user_id: 42,
    })
  })

  it('Invalid assignment id rejected client-side for Owner', () => {
    const built = buildCreateClientApiKeyBody({
      name: 'Bad',
      canAssignToOthers: true,
      assigned_to_user_id: -1,
    })
    assert.equal(built.ok, false)
    if (built.ok) return
    assert.equal(built.code, 'assigned_user_invalid')
  })

  it('Non-Owner cannot forward arbitrary assigned_to_user_id', () => {
    const built = buildCreateClientApiKeyBody({
      name: 'Hijack',
      canAssignToOthers: false,
      assigned_to_user_id: 99,
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.deepEqual(built.body, { name: 'Hijack' })
    assert.equal('assigned_to_user_id' in built.body, false)
  })

  it('Empty name allowed (Backend defaults label)', () => {
    const built = buildCreateClientApiKeyBody({
      name: '   ',
      canAssignToOthers: true,
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.deepEqual(built.body, {})
  })

  it('Stable assignment error codes map to UX copy', () => {
    assert.equal(
      messageForClientKeyAssignmentError('assignment_forbidden'),
      'Only Owner/Admin may assign a Client API Key to another user.',
    )
    assert.equal(
      messageForClientKeyAssignmentError('assigned_user_invalid'),
      'Assigned user was not found or is invalid.',
    )
    assert.equal(
      messageForClientKeyAssignmentError('assigned_user_ineligible'),
      'Assigned user is not an eligible Staff/Owner in this account scope.',
    )
    assert.equal(
      messageForClientKeyAssignmentError('other', 'LIVE boom'),
      'LIVE boom',
    )
  })
})

describe('Client API Key response mapping + one-time raw_key hygiene', () => {
  it('Maps created_by (owner) and issued_by (issuer); never maps secrets', () => {
    const fixture = {
      id: 9,
      name: 'QA Staff Key',
      key_prefix: 'rpa_client_abcd',
      installation_id: 'ins_x',
      created_by: 42,
      created_by_name: 'QA Staff',
      issued_by: 1,
      issued_by_name: 'Owner',
      last_used_at: null,
      revoked_at: null,
      is_active: true,
      created_at: '2026-11-25T00:00:00+00:00',
      raw_key: 'rpa_client_SHOULD_NOT_MAP',
      encrypted_key: 'enc:xxx',
    }
    const mapped = mapLiveClientApiKeyItem(
      fixture as unknown as Parameters<typeof mapLiveClientApiKeyItem>[0],
    )
    assert.equal(mapped.id, 9)
    assert.equal(mapped.created_by, 42)
    assert.equal(mapped.issued_by, 1)
    assert.equal(mapped.created_by_name, 'QA Staff')
    assert.equal(mapped.issued_by_name, 'Owner')
    assert.equal('raw_key' in mapped, false)
    assert.equal('encrypted_key' in mapped, false)
    assert.equal(mapped.mock_lease, undefined)
  })

  it('Maps assignable users list fixture', () => {
    const user = mapLiveAssignableUser({
      id: 42,
      name: 'QA Staff',
      email: 'qa@example.test',
      role: 'staff',
    })
    assert.deepEqual(user, {
      id: 42,
      name: 'QA Staff',
      email: 'qa@example.test',
      role: 'staff',
    })
  })

  it('Redacts raw_key from create response diagnostics', () => {
    const redacted = redactCreateClientKeyResponseForDiagnostics({
      ok: true,
      message: 'created',
      raw_key: 'rpa_client_SECRET_ONCE',
      key: {
        id: 1,
        name: 'X',
        key_prefix: 'rpa_client_ab',
        raw_key: 'nested_secret',
      },
    })
    assert.equal(redacted.raw_key, '[redacted]')
    assert.equal(
      (redacted.key as Record<string, unknown>).raw_key,
      '[redacted]',
    )
    assert.equal((redacted.key as Record<string, unknown>).id, 1)
    assert.equal(
      JSON.stringify(redacted).includes('rpa_client_SECRET_ONCE'),
      false,
    )
  })

  it('MOCK create body path stays isolated from LIVE (no secret in body builder)', () => {
    const built = buildCreateClientApiKeyBody({
      name: 'Mock Only',
      canAssignToOthers: false,
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(JSON.stringify(built.body).includes('MOCK'), false)
    assert.equal(JSON.stringify(built.body).includes('raw'), false)
  })
})
