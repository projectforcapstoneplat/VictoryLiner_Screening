-- Lets ResumeForm.jsx's "I'm a fresh graduate / I have no work experience"
-- checkbox survive a refresh/resume-later, same as every other field on this
-- form — without a persisted flag, the Work Experience step could never show
-- as genuinely complete for someone with nothing to put there, since there
-- was no way to distinguish "confirmed no experience" from "just hasn't
-- gotten to this step yet."
alter table public.applicant_resumes add column if not exists no_work_experience boolean not null default false;
