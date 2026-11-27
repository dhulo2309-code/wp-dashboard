import { admin, getUser, log } from './_lib/auth.js'
import { enc } from './_lib/crypto.js'
export default async function handler(req, res) {
  const u = await getUser(req); if (!u) return res.status(401).end('Login + 2-step verification required')
  const s = admin(), b = req.body || {}
  try {
    if (b.op === 'add') {
      if (!/^https?:\/\//i.test(b.url || '') || !b.name) return res.status(400).end('Name and a valid URL are required')
      const { error } = await s.from('sites').insert({ name: b.name, url: b.url.replace(/\/$/, ''), wp_key: b.wp_key ? enc(b.wp_key.trim()) : null })
      if (error) return res.status(400).end(error.message)
      await log(u, 'site_added', b.url); return res.json({ ok: true })
    }
    if (b.op === 'delete') {
      const { data } = await s.from('sites').select('url').eq('id', b.id).single()
      await s.from('sites').delete().eq('id', b.id); await log(u, 'site_deleted', data?.url || b.id); return res.json({ ok: true })
    }
    res.status(400).end('Bad op')
  } catch (e) { res.status(500).end(String(e.message || e)) }
}
