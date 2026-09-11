-- Victory Liner Careers — in-website notifications for applicants (starting
-- with "a new job matches you"), alongside the email match-job-to-resumes
-- already sends. Run once in the Supabase SQL editor, after
-- 0025_interview_deadline_and_scheduling.sql.

create table if not exists public.applicant_notifications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.job_postings(id) on delete set null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.applicant_notifications enable row level security;

-- Applicants can read and mark their own notifications read — but never
-- insert one themselves. These are system-generated only (written by
-- match-job-to-resumes using the service-role client, same reasoning as
-- resume_evaluations/resume_job_matches writes on another user's behalf),
-- so there's deliberately no insert/delete policy here at all.
drop policy if exists "applicant_notifications_select_own" on public.applicant_notifications;
create policy "applicant_notifications_select_own" on public.applicant_notifications
  for select using (applicant_id = auth.uid());

drop policy if exists "applicant_notifications_update_own" on public.applicant_notifications;
create policy "applicant_notifications_update_own" on public.applicant_notifications
  for update using (applicant_id = auth.uid()) with check (applicant_id = auth.uid());
