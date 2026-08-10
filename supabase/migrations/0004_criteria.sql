-- Victory Liner Careers — Phase 3 schema: screening criteria
-- HR-defined keywords/weights per job posting, consumed by the upcoming NLP
-- resume-analysis stage to score applicants against job requirements.
-- Run this once in the Supabase SQL editor, after 0003_structured_resume.sql.

create table if not exists public.criteria (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings(id) on delete cascade,
  keyword text not null,
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table public.criteria enable row level security;

-- Criteria are an internal HR authoring/scoring detail, not shown to applicants.
drop policy if exists "criteria_select_hr" on public.criteria;
create policy "criteria_select_hr" on public.criteria
  for select using (public.is_hr());

drop policy if exists "criteria_insert_hr" on public.criteria;
create policy "criteria_insert_hr" on public.criteria
  for insert with check (public.is_hr());

drop policy if exists "criteria_update_hr" on public.criteria;
create policy "criteria_update_hr" on public.criteria
  for update using (public.is_hr()) with check (public.is_hr());

drop policy if exists "criteria_delete_hr" on public.criteria;
create policy "criteria_delete_hr" on public.criteria
  for delete using (public.is_hr());