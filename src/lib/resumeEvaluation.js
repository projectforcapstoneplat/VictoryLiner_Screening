import { supabase } from './supabaseClient.js';

// Reads whatever AI evaluations already exist for a job's applicants —
// evaluate-application writes one row per application, so this is just a
// cache read, not an AI call.
export async function listEvaluationsForJob(jobId) {
  const { data, error } = await supabase
    .from('resume_evaluations')
    .select('*')
    .eq('job_id', jobId);
  return { data: data || [], error };
}

// Calls the AI to (re-)evaluate one application against its job's screening
// criteria. Persists the result server-side, so callers should treat the
// resolved value as the new source of truth for that application's score.
export async function evaluateApplication(applicationId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'Not signed in.' };

  // Network failures and non-JSON error pages must resolve to {error}, not throw —
  // an uncaught rejection here would leave the caller's pending state stuck forever.
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ applicationId }),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'Failed to evaluate application.' };
    return { data: body.evaluation };
  } catch {
    return { error: 'Could not reach the AI evaluation service. Check your connection and try again.' };
  }
}
