/** Local SVG posters — not production media. */

export function mockThumbnailSvg(
  label: string,
  tone: 'ready' | 'unavailable' | 'missing' = 'ready',
): string {
  const bg =
    tone === 'ready' ? '#0F172A' : tone === 'unavailable' ? '#334155' : '#F1F5F9'
  const fg = tone === 'missing' ? '#64748B' : '#E2E8F0'
  const safe = label.replace(/[<>&]/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="${bg}"/>
  <rect x="24" y="24" width="592" height="312" fill="none" stroke="${fg}" stroke-width="2" stroke-dasharray="8 6" opacity="0.35"/>
  <text x="320" y="168" text-anchor="middle" fill="${fg}" font-family="system-ui,sans-serif" font-size="18" font-weight="600">MOCK DEMO</text>
  <text x="320" y="200" text-anchor="middle" fill="${fg}" font-family="ui-monospace,monospace" font-size="13">${safe}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Tiny silent WebM-compatible approach: use empty video_url and modal mock playback.
 * For ready demos we also expose a short public-domain-style blob via data URI is impractical;
 * VideoPlayerModal uses poster + MOCK playback chrome when video_url is null but status=ready.
 */
export const MOCK_PLAYBACK_NOTE =
  'MOCK playback — binary demo không gắn production CDN. Không phải video thật từ registry.'
