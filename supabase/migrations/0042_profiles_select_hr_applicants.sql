-- Victory Liner Careers — grants HR read access to applicant profiles, so
-- "registered but never applied" accounts (a resume on file, no
-- applications row) can actually be queried and shown. Previously HR's own
-- client had no RLS path to `profiles` at all beyond their own row (or, for
-- HR Head, other HR Personnel profiles) — applicant name/email was always
-- read off the `applications` table's own snapshot instead (taken at
-- apply-time), which simply doesn't exist for someone who never applied to
-- anything.
-- Run once in the Supabase SQL editor, after 0041_interview_question_taglish_cache.sql.

drop policy if exists "profiles_select_hr_applicants" on public.profiles;
create policy "profiles_select_hr_applicants" on public.profiles
  for select using (is_hr() and role = 'applicant');
  