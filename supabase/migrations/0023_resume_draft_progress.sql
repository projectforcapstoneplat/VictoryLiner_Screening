-- Victory Liner Careers — lets ResumeForm.jsx autosave progress on every
-- step instead of only on final submit, so an applicant who stops partway
-- through resumes at the same step with what they'd already typed, instead
-- of starting over. `completed_at` distinguishes a real finished resume
-- (drives App.jsx's resume-first gate, matching, etc.) from an in-progress
-- draft — a row existing is no longer enough on its own. Run once in the
-- Supabase SQL editor, after 0022_resume_job_matches.sql.

alter table public.applicant_resumes add column if not exists completed_at timestamptz;
alter table public.applicant_resumes add column if not exists last_step integer not null default 0;

-- Anyone who already has a resume row from before this migration existed is
-- by definition someone who finished the (then single-page, no-draft-concept)
-- form — backfill them as completed so they don't get bounced back into
-- ResumeForm as if they were mid-draft.
update public.applicant_resumes set completed_at = updated_at where completed_at is null;
