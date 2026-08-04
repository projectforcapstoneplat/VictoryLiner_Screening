-- Victory Liner Careers — Phase 1 schema: accounts + job postings
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'applicant' check (role in ('applicant', 'hr_personnel', 'hr_head')),
  full_name text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- security definer helpers so RLS policies can check role without recursing
-- back into the (RLS-protected) profiles table under the caller's own permissions.
create or replace function public.is_hr(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role in ('hr_personnel', 'hr_head')
  );
$$;

create or replace function public.is_hr_head(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'hr_head'
  );
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_select_hr_personnel_by_head" on public.profiles;
create policy "profiles_select_hr_personnel_by_head" on public.profiles
  for select using (public.is_hr_head() and role = 'hr_personnel');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_update_hr_personnel_by_head" on public.profiles;
create policy "profiles_update_hr_personnel_by_head" on public.profiles
  for update using (public.is_hr_head() and role = 'hr_personnel')
  with check (role = 'hr_personnel');

-- New auth.users rows (self sign-up or admin.createUser) get a matching profile row.
-- role/full_name come from user_metadata when provided (see supabase/README.md),
-- defaulting to 'applicant' for the public sign-up flow.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'applicant'),
    new.raw_user_meta_data->>'full_name',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- job_postings
-- ---------------------------------------------------------------------------
create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  location text,
  employment_type text,
  open_positions integer not null default 1,
  description text,
  required_qualifications text,
  preferred_qualifications text,
  accommodations_policy text,
  ai_policy text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  application_deadline date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_postings enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists job_postings_set_updated_at on public.job_postings;
create trigger job_postings_set_updated_at
  before update on public.job_postings
  for each row execute function public.set_updated_at();

drop policy if exists "job_postings_select_published" on public.job_postings;
create policy "job_postings_select_published" on public.job_postings
  for select using (status = 'published');

drop policy if exists "job_postings_select_hr" on public.job_postings;
create policy "job_postings_select_hr" on public.job_postings
  for select using (public.is_hr());

drop policy if exists "job_postings_insert_hr" on public.job_postings;
create policy "job_postings_insert_hr" on public.job_postings
  for insert with check (public.is_hr());

drop policy if exists "job_postings_update_hr" on public.job_postings;
create policy "job_postings_update_hr" on public.job_postings
  for update using (public.is_hr()) with check (public.is_hr());

drop policy if exists "job_postings_delete_hr" on public.job_postings;
create policy "job_postings_delete_hr" on public.job_postings
  for delete using (public.is_hr());
