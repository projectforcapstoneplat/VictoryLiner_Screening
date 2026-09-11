-- Victory Liner Careers — closes two gaps found in the video interview
-- attempt-limit flow. Run once in the Supabase SQL editor, after
-- 0027_interview_video_update_policy.sql.

-- 1. HR previously had no way to update interview_responses at all (only
--    select_hr existed) — needed so HR can reset attempt_count for an
--    applicant who burned all 3 attempts without ever successfully
--    submitting a take (Interview.jsx has no recovery path of its own for
--    that; attempts are consumed the moment recording starts, not on
--    submit, so a closed tab / crash mid-take can strand them at 0 left).
drop policy if exists "interview_responses_update_hr" on public.interview_responses;
create policy "interview_responses_update_hr" on public.interview_responses
  for update using (public.is_hr()) with check (public.is_hr());

-- 2. recordAttempt (src/lib/interview.js) writes attempt_count from a
--    value computed entirely client-side, and interview_responses_update_own
--    only ever checked application ownership — nothing stopped an applicant
--    from calling supabase.from('interview_responses').update({attempt_count: 0})
--    directly to reset their own limit and re-record indefinitely. This
--    trigger requires any non-HR change to attempt_count to be exactly
--    +1 from its previous value (what recordAttempt always does), while
--    still letting HR set it to whatever they want (the reset above).
create or replace function public.enforce_interview_attempt_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_hr() then
    return new;
  end if;
  if new.attempt_count <> old.attempt_count + 1 then
    raise exception 'attempt_count can only be incremented by one at a time';
  end if;
  return new;
end;
$$;

drop trigger if exists interview_responses_attempt_guard on public.interview_responses;
create trigger interview_responses_attempt_guard
  before update of attempt_count on public.interview_responses
  for each row
  when (new.attempt_count is distinct from old.attempt_count)
  execute function public.enforce_interview_attempt_count();
