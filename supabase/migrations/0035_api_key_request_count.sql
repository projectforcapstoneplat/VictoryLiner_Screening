-- Adds a self-tracked "requests used today" counter to api_key_status (see
-- 0034_api_key_status.sql) for the Ctrl+Shift+G debug panel. This is NOT
-- Google's authoritative quota usage -- the Gemini API exposes no such
-- endpoint -- it's just a count of calls this app itself has sent through
-- each key, reset daily. Accurate as long as a key is only ever used by
-- this project (true for a dedicated free-tier key).
alter table api_key_status add column if not exists request_count_today integer not null default 0;
alter table api_key_status add column if not exists count_date date;

-- Atomic increment-with-daily-reset in one statement, so concurrent AI calls
-- (e.g. match-resume-to-jobs scoring several jobs in parallel batches) can't
-- race and undercount the way a read-then-write from the edge function
-- itself could.
create or replace function increment_key_request_count(p_key_label text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into api_key_status (key_label, request_count_today, count_date, updated_at)
  values (p_key_label, 1, current_date, now())
  on conflict (key_label) do update set
    request_count_today = case
      when api_key_status.count_date = current_date then api_key_status.request_count_today + 1
      else 1
    end,
    count_date = current_date,
    updated_at = now();
$$;
