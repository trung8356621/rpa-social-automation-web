import type { ProxyOptions } from 'vite'

/**
 * DEV-only same-origin bridge to SEO-OPS (Vite `server.proxy`).
 *
 * Loaded only when `vite` command === `serve`. Never used by production build.
 * Does not invent auth, disable CSRF, or widen CORS. Never log Cookie / Set-Cookie.
 *
 * Browser talks to localhost:5173; Vite proxies session + staff API to the target.
 * Production Set-Cookie is `Secure; SameSite=Lax` (host-only). On HTTP localhost
 * the Secure flag must be stripped or the browser rejects the cookie.
 */

const DEFAULT_TARGET = 'https://seo-ops.duckdns.org'

export function resolveDevProxyTarget(): string {
  const raw = process.env.VITE_RPA_DEV_PROXY_TARGET?.trim()
  if (!raw) return DEFAULT_TARGET
  return raw.replace(/\/$/, '')
}

function targetHostname(target: string): string {
  try {
    return new URL(target).hostname
  } catch {
    return 'seo-ops.duckdns.org'
  }
}

/** Strip Secure so HTTP localhost can store the session; keep HttpOnly / Path / SameSite. */
function rewriteSetCookieForLocalDev(
  setCookie: string | string[] | undefined,
): string[] | undefined {
  if (!setCookie) return undefined
  const list = Array.isArray(setCookie) ? setCookie : [setCookie]
  return list.map((cookie) =>
    cookie
      .replace(/;\s*Secure/gi, '')
      .replace(/;\s*Domain=[^;]*/gi, ''),
  )
}

/**
 * Keep redirects on the Vite origin. After staff login, Filament home (/seo|/admin)
 * is remapped to the React Action Tags route so DEV lands in the CSR app.
 */
function rewriteLocationForLocalDev(location: string, targetHost: string): string {
  let pathWithQuery = location
  try {
    const base = location.startsWith('http')
      ? undefined
      : 'http://localhost'
    const url = base ? new URL(location, base) : new URL(location)
    if (
      url.hostname === targetHost ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1'
    ) {
      pathWithQuery = `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    pathWithQuery = location.replace(
      new RegExp(`^https?://${escapeRegExp(targetHost)}`, 'i'),
      '',
    )
  }

  if (
    pathWithQuery === '/' ||
    pathWithQuery === '/seo' ||
    pathWithQuery.startsWith('/seo/') ||
    pathWithQuery === '/admin' ||
    pathWithQuery.startsWith('/admin/')
  ) {
    return '/social-automation/action-tags'
  }

  return pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Login HTML uses absolute form action → production host; make it relative for DEV. */
function rewriteHtmlAbsoluteOrigin(html: string, target: string): string {
  const host = targetHostname(target)
  const escaped = escapeRegExp(target)
  const hostEscaped = escapeRegExp(host)
  return html
    .replace(new RegExp(escaped, 'gi'), '')
    .replace(new RegExp(`https?://${hostEscaped}`, 'gi'), '')
}

function attachCookieAndLocationBridge(
  proxy: Parameters<NonNullable<ProxyOptions['configure']>>[0],
  target: string,
): void {
  const host = targetHostname(target)

  proxy.on('proxyReq', (proxyReq) => {
    // Avoid gzip so optional HTML rewrite can read plain text without zlib.
    proxyReq.setHeader('accept-encoding', 'identity')
  })

  proxy.on('proxyRes', (proxyRes) => {
    const cookies = rewriteSetCookieForLocalDev(proxyRes.headers['set-cookie'])
    if (cookies) proxyRes.headers['set-cookie'] = cookies

    const location = proxyRes.headers.location
    if (typeof location === 'string' && location.length > 0) {
      proxyRes.headers.location = rewriteLocationForLocalDev(location, host)
    }
  })
}

function createPassthroughProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    secure: true,
    autoRewrite: true,
    protocolRewrite: 'http',
    cookieDomainRewrite: 'localhost',
    configure(proxy) {
      attachCookieAndLocationBridge(proxy, target)
    },
  }
}

/**
 * /login needs HTML body rewrite (absolute form action) + cookie bridge.
 * POST /login redirects are handled in the same proxy entry.
 */
function createLoginProxy(target: string): ProxyOptions {
  const host = targetHostname(target)

  return {
    target,
    changeOrigin: true,
    secure: true,
    autoRewrite: true,
    protocolRewrite: 'http',
    cookieDomainRewrite: 'localhost',
    selfHandleResponse: true,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('accept-encoding', 'identity')
      })

      proxy.on('proxyRes', (proxyRes, _req, res) => {
        const chunks: Buffer[] = []
        proxyRes.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        proxyRes.on('end', () => {
          const headers: Record<string, string | string[] | undefined> = {
            ...proxyRes.headers,
          }

          const cookies = rewriteSetCookieForLocalDev(headers['set-cookie'])
          if (cookies) headers['set-cookie'] = cookies

          if (typeof headers.location === 'string' && headers.location.length > 0) {
            headers.location = rewriteLocationForLocalDev(headers.location, host)
          }

          delete headers['content-encoding']
          delete headers['transfer-encoding']
          delete headers['content-length']

          let body = Buffer.concat(chunks)
          const contentType = String(headers['content-type'] ?? '')
          if (contentType.includes('text/html')) {
            body = Buffer.from(
              rewriteHtmlAbsoluteOrigin(body.toString('utf8'), target),
              'utf8',
            )
          }

          headers['content-length'] = String(body.length)
          res.writeHead(proxyRes.statusCode ?? 502, headers)
          res.end(body)
        })
      })
    },
  }
}

/**
 * Vite `server.proxy` map — session/login + staff API only.
 * Do not add a broad SPA catch-all.
 */
export function createDevProxy(target = resolveDevProxyTarget()): Record<
  string,
  ProxyOptions
> {
  const passthrough = createPassthroughProxy(target)
  return {
    '/login': createLoginProxy(target),
    '/logout': passthrough,
    '/sanctum': passthrough,
    '/social-automation/api': passthrough,
    '/social-automation/script-media': passthrough,
  }
}
