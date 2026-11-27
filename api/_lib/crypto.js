import crypto from 'node:crypto'
const k = () => {
  if (!process.env.KEY_ENC_SECRET) throw new Error('KEY_ENC_SECRET is not set on the server')
  return crypto.createHash('sha256').update(process.env.KEY_ENC_SECRET).digest()
}
export const enc = v => {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k(), iv)
  const d = Buffer.concat([c.update(v, 'utf8'), c.final()])
  return 'enc:v1:' + [iv, c.getAuthTag(), d].map(b => b.toString('base64')).join(':')
}
export const dec = v => {
  if (!v || !v.startsWith('enc:v1:')) return v
  try {
    const [iv, tag, d] = v.slice(7).split(':').map(x => Buffer.from(x, 'base64'))
    const c = crypto.createDecipheriv('aes-256-gcm', k(), iv); c.setAuthTag(tag)
    return Buffer.concat([c.update(d), c.final()]).toString('utf8')
  } catch { return null }
}
// old plain-text keys get encrypted the first time a site is checked
export const upgrade = async (s, site) => {
  if (site.wp_key && !site.wp_key.startsWith('enc:v1:') && process.env.KEY_ENC_SECRET)
    await s.from('sites').update({ wp_key: enc(site.wp_key) }).eq('id', site.id)
}
