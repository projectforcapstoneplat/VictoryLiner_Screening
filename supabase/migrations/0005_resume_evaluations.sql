-- Victory Liner Careers — Phase 2 schema: AI resume evaluations
-- Stores the AI's per-applicant assessment against a job's screening criteria
-- (score, written explanation, per-criterion match reasoning), so the
-- Applicants view doesn't have to re-call the AI on every page visit.
-- Run this once in the Supabase SQL editor, after 0004_criteria.sql.

create table if not exists public.resume_evaluations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  job_id uuid not null references public.job_postings(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  explanation text not null,
  criteria_assessment jsonb not null default '[]',
  model text not null,
  evaluated_at timestamptz not null default now(),
  unique (application_id)
);

alter table public.resume_evaluations enable row level security;

-- Same access shape as criteria: internal HR scoring detail, not applicant-facing.
drop policy if exists "resume_evaluations_select_hr" on public.resume_evaluations;
create policy "resume_evaluations_select_hr" on public.resume_evaluations
  for select using (public.is_hr());

drop policy if exists "resume_evaluations_insert_hr" on public.resume_evaluations;
create policy "resume_evaluations_insert_hr" on public.resume_evaluations
  for insert with check (public.is_hr());

drop policy if exists "resume_evaluations_update_hr" on public.resume_evaluations;
create policy "resume_evaluations_update_hr" on public.resume_evaluations
  for update using (public.is_hr()) with check (public.is_hr());
