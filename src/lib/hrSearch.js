import { supabase } from './supabaseClient.js';

// Powers the HrShell top-bar search — real results only (job titles and
// applicant names), no fabricated/decorative search results.
export async function searchHr(query) {
  const q = query.trim();
  if (q.length < 2) return { data: { jobs: [], applicants: [] } };

  const [jobsRes, appsRes] = await Promise.all([
    supabase.from('job_postings').select('id, title, category, status').ilike('title', `%${q}%`).limit(5),
    supabase.from('applications').select('id, full_name, job_id, job_postings(id, title)').ilike('full_name', `%${q}%`).limit(5),
  ]);

  return {
    data: {
      jobs: jobsRes.data || [],
      applicants: appsRes.data || [],
    },
    error: jobsRes.error || appsRes.error,
  };
}
