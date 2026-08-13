import { supabase } from './supabaseClient.js';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email) {
  return EMAIL_FORMAT.test(email.trim());
}

// Delegates to the check-email edge function so the ~120k-domain disposable-
// email list stays server-side instead of bloating the client bundle every
// applicant downloads. Fails open (treats the email as fine) on network/
// server errors — a broken check shouldn't block someone from signing up.
export async function isDisposableEmail(email) {
  try {
    const { data, error } = await supabase.functions.invoke('check-email', { body: { email } });
    if (error) return false;
    return Boolean(data?.disposable);
  } catch {
    return false;
  }
}
