-- Victory Liner Careers — adds a short, ungraded "introduce yourself" clip
-- recorded before the real interview questions. Lives as its own column on
-- applications, not a row in interview_responses, so it structurally can't
-- feed the AI scoring pipeline (evaluateResponse / match-resume-to-jobs /
-- the interview_evaluations table all only ever read interview_responses) —
-- it's a warm-up + a face/voice for HR during review, never a graded answer.
alter table public.applications
  add column if not exists intro_video_path text;

-- Applicants have no general UPDATE policy on applications (HR owns that
-- table, see applications_update_hr in 0007_application_status.sql) — a
-- plain RLS policy opening the whole row to the applicant would also let
-- them rewrite status, scores, etc. via a direct REST call. This function
-- only ever touches intro_video_path, and only for the caller's own
-- application, so it's safe to grant to every authenticated user.
create or replace function public.set_intro_video_path(p_application_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.applications
  set intro_video_path = p_path
  where id = p_application_id and applicant_id = auth.uid();
end;
$$;

grant execute on function public.set_intro_video_path(uuid, text) to authenticated;
