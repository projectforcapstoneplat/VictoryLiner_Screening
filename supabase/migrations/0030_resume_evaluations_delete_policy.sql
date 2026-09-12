-- Victory Liner Careers — lets HR clear out resume_evaluations for a job,
-- needed so replaceCriteriaForJob (src/lib/criteria.js) can invalidate
-- every applicant's stale score the moment HR changes what a job's
-- screening criteria actually weighs. Previously there was no delete
-- policy on this table at all, so even HR's own client couldn't remove a
-- row — an applicant scored against the *old* criteria kept showing that
-- score forever, with nothing to indicate it no longer reflects what HR
-- is actually screening for.
-- Run once in the Supabase SQL editor, after 0029_resume_job_matches_lockdown.sql.

drop policy if exists "resume_evaluations_delete_hr" on public.resume_evaluations;
create policy "resume_evaluations_delete_hr" on public.resume_evaluations
  for delete using (public.is_hr());
