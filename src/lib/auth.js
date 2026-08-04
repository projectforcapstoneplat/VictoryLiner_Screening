import { supabase } from './supabaseClient.js';

export async function signUpApplicant({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: 'applicant', full_name: fullName } },
  });
  return { data, error };
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, is_active')
    .eq('id', userId)
    .single();
  return { data, error };
}
