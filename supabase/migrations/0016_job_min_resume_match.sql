-- Victory Liner Careers — lets a job posting override the system-wide
-- minimum resume match (public.screening_settings) with its own value —
-- e.g. a technical role might reasonably want a higher bar than a general
-- one. Null means "use the global default" (see src/pages/MyApplications.jsx
-- and src/pages/HrApplicants.jsx, which both resolve job override -> global).
-- Run once in the Supabase SQL editor, after 0015_interview_stage_status.sql.

alter table public.job_postings
  add column if not exists min_resume_match_percent int
  check (min_resume_match_percent is null or min_resume_match_percent between 0 and 100);
