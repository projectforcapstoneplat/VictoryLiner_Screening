-- Victory Liner Careers — wipes all applicant/job test data for a clean
-- slate before testing the new Decisions/scheduling flow on a fresh
-- deploy. Run once in the Supabase SQL editor.
--
-- KEEPS: HR Personnel/HR Head accounts, the interview question bank,
-- job_categories, and screening_settings — none of that is "test data,"
-- it's real configuration you'd have to rebuild by hand otherwise.
--
-- REMOVES: every job posting, every application and everything that hangs
-- off one (resume evaluations, interview responses/evaluations, decision
-- log, notes), every applicant profile, and AI rate-limit history.
--
-- Order matters: applications.job_id and applications.applicant_id are NOT
-- cascading deletes, so applications has to go first, or the deletes below
-- will fail with a foreign-key violation. Everything else cascades
-- automatically once its parent is gone (criteria, resume_job_matches,
-- applicant_resumes, applicant_notifications, interview_responses/
-- evaluations, decision log, notes — see each table's migration for the
-- exact "on delete cascade" it relies on here).

-- 1. Applications first — cascades to resume_evaluations, interview_responses
--    (and interview_evaluations off those), application_decision_log,
--    application_notes.
delete from public.applications;

-- 2. Job postings — cascades to criteria and any remaining resume_job_matches
--    tied to a job.
delete from public.job_postings;

-- 3. Applicant profiles — cascades to applicant_resumes, any remaining
--    resume_job_matches, and applicant_notifications.
--    NOTE: this removes the *profile* row only, not the actual login
--    account. To fully remove a test applicant (so the email/password can
--    be reused), also delete them from Authentication -> Users in the
--    Supabase dashboard, or via the Admin API — deleting there cascades
--    down to profiles automatically too, so you can run this step via
--    either path (just don't do both out of order: delete applications and
--    job_postings first regardless of which path you pick for the accounts
--    themselves).
delete from public.profiles where role = 'applicant';

-- 4. AI rate-limit history — pure bookkeeping, safe to always clear. Left
--    for last since it cascades from auth.users on its own regardless of
--    what happened above.
delete from public.ai_rate_limits;

-- Not covered by this script — do these separately:
--
-- * Storage files: Dashboard -> Storage -> "resumes" and "interview-videos"
--   buckets -> select all -> delete. Postgres DELETEs above only remove
--   table rows, never the actual uploaded files.
--
-- * Applicant login accounts: Dashboard -> Authentication -> Users -> select
--   the test applicant accounts -> delete. (HR/Head accounts aren't touched
--   by anything above — leave them.)
