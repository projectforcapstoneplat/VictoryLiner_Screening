-- Victory Liner Careers — caches each interview question's Taglish
-- translation on the question bank row itself, shared across every
-- applicant who gets asked it, instead of re-translating on demand per
-- applicant per click (the old "Translate to Taglish" button, which made an
-- applicant wait on a live AI call mid-interview, eating into their timed
-- window). Written by the translate-question edge function via the
-- service-role client — applicants only ever read this column (RLS already
-- lets any signed-in user select interview_questions), never write it
-- directly (write access stays HR-head-only, see
-- 0038_interview_questions_hr_head_only.sql). Run once in the Supabase SQL
-- editor, after 0040_applicant_notifications_type.sql.

alter table public.interview_questions add column if not exists question_text_taglish text;
