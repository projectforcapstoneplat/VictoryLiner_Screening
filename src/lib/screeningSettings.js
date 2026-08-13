import { supabase } from './supabaseClient.js';

// Single-row table (id is always 1) — see supabase/migrations/0014_screening_settings.sql.
export async function getScreeningSettings() {
  const { data, error } = await supabase.from('screening_settings').select('*').eq('id', 1).single();
  return { data, error };
}

export async function updateMinResumeMatchPercent(percent, updatedBy) {
  const { data, error } = await supabase
    .from('screening_settings')
    .update({ min_resume_match_percent: percent, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();
  return { data, error };
}

export async function updateInterviewQuestionCount(count, updatedBy) {
  const { data, error } = await supabase
    .from('screening_settings')
    .update({ interview_question_count: count, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();
  return { data, error };
}
