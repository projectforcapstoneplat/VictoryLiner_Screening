import { supabase } from './supabaseClient.js';

export async function listPublishedJobs() {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function listAllJobs() {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .order('created_at', { ascending: false });
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
