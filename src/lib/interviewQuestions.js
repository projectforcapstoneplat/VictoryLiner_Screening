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
