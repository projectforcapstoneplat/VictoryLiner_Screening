-- Victory Liner Careers — Phase 2 correction: structured resume questionnaire
-- instead of a raw file upload (avoids blurry scans / inconsistent parsing so
-- the future NLP resume-analysis stage gets clean, structured data). Run this
-- once in the Supabase SQL editor, after 0002_applications.sql.

alter table public.applications drop column if exists resume_path;

alter table public.applications
  add column if not exists work_experience jsonb not null default '[]'::jsonb;

alter table public.applications
  add column if not exists education jsonb not null default '[]'::jsonb;

alter table public.applications
  add column if not exists skills text[] not null default '{}';

alter table public.applications
  add column if not exists certifications jsonb not null default '[]'::jsonb;

-- The resumes storage bucket/policies from 0002 are no longer used by the app.
-- Left in place (harmless if empty) rather than dropped, since deleting a
-- bucket that already has objects in it would fail.
drop policy if exists "resumes_insert_own" on storage.objects;
drop policy if exists "resumes_select_own" on storage.objects;
drop policy if exists "resumes_select_hr" on storage.objects;