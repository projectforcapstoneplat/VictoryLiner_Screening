-- Victory Liner Careers — closes remaining AI-screening gaps: a structured
-- education attainment level (so the AI doesn't have to infer "graduated vs
-- undergrad" from free-text degree entries), the applicant's location (for
-- terminal/route proximity screening), and a medical/physical fitness
-- certificate flag alongside the existing NBI clearance / shifting-schedule
-- fields. Run once in the Supabase SQL editor, after
-- 0008_application_extra_fields.sql.

alter table public.applications add column if not exists education_level text;
alter table public.applications add column if not exists current_location text;
alter table public.applications add column if not exists has_medical_certificate boolean;
