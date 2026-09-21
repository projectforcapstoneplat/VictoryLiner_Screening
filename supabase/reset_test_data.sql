-- Victory Liner Careers — wipes all job posting and applicant test data for
-- a clean slate ahead of real public testing. Run once in the Supabase SQL
-- editor. Pair with seed_sample_jobs.sql afterward if you want fresh sample
-- postings back.
--
-- KEEPS: HR Personnel/HR Head accounts and logins — their job/decision
-- history is cleared as a side effect of deleting every job posting and
-- application below, not by touching their profiles or auth.users rows.
-- Also keeps the interview question bank, job_categories, and
-- screening_settings — none of that is "test data," it's real
-- configuration you'd have to rebuild by hand otherwise.
--
-- REMOVES, completely (including logins, not just table rows): every job
-- posting, every application and everything that hangs off one (resume
-- evaluations, interview responses/evaluations, decision log, notes), every
-- applicant account (profile AND login), and AI rate-limit history.
--
-- NOT covered here: uploaded resume/video files in storage. Supabase blocks
-- raw SQL deletes against storage.objects outright (a platform-level
-- trigger — storage.protect_delete() — not something in this app's own
-- schema, there to stop metadata rows and actual blobs from drifting out of
-- sync): "Direct deletion from storage tables is not allowed. Use the
-- Storage API instead." Clear those from the Dashboard instead: Storage ->
-- resumes / resume-uploads / interview-videos -> select all -> Delete. That
-- goes through the real Storage API, so the underlying files actually go
-- with it, not just their listing.
--
-- Order matters: applications.job_id and applications.applicant_id are NOT
-- cascading deletes, so applications has to go first, or the deletes below
-- will fail with a foreign-key violation. Everything else cascades
-- automatically once its parent is gone (criteria, resume_job_matches,
-- applicant_resumes, applicant_notifications, interview_responses/
-- evaluations, decision log, notes — see each table's migration for the
-- exact "on delete cascade" it relies on here).
--
-- Wrapped in a transaction — if anything fails partway, nothing commits.
-- Run the first SELECT alone first if you want to sanity-check the numbers
-- before trusting the COMMIT at the bottom.

begin;

-- Snapshot before deleting anything.
select
  (select count(*) from public.job_postings) as job_postings,
  (select count(*) from public.applications) as applications,
  (select count(*) from public.profiles where role = 'applicant') as applicant_accounts;

-- 1. Applications first — cascades to resume_evaluations, interview_responses
--    (and interview_evaluations off those), application_decision_log,
--    application_notes.
delete from public.applications;

-- 2. Job postings — cascades to criteria and any remaining resume_job_matches
--    tied to a job. This is what actually clears HR's "created" job history,
--    without touching either HR account at all.
delete from public.job_postings;

-- 3. Applicant accounts, entirely — deleting from auth.users (not just
--    public.profiles) so the login itself is gone too, and the email can be
--    reused for a fresh signup. Cascades down to public.profiles,
--    applicant_resumes, any remaining resume_job_matches, and
--    applicant_notifications automatically. HR accounts (role != 'applicant')
--    are never touched by this.
delete from auth.users
where id in (select id from public.profiles where role = 'applicant');

-- 4. AI rate-limit history — pure bookkeeping (resets everyone's throttle
--    counters to zero), safe to always clear.
delete from public.ai_rate_limits;

-- Final counts — should all read 0.
select
  (select count(*) from public.job_postings) as job_postings_remaining,
  (select count(*) from public.applications) as applications_remaining,
  (select count(*) from public.profiles where role = 'applicant') as applicant_accounts_remaining;

commit;
