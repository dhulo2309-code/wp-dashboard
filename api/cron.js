import { admin, log } from './_lib/auth.js'
import { upgrade } from './_lib/crypto.js'
import { checkSite } from './_lib/checks.js'
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end('Unauthorized')
  const s = admin(); const { data: sites } = await s.from('sites').select('id,name,url,wp_key')
  const rows = await Promise.all((sites || []).map(async x => { await upgrade(s, x); return checkSite(x) }))
  if (rows.length) await s.from('checks').insert(rows)
  const name = id => sites.find(x => x.id === id)?.name
  const bad = rows.filter(r => !r.up || r.issues.some(i => /SSL|Domain|noindex/i.test(i)))
  if (bad.length && process.env.RESEND_KEY && process.env.ALERT_EMAIL)
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'WP Dashboard <onboarding@resend.dev>', to: process.env.ALERT_EMAIL, subject: `${bad.length} site(s) need attention`,
        text: bad.map(r => `${name(r.site_id)}: ${r.issues.join('; ')}`).join('\n') }) }).catch(() => {})
  await log({ email: 'cron' }, 'daily_check', `${rows.length} sites, ${bad.length} alerts`)
  res.json({ checked: rows.length, alerts: bad.length })
}
