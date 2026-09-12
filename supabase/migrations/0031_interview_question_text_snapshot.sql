-- Victory Liner Careers — snapshots each interview_responses row's question
-- text at the moment it's assigned to an applicant, instead of always
-- joining the live interview_questions.question_text. Without this, HR
-- editing a question's wording after applicants have already answered it
-- silently changes what every existing answer appears to be "about" —
-- everywhere that answer shows up (HR review, the AI evaluation prompt
-- itself) would display/judge it against wording the applicant never
-- actually saw.
--
-- Nullable, backfilled from the current live join for existing rows (best
-- effort — this is the only chance to capture "what it used to say" for
-- rows that predate this column; from here on every new row gets its own
-- permanent snapshot at insert time, see ensureAssignedResponses in
-- src/lib/interview.js).
-- Run once in the Supabase SQL editor, after 0030_resume_evaluations_delete_policy.sql.

alter table public.interview_responses add column if not exists question_text_snapshot text;

update public.interview_responses ir
set question_text_snapshot = iq.question_text
from public.interview_questions iq
where ir.question_id = iq.id and ir.question_text_snapshot is null;
