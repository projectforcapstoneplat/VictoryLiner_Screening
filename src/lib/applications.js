import { supabase } from './supabaseClient.js';

export async function listApplicationsForJob(jobId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

// Full row for one application — used when HR expands a single applicant's
// row in the unified Applicants table (HrApplicantsList.jsx). The table
// itself only ever holds the lightweight per-applicant summary from
// reports.js (scores/status, not phone/skills/education/etc.), so the full
// record is fetched on demand only for whichever row is actually opened.
export async function getApplicationById(applicationId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single();
  return { data, error };
}

// Bulk version of the above — used for CSV export, which needs full fields
// (phone, skills, education, driver's license, etc.) for every currently
// filtered row at once, not just whichever one HR happens to have expanded.
export async function listApplicationsByIds(applicationIds) {
  if (!applicationIds.length) return { data: [] };
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .in('id', applicationIds);
  return { data: data || [], error };
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