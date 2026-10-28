import type { AccountItem, AccountsData } from './types'

/** MOCK seed aligned to SaAccount list JSON — no passwords. */
export const MOCK_ACCOUNTS: AccountItem[] = [
  {
    id: 1,
    account_uuid: 'acc_wp_01_a1b2c3d4',
    installation_id: 'inst_demo',
    platform: 'wordpress',
    account_name: 'Main Blog Editor',
    username: 'editor.main',
    email: 'editor@example.test',
    has_password: true,
    note: 'WordPress-first test account',
    last_interaction_at: '2026-10-28T08:15:00Z',
    created_by: 1,
    created_by_name: 'rpa.creator',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-28T08:15:00Z',
    verified: true,
  },
  {
    id: 2,
    account_uuid: 'acc_fb_02_e5f6g7h8',
    installation_id: 'inst_demo',
    platform: 'facebook',
    account_name: 'Group Ops',
    username: 'ops.group.very.long.username.for.overflow.check.001',
    email: null,
    has_password: true,
    note: null,
    last_interaction_at: '2026-10-20T12:00:00Z',
    created_by: 1,
    created_by_name: 'rpa.creator',
    created_at: '2026-09-15T00:00:00Z',
    updated_at: '2026-10-20T12:00:00Z',
    verified: false,
  },
  {
    id: 3,
    account_uuid: 'acc_fb_03_i9j0k1l2',
    installation_id: 'inst_demo',
    platform: 'facebook',
    account_name: 'Comment Helper',
    username: null,
    email: 'helper@example.test',
    has_password: false,
    note: 'Declared email only — no stored credential flag',
    last_interaction_at: null,
    created_by: 2,
    created_by_name: 'tech.lead',
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
    verified: false,
  },
]

export const MOCK_ACCOUNTS_DATA: AccountsData = { accounts: MOCK_ACCOUNTS }
export const EMPTY_ACCOUNTS_DATA: AccountsData = { accounts: [] }
