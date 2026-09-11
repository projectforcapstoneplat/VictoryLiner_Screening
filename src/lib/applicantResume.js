import { supabase } from './supabaseClient.js';

// The standalone resume an applicant fills once, before choosing any job —
// distinct from `applications` rows, which still hold a per-job snapshot.
// null means they haven't filled one in yet, which App.jsx uses to route
// them into ResumeForm.
export async function getMyResume(applicantId) {
  const { data, error } = await supabase
    .from('applicant_resumes')
    .select('*')
    .eq('applicant_id', applicantId)
    .maybeSingle();
  return { data, error };
}

export async function upsertMyResume(applicantId, resume) {
  const { data, error } = await supabase
    .from('applicant_resumes')
    .upsert({ applicant_id: applicantId, ...resume, updated_at: new Date().toISOString() }, { onConflict: 'applicant_id' })
    .select()
    .single();
  return { data, error };
}
