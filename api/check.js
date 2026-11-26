import { admin, getUser } from './_lib/auth.js'
import { checkSite } from './_lib/checks.js'
export default async function handler(req, res) {
  if (!(await getUser(req))) return res.status(401).end('Login required')
  const s = admin(); const { data } = await s.from('sites').select('id,url,wp_key').eq('id', req.body.site_id).single()
  if (!data) return res.status(404).end()
  await s.from('checks').insert(await checkSite(data))
  res.json({ ok: true })
}
