import { createClient } from '@supabase/supabase-js'
export const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Valid login AND 2-step verification done (aal2)
export async function getUser(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '')
  const { data } = await admin().auth.getUser(t)
  if (!data?.user) return null
  try { if (JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).aal !== 'aal2') return null } catch { return null }
  return data.user
}
export const log = (u, action, detail = '') =>
  admin().from('activity_log').insert({ user_email: u.email, action, detail }).then(() => {}, () => {})
