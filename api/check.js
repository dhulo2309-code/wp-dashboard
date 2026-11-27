import { admin, getUser, log } from './_lib/auth.js'
import { upgrade } from './_lib/crypto.js'
import { checkSite } from './_lib/checks.js'
export default async function handler(req, res) {
  const u = await getUser(req); if (!u) return res.status(401).end('Login + 2-step verification required')
  const s = admin(); const { data } = await s.from('sites').select('id,url,wp_key').eq('id', req.body?.site_id).single()
  if (!data) return res.status(404).end()
  await upgrade(s, data)
  await s.from('checks').insert(await checkSite(data))
  await log(u, 'check_now', data.url)
  res.json({ ok: true })
}
