-- Victory Liner Careers — splits the old single HR decision ("submitted" ->
-- advanced/declined) into two real stages: HR first reviews the resume and
-- either advances the applicant into interview_stage (unlocking the video
-- interview, alongside the existing AI resume-match gate — both are
-- required) or declines them outright; once the interview is complete, HR
-- reviews again and makes the actual final advanced/declined call.
-- Run once in the Supabase SQL editor, after 0014_screening_settings.sql.

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('submitted', 'interview_stage', 'advanced', 'declined'));

alter table public.application_decision_log drop constraint if exists application_decision_log_status_check;
alter table public.application_decision_log add constraint application_decision_log_status_check
  check (status in ('interview_stage', 'advanced', 'declined'));
