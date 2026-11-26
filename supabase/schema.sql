create table sites (
  id uuid primary key default gen_random_uuid(),
  name text not null, url text not null unique, wp_key text,
  created_at timestamptz default now()
);
create table checks (
  id bigserial primary key,
  site_id uuid references sites(id) on delete cascade,
  checked_at timestamptz default now(),
  up boolean, status_code int, response_ms int, ssl_expires timestamptz,
  perf_score int, lcp_s numeric, cls numeric, tbt_ms numeric,
  wp_version text, php_version text,
  updates_core int, updates_plugins int, updates_themes int,
  db_size_mb numeric, autoload_kb numeric, issues text[] default '{}'
);
create index on checks(site_id, checked_at desc);
create view latest_checks with (security_invoker = true) as
  select distinct on (site_id) * from checks order by site_id, checked_at desc;

alter table sites enable row level security;
alter table checks enable row level security;
create policy "owner sites" on sites for all to authenticated using (true) with check (true);
create policy "owner checks" on checks for select to authenticated using (true);
alter publication supabase_realtime add table checks;
-- Pachi: Authentication > Providers > Email ma "Allow new users to sign up" BAND karo,
-- ane Users ma potano ek user manually banavo.
