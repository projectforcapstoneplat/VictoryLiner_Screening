-- Victory Liner Careers — adds the criteria breakdown to cached resume
-- matches (mirrors resume_evaluations.criteria_assessment) so a quick-apply
-- can copy a full, HR-quality evaluation instead of a bare score. Run once
-- in the Supabase SQL editor, after 0023_resume_draft_progress.sql.

alter table public.resume_job_matches add column if not exists criteria_assessment jsonb not null default '[]'::jsonb;
