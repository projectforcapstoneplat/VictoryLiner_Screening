-- Victory Liner Careers — caches AI match scores between a standalone
-- resume (applicant_resumes, see 0021) and every published job, so the
-- "which jobs suit me" screen doesn't re-run the AI on every visit. Run once
-- in the Supabase SQL editor, after 0021_applicant_resumes.sql.

create table if not exists public.resume_job_matches (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.job_postings(id) on delete cascade,
  score integer not null,
  explanation text,
  model text,
  matched_at timestamptz not null default now(),
  unique (applicant_id, job_id)
);

alter table public.resume_job_matches enable row level security;

drop policy if exists "resume_job_matches_own" on public.resume_job_matches;
create policy "resume_job_matches_own" on public.resume_job_matches
  for all using (applicant_id = auth.uid()) with check (applicant_id = auth.uid());

drop policy if exists "resume_job_matches_select_hr" on public.resume_job_matches;
create policy "resume_job_matches_select_hr" on public.resume_job_matches
  for select using (public.is_hr());
