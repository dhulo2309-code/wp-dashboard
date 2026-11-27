-- Run AFTER you have logged in once and set up 2-step login (MFA) in the dashboard.
create table if not exists activity_log (
  id bigserial primary key, at timestamptz default now(),
  user_email text, action text, detail text
);
alter table activity_log enable row level security;
drop policy if exists "owner sites" on sites;
drop policy if exists "owner checks" on checks;
drop policy if exists "sites read aal2" on sites;
drop policy if exists "checks read aal2" on checks;
drop policy if exists "log read aal2" on activity_log;
-- browser can only READ, and only after 2-step verification. All writes go through the server.
create policy "sites read aal2" on sites for select to authenticated using ((select auth.jwt()->>'aal') = 'aal2');
create policy "checks read aal2" on checks for select to authenticated using ((select auth.jwt()->>'aal') = 'aal2');
create policy "log read aal2" on activity_log for select to authenticated using ((select auth.jwt()->>'aal') = 'aal2');
