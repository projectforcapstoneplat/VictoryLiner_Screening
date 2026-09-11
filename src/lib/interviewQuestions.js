import { supabase } from './supabaseClient.js';

// The question bank is scoped by category (not per-job), so the same
// questions are reused across every job posting sharing that category.
export async function listQuestionsForCategory(category) {
  const { data, error } = await supabase
    .from('interview_questions')
    .select('*')
    .ilike('category', category.trim())
    .order('created_at', { ascending: true });
  return { data: data || [], error };
}

export async function listAllQuestions() {
  const { data, error } = await supabase
    .from('interview_questions')
    .select('*')
    .order('category', { ascending: true })
    .order('created_at', { ascending: true });
  return { data: data || [], error };
}

export async function createQuestion({ category, questionText, createdBy }) {
  const { data, error } = await supabase
    .from('interview_questions')
    .insert({ category: category.trim(), question_text: questionText.trim(), created_by: createdBy })
    .select()
    .single();
  return { data, error };
}

export async function updateQuestion(id, { questionText }) {
  const { data, error } = await supabase
    .from('interview_questions')
    .update({ question_text: questionText.trim() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteQuestion(id) {
  const { error } = await supabase.from('interview_questions').delete().eq('id', id);
  return { error };
}

// Feeds the HR notification bell (HrShell.jsx) — a published job whose
// category has zero questions in the bank can't actually run its
// video-screening stage, so it's worth surfacing the moment it happens
// (right after publishing, or if the last question in that category's bank
// gets deleted), not just when HR happens to notice on Interview Questions.
// Grouped by category, not one row per job — several postings sharing an
// empty category (a common case, e.g. multiple "Bus Driver" variants) should
// read as one fixable gap, not a flood of near-duplicate alerts.
export async function listPublishedJobsMissingQuestions() {
  const [jobsRes, questionsRes] = await Promise.all([
    supabase.from('job_postings').select('id, title, category').eq('status', 'published'),
    supabase.from('interview_questions').select('category'),
  ]);
  if (jobsRes.error) return { data: [], error: jobsRes.error };
  const categoriesWithQuestions = new Set((questionsRes.data || []).map((q) => q.category.trim().toLowerCase()));
  const byCategory = new Map();
  for (const j of jobsRes.data || []) {
    const key = (j.category || '').trim();
    if (!key || categoriesWithQuestions.has(key.toLowerCase())) continue;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(j.title);
  }
  const data = [...byCategory.entries()].map(([category, jobTitles]) => ({ category, jobTitles }));
  return { data, error: null };
}

// AI-drafted starting point for a category's question set — HR reviews and
// edits before saving, nothing here is persisted directly.
export async function suggestQuestions({ category, jobTitle, jobDescription }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'Not signed in.' };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-interview-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ category, jobTitle, jobDescription }),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'Failed to suggest questions.' };
    return { data: body.questions };
  } catch {
    return { error: 'Could not reach the AI suggestion service. Check your connection and try again.' };
  }
}
