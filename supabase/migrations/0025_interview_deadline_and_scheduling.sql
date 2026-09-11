-- Victory Liner Careers — adds a 3-day video-screening deadline (with a
-- 1-day-remaining automated reminder email) and HR's ability to schedule a
-- personal interview once an applicant has advanced. Run once in the
-- Supabase SQL editor, after 0024_match_criteria_and_quick_apply.sql.

-- Set the moment an application enters interview_stage — either by
-- quick-apply auto-advancing a qualifying applicant, or by HR manually
-- advancing one later. This is the deadline clock's start; it can't be
-- derived from application_decision_log alone since quick-apply's
-- auto-advance never writes a log row (there's no HR decision to log).
alter table public.applications add column if not exists interview_stage_at timestamptz;

-- Backfill existing interview_stage/advanced/declined applications: prefer
-- the earliest logged "interview_stage" decision (HR's manual advance),
-- falling back to created_at (covers rows fast-tracked by quick-apply,
-- which never logged one) — best-effort, only matters for continuity of
-- already-in-flight applications at the time this migration runs.
update public.applications a
set interview_stage_at = coalesce(
  (
    select min(d.decided_at)
    from public.application_decision_log d
    where d.application_id = a.id and d.status = 'interview_stage'
  ),
  a.created_at
)
where a.status in ('interview_stage', 'advanced', 'declined')
  and a.interview_stage_at is null;

-- Marks that the "1 day left" reminder has already gone out for this
-- application, so the cron-driven reminder function never double-sends.
alter table public.applications add column if not exists interview_deadline_reminder_sent_at timestamptz;

-- HR's personal-interview scheduling — set once an applicant is advanced
-- and HR picks a date/time. `_by`/`_at` are a lightweight audit trail
-- (who scheduled it, when), separate from the interview's own date/time.
alter table public.applications add column if not exists scheduled_interview_at timestamptz;
alter table public.applications add column if not exists scheduled_interview_location text;
alter table public.applications add column if not exists scheduled_interview_notes text;
alter table public.applications add column if not exists scheduled_interview_set_by uuid references public.profiles(id);
alter table public.applications add column if not exists scheduled_interview_set_at timestamptz;
