import { supabase } from './supabaseClient.js';

// Applies to a job the applicant's AI matches already scored — see
// supabase/functions/quick-apply for what this actually does server-side
// (reuses the existing match score instead of a fresh AI call, sets status
// to 'interview_stage' directly when that score clears the threshold).
export async function quickApply(jobId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: { message: 'Not signed in.' } };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quick-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ jobId }),
    });
    const body = await res.json();
    if (!res.ok) return { error: { message: body.error || 'Failed to apply.' } };
    return { data: body.application };
  } catch {
    return { error: { message: 'Could not reach the server. Check your connection and try again.' } };
  }
}
