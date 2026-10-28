import type { ActionRegistryData, AuthScriptOption } from './types'

/**
 * MOCK Auth Script catalog — not live API.
 * `is_authentication` + `compatible_site_keys` are local seed only (no backend evidence).
 * Do not treat display-name substrings as production compatibility.
 */
export const MOCK_AUTH_SCRIPTS: AuthScriptOption[] = [
  {
    script_id: 'wordpress.login',
    name: 'WordPress Login',
    version: '1.0.0',
    status: 'published',
    is_authentication: true,
    compatible_site_keys: ['wordpress'],
  },
  {
    script_id: 'wordpress.login.longname',
    name: 'WordPress Login With Extremely Long Display Name For Overflow Check',
    version: '1.2.3',
    status: 'published',
    is_authentication: true,
    compatible_site_keys: ['wordpress'],
  },
  {
    script_id: 'wordpress.login.draft',
    name: 'WordPress Login (Draft)',
    version: '0.9.0',
    status: 'draft',
    is_authentication: true,
    compatible_site_keys: ['wordpress'],
  },
  {
    script_id: 'facebook.login.unavailable',
    name: 'Facebook Login Helper',
    version: null,
    status: 'unavailable',
    is_authentication: true,
    compatible_site_keys: ['facebook'],
  },
]

/** Labeled MOCK seed — not live API data. */
export const MOCK_ACTION_REGISTRY: ActionRegistryData = {
  actions: [
    { id: 1, key: 'post', name: 'Post', description: 'Create a post' },
    { id: 2, key: 'comment', name: 'Comment', description: 'Leave a comment' },
    { id: 3, key: 'collect', name: 'Collect', description: 'Collect content' },
  ],
  sites: [
    {
      id: 1,
      key: 'facebook',
      name: 'Facebook',
      base_url: 'https://www.facebook.com',
      base_url_mode: 'fixed',
      description: 'Facebook platform',
      paths_count: 2,
    },
    {
      id: 2,
      key: 'wordpress',
      name: 'WordPress',
      base_url: '',
      base_url_mode: 'dynamic',
      test_base_url: 'https://example.test/blog/',
      description: 'Dynamic CMS sites',
      paths_count: 1,
    },
  ],
  paths: [
    {
      id: 1,
      site_id: 1,
      site_key: 'facebook',
      key: 'group_composer',
      name: 'Group Composer',
      url_pattern: '/groups/{group_id}/',
      path_inputs: [{ key: 'group_id', type: 'String', required: true }],
      description: null,
    },
    {
      id: 2,
      site_id: 1,
      site_key: 'facebook',
      key: 'post_permalink',
      name: 'Post Permalink',
      url_pattern: '/{username}/posts/{post_id}/',
      path_inputs: [
        { key: 'username', type: 'String', required: true },
        { key: 'post_id', type: 'String', required: true },
      ],
      description: null,
    },
    {
      id: 3,
      site_id: 2,
      site_key: 'wordpress',
      key: 'new_post',
      name: 'New Post',
      url_pattern: '/wp-admin/post-new.php',
      path_inputs: [],
      description: null,
    },
  ],
  tags: [
    {
      id: 1,
      tag_key: 'facebook.group_composer.post',
      site_id: 1,
      site_key: 'facebook',
      site_name: 'Facebook',
      path_id: 1,
      path_key: 'group_composer',
      path_name: 'Group Composer',
      action_id: 1,
      action_key: 'post',
      action_name: 'Post',
      name: 'facebook.group_composer.post',
      scripts_count: 0,
      ready: false,
      latest_request_status: 'pending',
      latest_request_id: 'req_mock_001',
      auth_script: null,
    },
    {
      id: 2,
      tag_key: 'wordpress.new_post.post',
      site_id: 2,
      site_key: 'wordpress',
      site_name: 'WordPress',
      path_id: 3,
      path_key: 'new_post',
      path_name: 'New Post',
      action_id: 1,
      action_key: 'post',
      action_name: 'Post',
      name: 'wordpress.new_post.post',
      scripts_count: 1,
      ready: true,
      latest_request_status: 'published',
      latest_request_id: 'req_mock_002',
      auth_script: {
        script_id: 'wordpress.login',
        name: 'WordPress Login',
        version: '1.0.0',
      },
    },
  ],
  requests: [
    {
      id: 1,
      request_id: 'req_mock_001',
      action_tag_key: 'facebook.group_composer.post',
      request_type: 'create',
      status: 'pending',
      created_at: '2026-10-28T00:00:00Z',
    },
    {
      id: 2,
      request_id: 'req_mock_002',
      action_tag_key: 'wordpress.new_post.post',
      request_type: 'create',
      status: 'published',
      script_id: 'script_wp_post',
      script_version: '1.0.0',
      created_at: '2026-10-20T00:00:00Z',
    },
  ],
  auth_scripts: MOCK_AUTH_SCRIPTS,
}

export const EMPTY_REGISTRY: ActionRegistryData = {
  sites: [],
  paths: [],
  actions: MOCK_ACTION_REGISTRY.actions,
  tags: [],
  requests: [],
  auth_scripts: MOCK_AUTH_SCRIPTS,
}
