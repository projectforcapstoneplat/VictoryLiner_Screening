import { supabase } from './supabaseClient.js';

// Cached AI match scores between the applicant's standalone resume and
// every published job (see match-resume-to-jobs edge function) — a read of
// whatever's already been computed, not an AI call itself.
export async function getMyMatches(applicantId) {
  const { data, error } = await supabase
    .from('resume_job_matches')
    .select('*, job_postings(*)')
    .eq('applicant_id', applicantId);
  return { data: data || [], error };
}

// Kicks off (or continues) scoring the applicant's resume against every
// published job that doesn't already have a cached score. Safe to call
// repeatedly — already-scored jobs are skipped server-side.
export async function runResumeMatching() {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'Not signed in.' };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-resume-to-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'Failed to match jobs.' };
    return { data: body };
  } catch {
    return { error: 'Could not reach the matching service. Check your connection and try again.' };
  }
}

// Called whenever the applicant saves changes to their resume (ResumeForm.jsx)
// — cached scores were computed against the *old* resume, so they'd be stale
// and misleading left in place. Deleting them means the next visit to the
// matches page naturally recomputes everything fresh.
export async function clearMyMatches(applicantId) {
  const { error } = await supabase.from('resume_job_matches').delete().eq('applicant_id', applicantId);
  return { error };
}

// HR-triggered, fired right when a job is published (HrDashboard.jsx) —
// scores that one job against every applicant's completed resume that
// doesn't already have a cached score for it, and emails anyone who newly
// qualifies. This is what keeps "run matching once per resume" from meaning
// applicants silently miss jobs posted after their resume was last matched.
export async function matchJobToAllResumes(jobId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'Not signed in.' };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-job-to-resumes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ jobId }),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'Failed to match applicants.' };
    return { data: body };
  } catch {
    return { error: 'Could not reach the matching service.' };
  }
}
