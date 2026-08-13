-- Victory Liner Careers — lets HR "reopen" an application they advanced or
-- declined by mistake, resetting it back to 'submitted' for reconsideration
-- from scratch (not a precise history replay back to whichever stage it was
-- at before — simpler and more predictable). Logged as a real decision-log
-- entry for accountability, so 'submitted' needs to become a valid status
-- value there too, not just interview_stage/advanced/declined.
-- Run once in the Supabase SQL editor, after 0017_application_notes.sql.

alter table public.application_decision_log drop constraint if exists application_decision_log_status_check;
alter table public.application_decision_log add constraint application_decision_log_status_check
  check (status in ('submitted', 'interview_stage', 'advanced', 'declined'));
