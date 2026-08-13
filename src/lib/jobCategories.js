import { supabase } from './supabaseClient.js';

// DB-backed (see supabase/migrations/0020_job_categories.sql) — used both
// when HR posts a job (JobPostingForm) and when HR builds the interview
// question bank (InterviewQuestions), and in the public job search/filter.
// Kept as one shared source of truth (rather than free text in both
// places) so a job's category always matches a question-bank category
// exactly — applicants never hit an empty interview question pool over a
// typo/wording mismatch. HR Head can add/remove categories from HR Accounts.
export async function listJobCategories() {
  const { data, error } = await supabase.from('job_categories').select('*').order('name');
  return { data: data || [], error };
}

export async function createJobCategory(name) {
  const { data, error } = await supabase.from('job_categories').insert({ name: name.trim() }).select().single();
  return { data, error };
}

export async function deleteJobCategory(id) {
  const { error } = await supabase.from('job_categories').delete().eq('id', id);
  return { error };
}
