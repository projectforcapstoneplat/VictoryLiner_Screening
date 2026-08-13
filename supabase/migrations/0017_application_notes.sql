-- Victory Liner Careers — internal HR-only notes on a candidate (e.g.
-- "called, no answer" or "strong culture fit") so staff can leave context
-- for each other. Never shown to the applicant — a separate table from
-- anything applicant-facing, gated entirely by is_hr().
-- Run once in the Supabase SQL editor, after 0016_job_min_resume_match.sql.

create table if not exists public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid references public.profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists application_notes_app_idx on public.application_notes (application_id, created_at desc);

alter table public.application_notes enable row level security;

drop policy if exists "application_notes_select_hr" on public.application_notes;
create policy "application_notes_select_hr" on public.application_notes
  for select using (public.is_hr());

drop policy if exists "application_notes_insert_hr" on public.application_notes;
create policy "application_notes_insert_hr" on public.application_notes
  for insert with check (public.is_hr() and author_id = auth.uid());

-- Only the author can remove their own note — HR staff shouldn't be able to
-- silently delete a colleague's observations about a candidate.
drop policy if exists "application_notes_delete_own" on public.application_notes;
create policy "application_notes_delete_own" on public.application_notes
  for delete using (author_id = auth.uid());
