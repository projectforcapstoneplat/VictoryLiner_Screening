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

// Refreshes any of this applicant's still-undecided applications
// ('submitted'/'interview_stage') to match the resume as it stands right
// now — without this, HR keeps reviewing whatever was true the moment the
// applicant quick-applied (applications stores its own snapshot of resume
// data, not a live reference), even after a later edit. Only called after a
// real, completed save (ResumeForm.jsx's final "Save Changes"), not the
// in-progress autosaves between wizard steps — syncing a half-finished edit
// into a live application record would do more harm than staying stale.
// Applicants have no UPDATE policy on applications (HR owns that table), so
// this goes through the same SECURITY DEFINER RPC pattern as
// uploadIntroVideo's set_intro_video_path (see migration
// 0044_sync_submitted_applications_with_resume.sql) rather than a direct
// client-side update.
export async function syncSubmittedApplicationsWithResume(applicantId) {
  const { error } = await supabase.rpc('sync_submitted_applications_with_resume', { p_applicant_id: applicantId });
  return { error };
}
