/** Proxies WhatsApp/integration API via novat.app (avoids direct onrender.com in browser/CSP). */
const UPSTREAM = 'https://nova-server-rpbi.onrender.com'

export default async function handler(
  req: { method?: string; query: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined>; body?: unknown },
  res: { status: (code: number) => { setHeader: (k: string, v: string) => void; send: (body: string) => void; json: (body: unknown) => void } }
) {
  const pathParts = req.query.path
  const segments = Array.isArray(pathParts) ? pathParts : pathParts ? [pathParts] : []
  const upstreamUrl = new URL(`/api/${segments.join('/')}`, UPSTREAM)

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path' || value == null) continue
    if (Array.isArray(value)) value.forEach((v) => upstreamUrl.searchParams.append(key, v))
    else upstreamUrl.searchParams.append(key, value)
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  const auth = req.headers.authorization
  if (typeof auth === 'string') headers.Authorization = auth
  const ct = req.headers['content-type']
  if (typeof ct === 'string') headers['Content-Type'] = ct

  const init: RequestInit = { method: req.method ?? 'GET', headers }
  if (req.method && !['GET', 'HEAD'].includes(req.method) && req.body != null) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  }

  try {
    const upstream = await fetch(upstreamUrl.toString(), init)
    const text = await upstream.text()
    const response = res.status(upstream.status)
    response.setHeader('Cache-Control', 'no-store')
    const upstreamCt = upstream.headers.get('content-type')
    if (upstreamCt) response.setHeader('Content-Type', upstreamCt)
    response.send(text)
  } catch {
    res.status(502).json({ error: 'Integration service temporarily unavailable' })
  }
}
