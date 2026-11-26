alter table checks
  add column if not exists ttfb_ms int,
  add column if not exists domain_expires timestamptz,
  add column if not exists broken_links int,
  add column if not exists seo jsonb,
  add column if not exists security jsonb,
  add column if not exists wp_extra jsonb;
drop view if exists latest_checks;
create view latest_checks with (security_invoker = true) as
  select distinct on (site_id) * from checks order by site_id, checked_at desc;
