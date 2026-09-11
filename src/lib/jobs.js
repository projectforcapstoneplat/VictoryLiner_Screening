import { supabase } from './supabaseClient.js';

export async function listPublishedJobs() {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

// Job Openings (HrDashboard.jsx) shows how many applicants each posting has
// drawn, plus how many of its open_positions are already spoken for — a
// plain aggregate query (`applications(count)`) would be simpler, but relies
// on a PostgREST version/feature this project hasn't confirmed it has, so
// counts are computed client-side from a second, cheap query instead (job_id
// + status only, not full rows).
export async function listAllJobs() {
  const [jobsResult, appsResult] = await Promise.all([
    supabase.from('job_postings').select('*').order('created_at', { ascending: false }),
    supabase.from('applications').select('job_id, status'),
  ]);
  if (jobsResult.error) return { data: [], error: jobsResult.error };
  const counts = new Map();
  const advancedCounts = new Map();
  for (const a of appsResult.data || []) {
    counts.set(a.job_id, (counts.get(a.job_id) || 0) + 1);
    // "Advanced" is the actual hiring call (interview_stage -> advanced,
    // the one that now walks straight into scheduling — see
    // HrApplicantsList.jsx's handleConfirmReview) — a live count off the
    // current status, not a stored/decremented counter, so reopening one
    // back to "submitted" automatically frees the slot again with no extra
    // bookkeeping anywhere.
    if (a.status === 'advanced') advancedCounts.set(a.job_id, (advancedCounts.get(a.job_id) || 0) + 1);
  }
  const data = (jobsResult.data || []).map((j) => {
    const advancedCount = advancedCounts.get(j.id) || 0;
    return {
      ...j,
      applicant_count: counts.get(j.id) || 0,
      advanced_count: advancedCount,
      positions_remaining: Math.max(0, (j.open_positions || 0) - advancedCount),
    };
  });
  return { data, error: null };
}

// Feeds the HR notification bell (HrShell.jsx) — anything published with a
// deadline in the near future, regardless of which HR screen is open.
export async function listJobsNearingDeadline() {
  const { data, error } = await supabase
    .from('job_postings')
    .select('id, title, application_deadline')
    .eq('status', 'published')
    .not('application_deadline', 'is', null);
  return { data: data || [], error };
}

export async function getJob(id) {
  const { data, error } = await supabase.from('job_postings').select('*').eq('id', id).single();
  return { data, error };
}

export async function createJob(job) {
  const { data, error } = await supabase.from('job_postings').insert(job).select().single();
  return { data, error };
}

export async function updateJob(id, patch) {
  const { data, error } = await supabase.from('job_postings').update(patch).eq('id', id).select().single();
  return { data, error };
}

export async function deleteJob(id) {
  const { error } = await supabase.from('job_postings').delete().eq('id', id);
  return { error };
}

export async function setJobStatus(id, status) {
  return updateJob(id, { status });
}
