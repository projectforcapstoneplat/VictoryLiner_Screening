-- Interview question bank management (create/edit/delete) is now HR Head
-- only — HR Personnel keeps read access (they still need question text
-- alongside applicant responses in the Applicants/Decisions workflow, see
-- HrApplicantsList.jsx), but can no longer write to it, matching the
-- Interview Questions tab now being hidden from their sidebar entirely.
drop policy if exists "interview_questions_insert_hr" on public.interview_questions;
create policy "interview_questions_insert_hr_head" on public.interview_questions
  for insert with check (public.is_hr_head());

drop policy if exists "interview_questions_update_hr" on public.interview_questions;
create policy "interview_questions_update_hr_head" on public.interview_questions
  for update using (public.is_hr_head()) with check (public.is_hr_head());

drop policy if exists "interview_questions_delete_hr" on public.interview_questions;
create policy "interview_questions_delete_hr_head" on public.interview_questions
  for delete using (public.is_hr_head());
