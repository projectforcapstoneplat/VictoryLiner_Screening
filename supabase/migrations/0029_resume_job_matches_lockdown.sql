-- Victory Liner Careers — closes a real vulnerability: an applicant's own
-- authenticated session could write directly to resume_job_matches (the
-- "for all" policy below covered insert/update too, not just select), and
-- quick-apply/match-resume-to-jobs both trust match.score unconditionally —
-- quick-apply even copies it into resume_evaluations (the HR-visible AI
-- assessment) via the service-role client. An applicant could set their own
-- score to 100 from the browser console and auto-skip straight to
-- interview_stage with a fabricated "AI match" HR would believe was real.
-- Run once in the Supabase SQL editor, after 0028_interview_attempt_guard.sql.

-- match-resume-to-jobs (supabase/functions/match-resume-to-jobs/index.ts) is
-- the only legitimate writer of new/updated rows here, and is updated
-- alongside this migration to write via the service-role client instead of
-- the caller's own JWT — same pattern match-job-to-resumes already used.
-- clearMyMatches (src/lib/resumeMatches.js) still runs client-side, but only
-- ever deletes the applicant's own rows (forcing a fresh, real re-score on
-- next visit) — never sets a value, so delete stays applicant-writable.
drop policy if exists "resume_job_matches_own" on public.resume_job_matches;

drop policy if exists "resume_job_matches_select_own" on public.resume_job_matches;
create policy "resume_job_matches_select_own" on public.resume_job_matches
  for select using (applicant_id = auth.uid());

drop policy if exists "resume_job_matches_delete_own" on public.resume_job_matches;
create policy "resume_job_matches_delete_own" on public.resume_job_matches
  for delete using (applicant_id = auth.uid());
