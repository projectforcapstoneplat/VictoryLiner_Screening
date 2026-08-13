import { supabase } from './supabaseClient.js';

export async function signUpApplicant({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: 'applicant', full_name: fullName },
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) return { data, error };

  // Supabase deliberately returns success (no error) when the email already
  // belongs to a confirmed account, so an attacker can't use the sign-up
  // form to enumerate registered emails. The documented way to tell the two
  // cases apart client-side is that no new identity is created for a repeat
  // email, so `identities` comes back empty on the "already exists" path.
  if (data?.user && data.user.identities?.length === 0) {
    return {
      data,
      error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists. Try signing in instead.' },
    };
  }

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

// Sends a password-reset email. Supabase redirects the link back to
// `redirectTo` with a recovery session already active — App.jsx listens for
// the PASSWORD_RECOVERY auth event and routes to the "set new password"
// screen automatically, so no token handling happens in app code.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  return { error };
}

// Only valid while the recovery session from the reset-link click is
// active (see App.jsx) — Supabase Auth itself enforces that, not this code.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}
