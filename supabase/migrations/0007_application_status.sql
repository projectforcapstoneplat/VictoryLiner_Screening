-- Victory Liner Careers — Phase 4 schema: candidate decision workflow
-- Run this once in the Supabase SQL editor, after 0006_interview.sql.
--
-- applications.status already existed (default 'submitted', no constraint) but
-- nothing ever wrote to it — HR had no update policy at all. This adds the
-- 'advanced'/'declined' decision the paper assigns to HR Personnel ("Advances
-- or declines candidates based on system-generated results") and the RLS
-- policy that lets them actually set it.

alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('submitted', 'advanced', 'declined'));

drop policy if exists "applications_update_hr" on public.applications;
create policy "applications_update_hr" on public.applications
  for update using (public.is_hr()) with check (public.is_hr());
