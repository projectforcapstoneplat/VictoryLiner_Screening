-- Victory Liner Careers — marks that the "your interview is tomorrow"
-- reminder has already gone out for a scheduled personal interview, so the
-- cron-driven reminder function (send-schedule-reminders) never double-sends.
-- Run once in the Supabase SQL editor, after 0031_interview_question_text_snapshot.sql.

alter table public.applications add column if not exists scheduled_interview_reminder_sent_at timestamptz;
