-- Victory Liner Careers — caps how many times an applicant can (re-)record a
-- single interview answer. Tracked server-side (not just in React state) so
-- the limit survives a page reload instead of being trivially reset by one.
-- Run once in the Supabase SQL editor, after 0009_application_profile_fields.sql.

alter table public.interview_responses add column if not exists attempt_count integer not null default 0;
