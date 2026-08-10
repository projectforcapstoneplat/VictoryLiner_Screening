-- Victory Liner Careers — Phase 3 schema: video interview evaluation
-- Run this once in the Supabase SQL editor, after 0005_resume_evaluations.sql.

-- ---------------------------------------------------------------------------
-- interview_questions — a category-scoped question bank (not per-job), so HR
-- Head authors questions once per category (e.g. "Driver", "Conductor") and
-- every job posting sharing that category draws from the same pool.
-- ---------------------------------------------------------------------------
create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question_text text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.interview_questions enable row level security;

drop policy if exists "interview_questions_select_hr" on public.interview_questions;
create policy "interview_questions_select_hr" on public.interview_questions
  for select using (public.is_hr());

drop policy if exists "interview_questions_insert_hr" on public.interview_questions;
create policy "interview_questions_insert_hr" on public.interview_questions
  for insert with check (public.is_hr());

drop policy if exists "interview_questions_update_hr" on public.interview_questions;
create policy "interview_questions_update_hr" on public.interview_questions
  for update using (public.is_hr()) with check (public.is_hr());

drop policy if exists "interview_questions_delete_hr" on public.interview_questions;
create policy "interview_questions_delete_hr" on public.interview_questions
  for delete using (public.is_hr());

-- Applicants may only see questions in a category they actually have a job
-- application in — not the whole bank.
drop policy if exists "interview_questions_select_applicant" on public.interview_questions;
create policy "interview_questions_select_applicant" on public.interview_questions
  for select using (
    exists (
      select 1 from public.applications a
      join public.job_postings j on j.id = a.job_id
      where a.applicant_id = auth.uid()
        and lower(trim(j.category)) = lower(trim(interview_questions.category))
    )
  );

-- ---------------------------------------------------------------------------
-- interview_responses — one row per (application, assigned question). Created
-- by the applicant's own client when they first open the interview screen
-- (category-matched questions picked client-side, see src/lib/interview.js),
-- then updated with a video_path once they record/upload an answer.
-- ---------------------------------------------------------------------------
create table if not exists public.interview_responses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  question_id uuid not null references public.interview_questions(id),
  video_path text,
  status text not null default 'pending' check (status in ('pending', 'recorded')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (application_id, question_id)
);

alter table public.interview_responses enable row level security;

drop policy if exists "interview_responses_select_own" on public.interview_responses;
create policy "interview_responses_select_own" on public.interview_responses
  for select using (
    exists (select 1 from public.applications a where a.id = interview_responses.application_id and a.applicant_id = auth.uid())
  );

-- Insert also re-checks that the question's category matches the applied
-- job's category, so an applicant can't assign themselves an arbitrary
-- question_id outside what interview_questions_select_applicant exposes them to.
drop policy if exists "interview_responses_insert_own" on public.interview_responses;
create policy "interview_responses_insert_own" on public.interview_responses
  for insert with check (
    exists (
      select 1 from public.applications a
      join public.job_postings j on j.id = a.job_id
      join public.interview_questions q on q.id = interview_responses.question_id
      where a.id = interview_responses.application_id
        and a.applicant_id = auth.uid()
        and lower(trim(j.category)) = lower(trim(q.category))
    )
  );

drop policy if exists "interview_responses_update_own" on public.interview_responses;
create policy "interview_responses_update_own" on public.interview_responses
  for update using (
    exists (select 1 from public.applications a where a.id = interview_responses.application_id and a.applicant_id = auth.uid())
  )
  with check (
    exists (select 1 from public.applications a where a.id = interview_responses.application_id and a.applicant_id = auth.uid())
  );

drop policy if exists "interview_responses_select_hr" on public.interview_responses;
create policy "interview_responses_select_hr" on public.interview_responses
  for select using (public.is_hr());

-- ---------------------------------------------------------------------------
-- interview_evaluations — AI output per response (transcript, sentiment,
-- relevance, overall score, explanation). Written only by evaluate-interview-
-- response using the calling HR user's own JWT, same trust model as
-- resume_evaluations: applicants never write or read this table directly.
-- ---------------------------------------------------------------------------
create table if not exists public.interview_evaluations (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.interview_responses(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  transcript text not null default '',
  sentiment_label text not null default 'neutral' check (sentiment_label in ('positive', 'neutral', 'negative')),
  sentiment_score integer not null default 0 check (sentiment_score between 0 and 100),
  relevance_score integer not null default 0 check (relevance_score between 0 and 100),
  evaluation_score integer not null check (evaluation_score between 0 and 100),
  explanation text not null default '',
  model text not null,
  evaluated_at timestamptz not null default now(),
  unique (response_id)
);

alter table public.interview_evaluations enable row level security;

drop policy if exists "interview_evaluations_select_hr" on public.interview_evaluations;
create policy "interview_evaluations_select_hr" on public.interview_evaluations
  for select using (public.is_hr());

drop policy if exists "interview_evaluations_insert_hr" on public.interview_evaluations;
create policy "interview_evaluations_insert_hr" on public.interview_evaluations
  for insert with check (public.is_hr());

drop policy if exists "interview_evaluations_update_hr" on public.interview_evaluations;
create policy "interview_evaluations_update_hr" on public.interview_evaluations
  for update using (public.is_hr()) with check (public.is_hr());

-- ---------------------------------------------------------------------------
-- interview-videos storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('interview-videos', 'interview-videos', false)
on conflict (id) do nothing;

-- Paths are stored as `${applicant_id}/${application_id}/${question_id}.webm`
-- so an applicant's own uid is always the first path segment.
drop policy if exists "interview_videos_insert_own" on storage.objects;
create policy "interview_videos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'interview-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "interview_videos_select_own" on storage.objects;
create policy "interview_videos_select_own" on storage.objects
  for select using (
    bucket_id = 'interview-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "interview_videos_select_hr" on storage.objects;
create policy "interview_videos_select_hr" on storage.objects
  for select using (
    bucket_id = 'interview-videos'
    and public.is_hr()
  );
