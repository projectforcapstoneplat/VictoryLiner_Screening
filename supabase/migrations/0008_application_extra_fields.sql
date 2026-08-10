-- Victory Liner Careers — richer structured application fields so the AI
-- resume evaluator gets concrete, comparable signals (driving qualifications)
-- instead of relying entirely on free-text prose. Run once in the Supabase
-- SQL editor, after 0007_application_status.sql.

alter table public.applications add column if not exists drivers_license_type text;
alter table public.applications add column if not exists drivers_license_restrictions text[] not null default '{}';
alter table public.applications add column if not exists years_driving_experience integer;
alter table public.applications add column if not exists has_nbi_clearance boolean;
alter table public.applications add column if not exists willing_shifting_schedule boolean;
