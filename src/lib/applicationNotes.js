import { supabase } from './supabaseClient.js';

// Bulk read for a job's whole applicant list (HrApplicants.jsx) — one query
// instead of one per card, same pattern as decision log / interview responses.
export async function listNotesForApplications(applicationIds) {
  if (!applicationIds.length) return { data: [] };
  const { data, error } = await supabase
    .from('application_notes')
    .select('*, profiles(full_name, email)')
    .in('application_id', applicationIds)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function addNote(applicationId, authorId, note) {
  const { data, error } = await supabase
    .from('application_notes')
    .insert({ application_id: applicationId, author_id: authorId, note })
    .select('*, profiles(full_name, email)')
    .single();
  return { data, error };
}

export async function deleteNote(noteId) {
  const { error } = await supabase.from('application_notes').delete().eq('id', noteId);
  return { error };
}
