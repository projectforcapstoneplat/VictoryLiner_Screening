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

// Email one-time-code sign-in — an alternative to password, not a
// replacement (Create Account still sets a password; this only signs in to
// an account that already exists). shouldCreateUser:false is the important
// part: without it, Supabase's own default behavior is to silently create a
// brand-new (passwordless) account for any email typed in here, which for
// the HR portal in particular would mean anyone could type an arbitrary
// email and get a real signed-in session (still rejected afterward by the
// HR-role check, but only after actually creating an unwanted profile row).
export async function sendSignInOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  return { error };
}

export async function verifySignInOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
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
// 'applicant' role.
//
// `hr: true` is the HR Portal's own Google button (HrLogin.jsx) — it bakes
// `?hr=1` in instead of `screen`/`jobId` so the redirect lands back on the
// hr-login screen, where App.jsx's existing role-check effects take over:
// an HR-role profile gets auto-navigated to hr-dashboard, anything else
// (a brand-new Google sign-up defaults to 'applicant', same as the public
// flow — HR accounts are never self-registered, see supabase/README.md)
// gets signed back out with an error, exactly like a rejected password
// sign-in. `hd` optionally restricts Google's own account picker to one
// Workspace domain ("through company account") when VITE_HR_GOOGLE_DOMAIN
// is set — harmless no-op if it isn't.
export async function signInWithGoogle({ screen, jobId, hr } = {}) {
  const url = new URL(window.location.origin + window.location.pathname);
  if (hr) {
    url.searchParams.set('hr', '1');
  } else {
    if (screen) url.searchParams.set('screen', screen);
    if (jobId) url.searchParams.set('job', jobId);
  }
  const hd = hr ? import.meta.env.VITE_HR_GOOGLE_DOMAIN : undefined;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: url.toString(), ...(hd ? { queryParams: { hd } } : {}) },
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
