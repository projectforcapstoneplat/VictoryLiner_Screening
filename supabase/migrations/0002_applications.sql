-- Victory Liner Careers — Phase 2 schema: applicant tracking (resume upload)
-- Run this once in the Supabase SQL editor, after 0001_init.sql.

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings(id),
  applicant_id uuid not null references public.profiles(id),
  full_name text,
  email text,
  phone text,
  cover_note text,
  resume_path text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

alter table public.applications enable row level security;

drop policy if exists "applications_insert_own" on public.applications;
create policy "applications_insert_own" on public.applications
  for insert with check (applicant_id = auth.uid());

drop policy if exists "applications_select_own" on public.applications;
create policy "applications_select_own" on public.applications
  for select using (applicant_id = auth.uid());

drop policy if exists "applications_select_hr" on public.applications;
create policy "applications_select_hr" on public.applications
  for select using (public.is_hr());

-- ---------------------------------------------------------------------------
-- resumes storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by default on Supabase projects,
-- and the SQL editor role isn't permitted to ALTER that table anyway.

-- Resume paths are stored as `${applicant_id}/${filename}` so an applicant's
-- own uid is always the first path segment.
drop policy if exists "resumes_insert_own" on storage.objects;
create policy "resumes_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes_select_own" on storage.objects;
create policy "resumes_select_own" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes_select_hr" on storage.objects;
create policy "resumes_select_hr" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and public.is_hr()
  );