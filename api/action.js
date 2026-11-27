import { admin, getUser, log } from './_lib/auth.js'
import { dec } from './_lib/crypto.js'
export default async function handler(req, res) {
  const u = await getUser(req); if (!u) return res.status(401).end('Login + 2-step verification required')
  const { site_id, action } = req.body || {}
  if (!['clear_cache', 'cleanup_db'].includes(action)) return res.status(400).end('Bad action')
  const { data } = await admin().from('sites').select('url,wp_key').eq('id', site_id).single()
  const key = dec(data?.wp_key)
  if (!key) return res.status(400).end('No WP key')
  const r = await fetch(`${data.url}/wp-json/wpdash/v1/action`, { method: 'POST',
    headers: { 'x-wpdash-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ action }) })
  await log(u, action, `${data.url} (${r.ok ? 'ok' : 'failed ' + r.status})`)
  res.status(r.ok ? 200 : 502).json({ ok: r.ok })
}
