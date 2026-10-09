-- Victory Liner Careers — fixes a real data-freshness gap: applications
-- store a full SNAPSHOT of resume data taken at the moment of quick-apply
-- (src/lib/quickApply.js). If the applicant edits their standalone resume
-- afterward (ResumeForm.jsx), that snapshot never updates — HR keeps
-- reviewing whatever was true at apply time, even if the applicant later
-- fixed a typo, added a certification, etc.
--
-- Only syncs applications still in 'submitted' or 'interview_stage' — these
-- are the only statuses nothing has actually been decided on yet, so
-- refreshing their on-file data can't retroactively alter a record HR has
-- already acted on (advanced/declined stay frozen, which is the correct,
-- honest behavior for those — that's what was actually reviewed).
--
-- Also deletes any existing resume_evaluations row for a synced
-- application, rather than leaving a stale score sitting next to freshly
-- updated resume text. This doesn't orphan anything — HrApplicantsList.jsx
-- already has a lazy-evaluate-on-open fallback (`if (!ev) { ...
-- evaluateApplication(applicationId) }`), the same pattern used elsewhere
-- in this app, so the next time HR opens this applicant it gets freshly
-- (re-)scored against the updated resume automatically.
--
-- Applicants have no general UPDATE policy on applications (HR owns that
-- table) and no DELETE policy on resume_evaluations at all, so this goes
-- through a SECURITY DEFINER function — same pattern as
-- set_intro_video_path in migration 0043 — scoped strictly to the caller's
-- own applicant_id.
create or replace function public.sync_submitted_applications_with_resume(p_applicant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.applicant_resumes%rowtype;
  affected_ids uuid[];
begin
  if p_applicant_id <> auth.uid() then
    return;
  end if;

  select * into r from public.applicant_resumes where applicant_id = p_applicant_id;
  if not found then
    return;
  end if;

  select array_agg(id) into affected_ids
  from public.applications
  where applicant_id = p_applicant_id and status in ('submitted', 'interview_stage');

  if affected_ids is null then
    return;
  end if;

  update public.applications
  set full_name = r.full_name,
      email = r.email,
      phone = r.phone,
      work_experience = r.work_experience,
      education = r.education,
      skills = r.skills,
      certifications = r.certifications,
      drivers_license_type = r.drivers_license_type,
      drivers_license_restrictions = r.drivers_license_restrictions,
      years_driving_experience = r.years_driving_experience,
      has_nbi_clearance = r.has_nbi_clearance,
      willing_shifting_schedule = r.willing_shifting_schedule,
      education_level = r.education_level,
      current_location = r.current_location,
      has_medical_certificate = r.has_medical_certificate
  where id = any(affected_ids);

  delete from public.resume_evaluations where application_id = any(affected_ids);
end;
$$;

grant execute on function public.sync_submitted_applications_with_resume(uuid) to authenticated;
