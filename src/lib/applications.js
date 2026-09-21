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

// Full job_postings row (not just title/category/min_resume_match_percent)
// — MyApplications.jsx links back to the actual Job Details page for
// whichever applications have no other next action right now (still
// awaiting HR's first look, declined, etc.), which needs the job's full
// fields (description, qualifications, location...) to render properly.
export async function listApplicationsForApplicant(applicantId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*, job_postings(*)')
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
  const update = { status };
  // Starts the 3-day video-screening deadline clock — this is the one place
  // HR manually advances someone into interview_stage (quick-apply's own
  // auto-advance stamps this itself, see supabase/functions/quick-apply).
  if (status === 'interview_stage') update.interview_stage_at = new Date().toISOString();
  // 'submitted' is only ever reached through HrApplicantsList.jsx's Reopen
  // action (see its own comment there) — including on someone who was
  // already Advanced and had a personal interview on the calendar. Leaving
  // that old scheduled_interview_at sitting in place used to mean
  // re-advancing them later silently showed the STALE appointment as if it
  // were still booked, with no new schedule ever actually set and no fresh
  // notification sent — directly contradicting Reopen's own "resets...
  // from scratch" copy. Clearing it here, unconditionally, is what makes
  // that promise true and lets the reopen email correctly say the old
  // interview was canceled.
  if (status === 'submitted') {
    update.scheduled_interview_at = null;
    update.scheduled_interview_location = null;
    update.scheduled_interview_notes = null;
    update.scheduled_interview_set_by = null;
    update.scheduled_interview_set_at = null;
  }
  const { data, error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', applicationId)
    .select()
    .single();

  if (error) return { data: null, error };

  await supabase.from('application_decision_log').insert({ application_id: applicationId, decided_by: decidedBy, status });
  return { data, error: null };
}

// HR schedules a personal (in-person) interview for an applicant who's
// already been advanced — separate from the submitted/interview_stage/
// advanced/declined status column, since scheduling is additional detail on
// top of "advanced," not a new stage of the pipeline. Overwrites cleanly if
// HR needs to reschedule.
export async function scheduleInterview(applicationId, { scheduledAt, location, notes }, setBy) {
  const { data, error } = await supabase
    .from('applications')
    .update({
      scheduled_interview_at: scheduledAt,
      scheduled_interview_location: location || null,
      scheduled_interview_notes: notes || null,
      scheduled_interview_set_by: setBy,
      scheduled_interview_set_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();
  return { data, error };
}

// Every already-scheduled personal interview, company-wide (every job, not
// just one) — feeds the calendar picker in HrApplicantsList.jsx's
// SchedulePanel so HR can see actual booking density (which days are
// already busy) while picking a new slot, instead of scheduling blind.
// HR's own RLS grants already cover reading every application, same as the
// unified Applicants table itself.
export async function listScheduledInterviewDates() {
  const { data, error } = await supabase
    .from('applications')
    .select('id, full_name, scheduled_interview_at')
    .not('scheduled_interview_at', 'is', null);
  return { data: data || [], error };
}

// Best-effort, same reasoning as notifyApplicantStatusChange — a failed send
// never undoes the schedule that was just saved. `isReschedule` (set by the
// caller based on whether a scheduled_interview_at already existed before
// this save) swaps the edge function's copy from "scheduled" to
// "rescheduled" — same template, different framing, since a second
// scheduling email phrased identically to the first would read like a
// duplicate rather than an actual change.
export async function notifyInterviewScheduled(applicationId, { scheduledAt, location, isReschedule }) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-interview-scheduled-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ applicationId, scheduledAt, location, isReschedule }),
    });
  } catch {
    // Notification is a courtesy, not a requirement — never surface this.
  }
}

// Best-effort, same reasoning as the two above — called once, right when an
// applicant's last video answer finishes uploading (src/pages/Interview.jsx),
// so HR finds out the moment someone's actually ready for review instead of
// only whenever they next happen to open a dashboard.
export async function notifyHrInterviewCompleted(applicationId) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-interview-completed-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ applicationId }),
    });
  } catch {
    // Notification is a courtesy, not a requirement — never surface this.
  }
}

// Best-effort — a failed/unconfigured email send never undoes the status
// change that already happened (see supabase/functions/send-status-email).
// Deliberately swallows all errors: this is a courtesy notification, not
// something that should ever block or alarm HR mid-decision. `hadSchedule`
// (only meaningful for status='submitted', i.e. Reopen) tells the edge
// function whether this reopen also canceled a personal interview that was
// already on the calendar — the applicant needs different copy for "your
// application was reopened" versus "your interview was canceled AND your
// application was reopened."
export async function notifyApplicantStatusChange(applicationId, status, { hadSchedule } = {}) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-status-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ applicationId, status, hadSchedule }),
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

// Both reminder emails (send-interview-reminders, send-schedule-reminders)
// are otherwise cron-only, authenticated with the server's own service-role
// secret — nothing in this app could previously trigger or even preview
// them short of waiting on real elapsed time. These call the same edge
// functions with the caller's own HR session instead, which both now accept
// as a one-off preview send for a specific applicationId, bypassing the
// real batch's timing/already-sent gates without touching that
// applicant's real reminder bookkeeping.
export async function sendTestInterviewReminder(applicationId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: { message: 'Not signed in.' } };
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-interview-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ applicationId }),
    });
    const body = await res.json();
    if (!res.ok) return { error: { message: body.error || 'Failed to send preview.' } };
    return { data: body };
  } catch {
    return { error: { message: 'Could not reach the reminder service. Check your connection and try again.' } };
  }
}

export async function sendTestScheduleReminder(applicationId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: { message: 'Not signed in.' } };
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-schedule-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ applicationId }),
    });
    const body = await res.json();
    if (!res.ok) return { error: { message: body.error || 'Failed to send preview.' } };
    return { data: body };
  } catch {
    return { error: { message: 'Could not reach the reminder service. Check your connection and try again.' } };
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