-- Victory Liner Careers — standalone applicant resume, independent of any
-- one job posting. Until now a resume only ever existed as a row on
-- `applications` (job_id not null) — this is Phase 1 of the "resume-first"
-- flow: fill it once right after signup, then get matched against every
-- open job, instead of re-entering the same info per job applied to.
-- Run once in the Supabase SQL editor, after 0020_interview_question_count.sql.

create table if not exists public.applicant_resumes (
  applicant_id uuid primary key references public.profiles(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  current_location text,
  work_experience jsonb not null default '[]'::jsonb,
  education_level text,
  education jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  certifications jsonb not null default '[]'::jsonb,
  summary text,
  drivers_license_type text,
  drivers_license_restrictions text[] not null default '{}',
  years_driving_experience integer,
  has_nbi_clearance boolean,
  willing_shifting_schedule boolean,
  has_medical_certificate boolean,
  updated_at timestamptz not null default now()
);

alter table public.applicant_resumes enable row level security;

drop policy if exists "applicant_resumes_own" on public.applicant_resumes;
create policy "applicant_resumes_own" on public.applicant_resumes
  for all using (applicant_id = auth.uid()) with check (applicant_id = auth.uid());

drop policy if exists "applicant_resumes_select_hr" on public.applicant_resumes;
create policy "applicant_resumes_select_hr" on public.applicant_resumes
  for select using (public.is_hr());
