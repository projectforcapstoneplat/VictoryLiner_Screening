import { supabase } from './supabaseClient.js';

// System-generated only (written by match-job-to-resumes with the
// service-role client) — applicants can read and mark their own read, never
// create one themselves. See migration 0026_applicant_notifications.sql.
export async function listMyNotifications(applicantId) {
  const { data, error } = await supabase
    .from('applicant_notifications')
    .select('*, job_postings(title)')
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false })
    .limit(20);
  return { data: data || [], error };
}

export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('applicant_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

export async function markAllNotificationsRead(applicantId) {
  const { error } = await supabase
    .from('applicant_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('applicant_id', applicantId)
    .is('read_at', null);
  return { error };
}
