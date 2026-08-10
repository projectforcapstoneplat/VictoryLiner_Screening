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
export async function replaceCriteriaForJob(jobId, criteria) {
  const { error: deleteError } = await supabase.from('criteria').delete().eq('job_id', jobId);
  if (deleteError) return { error: deleteError };

  const rows = criteria
    .filter((c) => c.keyword.trim())
    .map((c) => ({ job_id: jobId, keyword: c.keyword.trim(), weight: Number(c.weight) || 1 }));

  if (rows.length === 0) return { data: [] };

  const { data, error } = await supabase.from('criteria').insert(rows).select();
  return { data, error };
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