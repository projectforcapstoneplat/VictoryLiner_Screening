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

// match-resume-to-jobs only scores up to MAX_JOBS_PER_CALL jobs per call
// (its own cap against burning through AI quota in one request) — a single
// runResumeMatching() call silently leaves anything past that cap unscored,
// which used to mean a resume sitting in a pool of more open jobs than that
// cap (or one that's missed several rounds of newly-published jobs) could
// stay permanently short of full coverage: a weaker-fitting job that
// happened to get scored early could show up as a match while genuinely
// better-fitting jobs, simply never evaluated yet, couldn't appear at all.
// This loops automatically instead of leaving that to repeated manual
// clicks — each call's own response says exactly how many jobs are still
// unscored (remainingJobs) and how many this call actually scored
// (scoredThisCall), so the loop keeps going until either nothing's left or
// a call makes no forward progress (a stuck/failing job would otherwise
// retry forever). The iteration cap is a hard safety ceiling, not a tuned
// limit — comfortably past any realistic number of open jobs today.
export async function runFullResumeMatching() {
  let result = await runResumeMatching();
  let iterations = 1;
  while (!result.error && result.data.remainingJobs > 0 && result.data.scoredThisCall > 0 && iterations < 6) {
    result = await runResumeMatching();
    iterations += 1;
  }
  return result;
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
