import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapLiveAccountItem } from '../src/features/accounts/api/map-account.ts'
import {
  buildCreateAccountBody,
  buildUpdateAccountBody,
  redactAccountBodyForDiagnostics,
} from '../src/features/accounts/api/account-payload.ts'

describe('account username free-text (CP18C.3)', () => {
  it('A. username "mayhopphat" accepted', () => {
    const built = buildCreateAccountBody({
      name: 'A',
      username: 'mayhopphat',
      platform: 'wordpress',
      password: 'x',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.body.username, 'mayhopphat')
    assert.equal('email' in built.body, false)
  })

  it('B. username "@marketing" accepted', () => {
    const built = buildCreateAccountBody({
      name: 'A',
      username: '@marketing',
      platform: 'facebook',
      password: 'x',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.body.username, '@marketing')
  })

  it('C. username "0912345678" accepted', () => {
    const built = buildCreateAccountBody({
      name: 'A',
      username: '0912345678',
      platform: 'facebook',
      password: 'x',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.body.username, '0912345678')
  })

  it('D. email-shaped username accepted as text (not converted to email field)', () => {
    const built = buildCreateAccountBody({
      name: 'A',
      username: 'marketing@example.com',
      platform: 'wordpress',
      password: 'x',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.body.username, 'marketing@example.com')
    assert.equal('email' in built.body, false)
  })

  it('E. empty username rejected', () => {
    const built = buildCreateAccountBody({
      name: 'A',
      username: '   ',
      platform: 'wordpress',
      password: 'x',
    })
    assert.equal(built.ok, false)
    if (built.ok) return
    assert.match(built.message, /Username/i)
    assert.doesNotMatch(built.message, /email hợp lệ/i)
  })

  it('F. password remains in body only; redact helper masks it', () => {
    const built = buildCreateAccountBody({
      name: 'A',
      username: 'mayhopphat',
      platform: 'wordpress',
      password: 'SYNTHETIC_SECRET',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    const redacted = redactAccountBodyForDiagnostics(
      built.body as unknown as Record<string, unknown>,
    )
    assert.equal(redacted.password, '[REDACTED]')
    assert.equal(redacted.username, 'mayhopphat')
  })

  it('G. create request maps Site.key to platform and username field', () => {
    const built = buildCreateAccountBody({
      name: 'WP Demo',
      username: 'mayhopphat',
      platform: 'wordpress',
      password: 'x',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.deepEqual(Object.keys(built.body).sort(), [
      'name',
      'password',
      'platform',
      'username',
    ])
    assert.equal(built.body.platform, 'wordpress')
  })

  it('H. edit request preserves omitted password', () => {
    const built = buildUpdateAccountBody({
      name: 'A',
      username: '@marketing',
      platform: 'wordpress',
      password: '   ',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal('password' in built.body, false)
    assert.equal(built.body.username, '@marketing')
  })

  it('I. Site Registry key is the API platform (not display name)', () => {
    const built = buildCreateAccountBody({
      name: 'FB',
      username: 'user1',
      platform: 'facebook',
      password: 'x',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.body.platform, 'facebook')
    assert.notEqual(built.body.platform, 'Facebook')
  })

  it('inventory mapper never surfaces password fields', () => {
    const poisoned = {
      id: 1,
      account_uuid: 'u-1',
      platform: 'wordpress',
      account_name: 'N',
      username: 'mayhopphat',
      email: null,
      has_password: true,
      password: 'LEAK',
      encrypted_password: 'LEAK2',
    }
    const mapped = mapLiveAccountItem(poisoned as never)
    const json = JSON.stringify(mapped)
    assert.equal(mapped.username, 'mayhopphat')
    assert.doesNotMatch(json, /LEAK/)
  })

  it('trims surrounding whitespace but keeps internal characters', () => {
    const built = buildCreateAccountBody({
      name: ' A ',
      username: '  @marketing  ',
      platform: ' facebook ',
      password: ' x ',
    })
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.body.name, 'A')
    assert.equal(built.body.username, '@marketing')
    assert.equal(built.body.platform, 'facebook')
  })
})
