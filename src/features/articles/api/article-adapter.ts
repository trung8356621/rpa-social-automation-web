import { getRpaApiMode } from '@/lib/api/config'

import { liveArticleAdapter } from './live-adapter'
import { mockArticleAdapter } from './mock-adapter'

export function getArticleAdapter() {
  return getRpaApiMode() === 'live' ? liveArticleAdapter : mockArticleAdapter
}
