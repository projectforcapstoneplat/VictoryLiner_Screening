-- Victory Liner Careers — auto-drafts a job posting the moment its open
-- positions are filled by an Advance decision, instead of it silently
-- staying live and publicly applicable after its hiring goal is already
-- met. open_positions itself is still just a soft target elsewhere in the
-- app (HR can advance past it, with a warning — see DecisionReviewModal in
-- HrApplicantsList.jsx), but the moment the target is actually *reached*,
-- that's worth surfacing automatically rather than relying on HR to notice
-- the "X of Y filled" counter and remember to close the posting themselves.
--
-- Runs as a trigger, not client-side logic, so it fires no matter which
-- code path performs the advance (today's single Decide action, any future
-- bulk-advance, anything) instead of needing every call site to remember to
-- check this. SECURITY DEFINER means it isn't blocked by whatever RLS the
-- calling HR Personnel session has on job_postings — they already have read
-- access (job_postings_select_hr) but this keeps the write path independent
-- of that regardless.
create or replace function public.auto_draft_job_if_filled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_open_positions integer;
  current_job_status text;
  advanced_count integer;
begin
  if new.status <> 'advanced' or old.status is not distinct from new.status then
    return new;
  end if;

  select open_positions, status into target_open_positions, current_job_status
  from public.job_postings where id = new.job_id;

  -- No target set, or already not published (already drafted/closed by this
  -- same mechanism or manually by HR) — nothing to do.
  if target_open_positions is null or target_open_positions <= 0 then
    return new;
  end if;
  if current_job_status is distinct from 'published' then
    return new;
  end if;

  select count(*) into advanced_count
  from public.applications
  where job_id = new.job_id and status = 'advanced';

  if advanced_count >= target_open_positions then
    update public.job_postings set status = 'draft' where id = new.job_id;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_auto_draft_job_on_advance on public.applications;
create trigger applications_auto_draft_job_on_advance
  after update of status on public.applications
  for each row
  when (new.status = 'advanced' and old.status is distinct from 'advanced')
  execute function public.auto_draft_job_if_filled();
