1. Supabase: SQL Editor ma supabase/schema.sql run karo. Authentication > Sign In/Up ma "Allow new users to sign up" OFF karo, Users ma tamaro ek user (email+password) banavo.
2. .env.example mujab Vercel env vars bharo (VITE_* browser mate anon key, SUPABASE_SERVICE_ROLE_KEY fakt server mate).
3. Local test: `npm i -g vercel` pachi `vercel dev` (api/ functions mate; plain `vite` ma api nahi chale).
4. GitHub -> Vercel import -> Deploy. Cron daily 02:00 UTC.
5. WP plugin: wp-connector/ install + wp-config.php ma define('WPDASH_KEY','...').
6. Je project pehla thi setup che to SQL Editor ma supabase/migration_v2.sql pan run karo (navi columns). Optional: email alerts mate RESEND_KEY ane ALERT_EMAIL env nakho.
