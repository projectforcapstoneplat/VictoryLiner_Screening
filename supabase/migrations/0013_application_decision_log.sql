-- Victory Liner Careers — audit trail for HR advance/decline decisions: who
-- made the call and when, separate from `applications.status` itself so the
-- history survives even if a decision were ever corrected later.
-- Run once in the Supabase SQL editor, after 0012_ai_rate_limits.sql.

create table if not exists public.application_decision_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  decided_by uuid references public.profiles(id),
  status text not null check (status in ('advanced', 'declined')),
  decided_at timestamptz not null default now()
);

create index if not exists application_decision_log_app_idx on public.application_decision_log (application_id, decided_at desc);

alter table public.application_decision_log enable row level security;

drop policy if exists "application_decision_log_select_hr" on public.application_decision_log;
create policy "application_decision_log_select_hr" on public.application_decision_log
  for select using (public.is_hr());

drop policy if exists "application_decision_log_insert_hr" on public.application_decision_log;
create policy "application_decision_log_insert_hr" on public.application_decision_log
  for insert with check (public.is_hr());
