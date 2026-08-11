-- Victory Liner Careers — backs a simple per-user rate limit on the Gemini-
-- calling edge functions, so a spammed button (or a malicious script) can't
-- run up an unbounded Gemini bill. DB-backed rather than an in-memory
-- counter because edge functions can run across multiple isolates/cold
-- starts, which wouldn't share an in-memory count reliably.
-- Run once in the Supabase SQL editor, after 0011_storage_limits.sql.

create table if not exists public.ai_rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  function_name text not null,
  called_at timestamptz not null default now()
);

create index if not exists ai_rate_limits_lookup_idx on public.ai_rate_limits (user_id, function_name, called_at);

alter table public.ai_rate_limits enable row level security;

-- Only edge functions touch this table (via the caller's own JWT, scoped to
-- their own rows) — there's no UI reading or writing it directly.
drop policy if exists "ai_rate_limits_insert_own" on public.ai_rate_limits;
create policy "ai_rate_limits_insert_own" on public.ai_rate_limits
  for insert with check (auth.uid() = user_id);

drop policy if exists "ai_rate_limits_select_own" on public.ai_rate_limits;
create policy "ai_rate_limits_select_own" on public.ai_rate_limits
  for select using (auth.uid() = user_id);

-- Old rows are only ever useful within the last rate-limit window (at most
-- a few minutes) — prevents the table from growing unbounded forever.
create or replace function public.prune_ai_rate_limits() returns trigger as $$
begin
  delete from public.ai_rate_limits where called_at < now() - interval '1 day';
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists prune_ai_rate_limits_trigger on public.ai_rate_limits;
create trigger prune_ai_rate_limits_trigger
  after insert on public.ai_rate_limits
  execute function public.prune_ai_rate_limits();
