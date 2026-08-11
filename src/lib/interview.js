import { supabase } from './supabaseClient.js';

const QUESTIONS_PER_APPLICANT = 3;

// Ensures this application already has its interview questions assigned —
// idempotent, so re-visiting the interview page never reshuffles an
// in-progress or already-submitted interview. First visit picks the first
// 3 (by creation order) questions from the job's category question bank.
export async function ensureAssignedResponses(application, jobCategory) {
  const { data: existing, error: existingError } = await supabase
    .from('interview_responses')
    .select('*, interview_questions(question_text)')
    .eq('application_id', application.id)
    .order('created_at', { ascending: true });
  if (existingError) return { error: existingError };
  if (existing.length > 0) return { data: existing };

  const { data: candidates, error: poolError } = await supabase
    .from('interview_questions')
    .select('*')
    .ilike('category', jobCategory.trim())
    .order('created_at', { ascending: true });
  if (poolError) return { error: poolError };

  // Dedupe by question text before taking the first 3 — the bank can end up
  // with accidental duplicate entries (e.g. HR double-submitting the same
  // question), and an applicant should never be assigned the same question
  // twice just because two rows happen to share its text.
  const seenText = new Set();
  const pool = [];
  for (const q of candidates) {
    const key = q.question_text.trim().toLowerCase();
    if (seenText.has(key)) continue;
    seenText.add(key);
    pool.push(q);
    if (pool.length === QUESTIONS_PER_APPLICANT) break;
  }
  if (!pool.length) return { data: [] };

  const rows = pool.map((q) => ({ application_id: application.id, question_id: q.id }));
  const { data: inserted, error: insertError } = await supabase
    .from('interview_responses')
    .insert(rows)
    .select('*, interview_questions(question_text)')
    .order('created_at', { ascending: true });
  if (insertError) {
    // Two near-simultaneous calls (e.g. React's double-invoked effects, or a
    // quick back-and-forth navigation) can both pass the "no existing rows"
    // check above and race to insert the same assignment — the loser hits a
    // unique-constraint violation here. Rather than surface that as an
    // error, just read back what the winner already inserted.
    if (insertError.code === '23505') {
      const { data: reread, error: rereadError } = await supabase
        .from('interview_responses')
        .select('*, interview_questions(question_text)')
        .eq('application_id', application.id)
        .order('created_at', { ascending: true });
      if (rereadError) return { error: rereadError };
      return { data: reread };
    }
    return { error: insertError };
  }
  return { data: inserted };
}

// Used by MyApplications to show the applicant an honest status per
// application — "started but not answered" vs "all answers submitted" —
// without exposing anything HR-only (score, evaluation, etc.).
export async function getInterviewCompletionMap(applicationIds) {
  const map = {};
  for (const id of applicationIds) map[id] = { total: 0, answered: 0 };
  if (!applicationIds.length) return { data: map };
  const { data, error } = await supabase
    .from('interview_responses')
    .select('application_id, video_path')
    .in('application_id', applicationIds);
  if (error) return { error };
  for (const r of data) {
    map[r.application_id].total += 1;
    if (r.video_path) map[r.application_id].answered += 1;
  }
  return { data: map };
}

// Persists the recording-attempt count for one question — called each time
// the applicant starts a new take (not just on submit), so the limit can't
// be reset just by refreshing the page (see MAX_ATTEMPTS in Interview.jsx).
// Best-effort: a failed update never blocks the applicant from recording,
// it just means the count may under-report if they're offline right then.
export async function recordAttempt(applicationId, questionId, attemptCount) {
  const { error } = await supabase
    .from('interview_responses')
    .update({ attempt_count: attemptCount })
    .eq('application_id', applicationId)
    .eq('question_id', questionId);
  return { error };
}

// A 1-minute webm recording at a normal bitrate is nowhere near this — it's
// a sanity ceiling against a tampered client, not a real-world limit. The
// interview-videos bucket also enforces this server-side (see migration
// 0011_storage_limits.sql), so this check is a faster/friendlier first line,
// not the only line.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Uploads a recorded/re-recorded answer and marks that response submitted.
export async function uploadResponseVideo({ applicantId, applicationId, questionId, blob }) {
  if (blob.size > MAX_UPLOAD_BYTES) {
    return { error: { message: 'This recording is too large to upload. Please re-record a shorter answer.' } };
  }
  const path = `${applicantId}/${applicationId}/${questionId}.webm`;
  const { error: uploadError } = await supabase.storage
    .from('interview-videos')
    .upload(path, blob, { contentType: 'video/webm', upsert: true });
  if (uploadError) return { error: uploadError };

  const { data, error } = await supabase
    .from('interview_responses')
    .update({ video_path: path, status: 'recorded', submitted_at: new Date().toISOString() })
    .eq('application_id', applicationId)
    .eq('question_id', questionId)
    .select('*, interview_questions(question_text)')
    .single();
  return { data, error };
}

// Taglish translation for one question, on demand — nothing is persisted,
// this just powers the "Translate to Taglish" toggle on the Interview screen.
export async function translateToTaglish(text) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'Not signed in.' };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ text }),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'Failed to translate.' };
    return { data: body.text };
  } catch {
    return { error: 'Could not reach the translation service. Check your connection and try again.' };
  }
}
