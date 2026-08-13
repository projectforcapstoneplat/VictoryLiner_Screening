-- Victory Liner Careers — system-wide screening settings. Currently just the
-- minimum AI resume-match score an applicant needs before the video
-- interview unlocks for them; HR Head can change it from the dashboard.
-- Single-row table (id is always 1) rather than a generic key/value store,
-- since there's exactly one setting so far and this keeps the read/write
-- code trivial — add columns here if more settings show up later.
-- Run once in the Supabase SQL editor, after 0013_application_decision_log.sql.

create table if not exists public.screening_settings (
  id int primary key default 1,
  min_resume_match_percent int not null default 50 check (min_resume_match_percent between 0 and 100),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint screening_settings_singleton check (id = 1)
);

insert into public.screening_settings (id) values (1) on conflict (id) do nothing;

alter table public.screening_settings enable row level security;

-- Both applicants (to know whether they've unlocked the interview) and HR
-- need to read this — anyone signed in.
drop policy if exists "screening_settings_select_authenticated" on public.screening_settings;
create policy "screening_settings_select_authenticated" on public.screening_settings
  for select using (auth.uid() is not null);

drop policy if exists "screening_settings_update_hr_head" on public.screening_settings;
create policy "screening_settings_update_hr_head" on public.screening_settings
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'hr_head')
  );
