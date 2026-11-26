import { admin, getUser } from './_lib/auth.js'
export default async function handler(req, res) {
  if (!(await getUser(req))) return res.status(401).end('Login required')
  const { site_id, action } = req.body
  if (!['clear_cache', 'cleanup_db'].includes(action)) return res.status(400).end('Bad action')
  const { data } = await admin().from('sites').select('url,wp_key').eq('id', site_id).single()
  if (!data?.wp_key) return res.status(400).end('No WP key')
  const r = await fetch(`${data.url}/wp-json/wpdash/v1/action`, { method: 'POST',
    headers: { 'x-wpdash-key': data.wp_key, 'content-type': 'application/json' }, body: JSON.stringify({ action }) })
  res.status(r.ok ? 200 : 502).json({ ok: r.ok })
}
