import { supabase } from './supabaseClient.js';

export async function submitApplication({
  jobId,
  applicantId,
  fullName,
  email,
  phone,
  workExperience,
  education,
  skills,
  certifications,
  coverNote,
}) {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_id: jobId,
      applicant_id: applicantId,
      full_name: fullName,
      email,
      phone,
      work_experience: workExperience,
      education,
      skills,
      certifications,
      cover_note: coverNote,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: { message: 'You have already applied to this job.' } };
    }
    return { error };
  }

  return { data };
}

export async function listApplicationsForJob(jobId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}