import { supabase } from './supabaseClient.js';

// HR-side reads — batched across every application on a job's Applicants
// page, rather than one query per applicant.
export async function listResponsesForApplications(applicationIds) {
  if (!applicationIds.length) return { data: [] };
  const { data, error } = await supabase
    .from('interview_responses')
    .select('*, interview_questions(question_text)')
    .in('application_id', applicationIds)
    .order('created_at', { ascending: true });
  return { data: data || [], error };
}

export async function listEvaluationsForApplications(applicationIds) {
  if (!applicationIds.length) return { data: [] };
  const { data, error } = await supabase
    .from('interview_evaluations')
    .select('*')
    .in('application_id', applicationIds);
  return { data: data || [], error };
}

// interview-videos is a private bucket — HR needs a short-lived signed URL to
// play a specific answer back rather than a public link.
export async function getSignedVideoUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('interview-videos').createSignedUrl(path, expiresIn);
  return { data: data?.signedUrl, error };
}

// Calls the AI to (re-)evaluate one recorded answer. Persists the result
// server-side, so callers should treat the resolved value as the new source
// of truth for that response's evaluation.
export async function evaluateResponse(responseId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'Not signed in.' };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-interview-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ responseId }),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'Failed to evaluate interview response.' };
    return { data: body.evaluation };
  } catch {
    return { error: 'Could not reach the AI evaluation service. Check your connection and try again.' };
  }
}
