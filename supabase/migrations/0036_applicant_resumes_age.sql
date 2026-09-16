-- Some roles have an age requirement or preference (e.g. a minimum age for
-- driving positions) that HR currently has no way to screen for on the
-- resume itself. A plain integer, same pattern as the existing
-- years_driving_experience column — a point-in-time value an applicant can
-- update themselves, not derived from a stored birthdate.
alter table public.applicant_resumes add column if not exists age integer;
