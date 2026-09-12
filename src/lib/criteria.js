import { supabase } from './supabaseClient.js';

export async function listCriteriaForJob(jobId) {
  const { data, error } = await supabase
    .from('criteria')
    .select('*')
    .eq('job_id', jobId)
    .order('weight', { ascending: false });
  return { data: data || [], error };
}

// Criteria are edited as a whole list in the job posting form, so saving
// replaces the full set for a job rather than diffing individual rows.
//
// Also invalidates every applicant's resume score for this job if the
// criteria actually changed — an AI score is only meaningful relative to
// whatever it was weighed against, and without this, an applicant scored
// under the *old* criteria kept showing that score forever even after HR
// retuned what the job actually screens for, with nothing to indicate it
// was stale. Deleting (rather than just flagging) reuses the same "no
// evaluation on file yet" safety net HrApplicantsList.jsx already has for
// a resume that's never been scored — it re-evaluates automatically the
// next time HR opens that applicant's row.
export async function replaceCriteriaForJob(jobId, criteria) {
  const { data: existing } = await supabase.from('criteria').select('keyword, weight').eq('job_id', jobId).order('keyword');
  const rows = criteria
    .filter((c) => c.keyword.trim())
    .map((c) => ({ job_id: jobId, keyword: c.keyword.trim(), weight: Number(c.weight) || 1 }));
  const normalize = (list) => [...list]
    .map((c) => `${c.keyword.trim().toLowerCase()}:${Number(c.weight) || 1}`)
    .sort()
    .join('|');
  const changed = normalize(existing || []) !== normalize(rows);

  const { error: deleteError } = await supabase.from('criteria').delete().eq('job_id', jobId);
  if (deleteError) return { error: deleteError };

  let data = [];
  if (rows.length > 0) {
    const inserted = await supabase.from('criteria').insert(rows).select();
    if (inserted.error) return { error: inserted.error };
    data = inserted.data;
  }

  if (changed) {
    // Best-effort — a failed invalidation never blocks the criteria save
    // that already succeeded; worst case a stale score lingers until HR
    // notices and manually re-evaluates that one applicant.
    await supabase.from('resume_evaluations').delete().eq('job_id', jobId);
  }

  return { data };
}

// AI-drafted starting point for the criteria list — HR reviews and edits
// the result before saving, nothing here is persisted directly.
export async function suggestCriteria({ title, description, requiredQualifications, preferredQualifications }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'Not signed in.' };

  // Network failures and non-JSON error pages must resolve to {error}, not throw —
  // an uncaught rejection here would leave the caller's loading state stuck forever.
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ title, description, requiredQualifications, preferredQualifications }),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'Failed to suggest criteria.' };
    return { data: body.criteria };
  } catch {
    return { error: 'Could not reach the AI suggestion service. Check your connection and try again.' };
  }
}