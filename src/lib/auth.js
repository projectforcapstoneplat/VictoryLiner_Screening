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

// Google is a full-page redirect away to accounts.google.com and back — the
// only survivor across that round trip is the URL, since it isn't a page
// reload of the SPA's own in-memory state (unlike email/password, which
// never navigates away). `screen`/`jobId` get baked into the redirect URL
// so App.jsx's post-redirect effect can resume exactly where the user
// clicked "Sign in with Google" instead of always landing on the homepage.
// A new Google account gets a `profiles` row automatically (see the
// `handle_new_user` trigger in 0001_init.sql), defaulting to the
// 'applicant' role — this only ever signs applicants in/up, never HR.
export async function signInWithGoogle({ screen, jobId } = {}) {
  const url = new URL(window.location.origin + window.location.pathname);
  if (screen) url.searchParams.set('screen', screen);
  if (jobId) url.searchParams.set('job', jobId);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: url.toString() },
  });
  return { error };
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
