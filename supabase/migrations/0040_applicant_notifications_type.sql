-- Victory Liner Careers — distinguishes what an in-app notification is about,
-- so the bell can route a click to the right screen. Until now every row was
-- implicitly a "new job matches you" notification (match-job-to-resumes was
-- the only writer) and the bell always navigated to 'matches'. send-status-
-- email is about to become a second writer (an application's status changed
-- to interview_stage/advanced/declined) — that needs to land on
-- 'my-applications' instead, since there's no job to look at, there's an
-- application to check on. Defaulting existing/untyped rows to 'job_match'
-- keeps every notification already sent behaving exactly as it did before
-- this column existed. Run once in the Supabase SQL editor, after
-- 0039_applicant_resumes_no_work_experience.sql.

alter table public.applicant_notifications add column if not exists type text not null default 'job_match';
