-- Victory Liner Careers — makes the number of interview questions assigned
-- per applicant configurable (was a hardcoded constant, QUESTIONS_PER_APPLICANT
-- in src/lib/interview.js) — some roles may warrant more or fewer than 3.
-- Lives on the existing screening_settings singleton table alongside the
-- resume-match minimum, rather than a new table for one more system-wide
-- HR Head setting.
-- Run once in the Supabase SQL editor, after 0019_job_categories.sql.

alter table public.screening_settings
  add column if not exists interview_question_count int not null default 3
  check (interview_question_count between 1 and 10);
