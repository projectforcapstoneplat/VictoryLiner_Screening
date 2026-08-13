import { supabase } from './supabaseClient.js';

export async function submitApplication({
  jobId,
  applicantId,
  fullName,
  email,
  phone,
  workExperience,
  education,
  skills,
  certifications,
  coverNote,
  driversLicenseType,
  driversLicenseRestrictions,
  yearsDrivingExperience,
  hasNbiClearance,
  willingShiftingSchedule,
  educationLevel,
  currentLocation,
  hasMedicalCertificate,
}) {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_id: jobId,
      applicant_id: applicantId,
      full_name: fullName,
      email,
      phone,
      work_experience: workExperience,
      education,
      skills,
      certifications,
      cover_note: coverNote,
      drivers_license_type: driversLicenseType ?? null,
      drivers_license_restrictions: driversLicenseRestrictions ?? [],
      years_driving_experience: yearsDrivingExperience ?? null,
      has_nbi_clearance: hasNbiClearance ?? null,
      willing_shifting_schedule: willingShiftingSchedule ?? null,
      education_level: educationLevel ?? null,
      current_location: currentLocation ?? null,
      has_medical_certificate: hasMedicalCertificate ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: { message: 'You have already applied to this job.' } };
    }
    return { error };
  }

  return { data };
}

export async function listApplicationsForJob(jobId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

// Used by the apply flow to detect an already-submitted application for this
// job, so a returning applicant is routed onward instead of shown a blank
// resume form again.
export async function getApplicationForJob(jobId, applicantId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*, job_postings(title, category)')
    .eq('job_id', jobId)
    .eq('applicant_id', applicantId)
    .maybeSingle();
  return { data, error };
}

// Used by ApplicationForm to pre-fill a new application from the applicant's
// most recent other one, so they aren't retyping work experience/education/
// skills/etc. from scratch for every job they apply to.
export async function getMostRecentApplication(applicantId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data, error };
}

export async function listApplicationsForApplicant(applicantId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*, job_postings(title, category, min_resume_match_percent)')
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

// HR Personnel's decision at either stage of the pipeline — first "submitted"
// -> "interview_stage" (advance to interview) or "declined", then later
// "interview_stage" -> "advanced" (final) or "declined". HR Head can see the
// result via reports but never calls this itself. Also writes an audit-log
// row recording who decided and when, kept separate from `status` itself so
// the history survives regardless of what happens to the application later.
//
// Plain update, single HR Personnel account for now — no concurrency guard.
// If multiple HR staff end up acting on the same applicant at once later,
// revisit this with an atomic compare-and-swap (check the row's current
// status as part of the update, not just by id) so a second write can't
// silently overwrite the first.
export async function updateApplicationStatus(applicationId, status, decidedBy) {
  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) return { data: null, error };

  await supabase.from('application_decision_log').insert({ application_id: applicationId, decided_by: decidedBy, status });
  return { data, error: null };
}

// Best-effort — a failed/unconfigured email send never undoes the status
// change that already happened (see supabase/functions/send-status-email).
// Deliberately swallows all errors: this is a courtesy notification, not
// something that should ever block or alarm HR mid-decision.
export async function notifyApplicantStatusChange(applicationId, status) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-status-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ applicationId, status }),
    });
  } catch {
    // Notification is a courtesy, not a requirement — never surface this.
  }
}

// Generates a fresh temporary password for a locked-out applicant — see
// supabase/functions/reset-applicant-password for why this exists (the
// default email sender can't reach real applicants yet). HR relays the
// returned password to the applicant directly.
export async function resetApplicantPassword(applicantId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: { message: 'Not signed in.' } };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-applicant-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ applicantId }),
    });
    const body = await res.json();
    if (!res.ok) return { error: { message: body.error || 'Failed to reset password.' } };
    return { data: { password: body.password } };
  } catch {
    return { error: { message: 'Could not reach the password reset service. Check your connection and try again.' } };
  }
}

// Reads the decision-audit trail for a set of applications — who advanced/
// declined each one, and when. HR-only via RLS.
export async function listDecisionLogForApplications(applicationIds) {
  if (!applicationIds.length) return { data: [] };
  const { data, error } = await supabase
    .from('application_decision_log')
    .select('*, profiles(full_name, email)')
    .in('application_id', applicationIds)
    .order('decided_at', { ascending: false });
  return { data: data || [], error };
}