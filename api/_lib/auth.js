import { createClient } from '@supabase/supabase-js'
export const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
export async function getUser(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '')
  const { data } = await admin().auth.getUser(t)
  return data?.user || null
}
