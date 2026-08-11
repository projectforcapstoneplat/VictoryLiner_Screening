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
    .select('*, job_postings(title, category)')
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

// HR Personnel's advance/decline decision (paper: "Advances or declines
// candidates based on system-generated results") — HR Head can see the
// result via reports but never calls this itself. Also writes an audit-log
// row recording who decided and when, kept separate from `status` itself so
// the history survives regardless of what happens to the application later.
//
// The `.eq('status', 'submitted')` guard makes this an atomic compare-and-
// swap: with multiple HR Personnel able to act on the same applicant, two
// people could both load the page while it's still "submitted" and both
// click a decision — without this guard, the second write would silently
// overwrite the first with no indication anything was already decided.
// Postgres applies the WHERE+SET as one operation, so there's no window for
// both to succeed; the loser gets back the real current state instead.
export async function updateApplicationStatus(applicationId, status, decidedBy) {
  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .eq('status', 'submitted')
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      const { data: current } = await supabase.from('applications').select('*').eq('id', applicationId).maybeSingle();
      return {
        data: current,
        error: { code: 'ALREADY_DECIDED', message: `This application was already ${current?.status === 'declined' ? 'declined' : 'advanced'} by someone else.` },
      };
    }
    return { data: null, error };
  }

  await supabase.from('application_decision_log').insert({ application_id: applicationId, decided_by: decidedBy, status });
  return { data, error: null };
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