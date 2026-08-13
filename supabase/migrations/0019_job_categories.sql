-- Victory Liner Careers — moves job categories from a hardcoded JS constant
-- (src/lib/jobCategories.js) into a real table HR Head can manage, so adding
-- a new category no longer requires a code change and a redeploy. Seeded
-- with the exact same 15 values the constant used to hold, so existing job
-- postings and interview question banks (which store the category as plain
-- text, not a foreign key) keep matching exactly.
-- Run once in the Supabase SQL editor, after 0018_reopen_decision_log.sql.

create table if not exists public.job_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.job_categories (name) values
  ('Bus Driver'),
  ('Conductor'),
  ('Mechanic / Maintenance Technician'),
  ('Terminal Operations Staff'),
  ('Dispatcher / Trip Scheduler'),
  ('Customer Service / Ticketing'),
  ('Cashier / Teller'),
  ('Accounting & Finance'),
  ('Human Resources'),
  ('Administrative / Clerical'),
  ('Security Guard'),
  ('Safety & Compliance Inspector'),
  ('Information Technology'),
  ('Marketing & Sales'),
  ('Operations Supervisor / Management')
on conflict (name) do nothing;

alter table public.job_categories enable row level security;

-- Public read — the same unauthenticated applicants browsing job listings
-- (JobFilter.jsx, Homepage.jsx) already read published job_postings freely;
-- the category filter pills need this list too, logged in or not.
drop policy if exists "job_categories_select_public" on public.job_categories;
create policy "job_categories_select_public" on public.job_categories
  for select using (true);

drop policy if exists "job_categories_insert_hr_head" on public.job_categories;
create policy "job_categories_insert_hr_head" on public.job_categories
  for insert with check (public.is_hr_head());

drop policy if exists "job_categories_delete_hr_head" on public.job_categories;
create policy "job_categories_delete_hr_head" on public.job_categories
  for delete using (public.is_hr_head());
