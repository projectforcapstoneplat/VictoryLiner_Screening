import { supabase } from './supabaseClient.js';

export async function listHrPersonnel() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_active, created_at')
    .eq('role', 'hr_personnel')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function setHrPersonnelActive(id, isActive) {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id);
  return { error };
}

export async function createHrAccount({ email, password, fullName }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-hr-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ email, password, fullName }),
  });
  const body = await res.json();
  if (!res.ok) return { error: body.error || 'Failed to create HR account.' };
  return { data: body };
}
