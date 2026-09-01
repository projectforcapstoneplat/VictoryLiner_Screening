// Maps raw Supabase Auth error text into copy that actually tells someone
// what to do next — Supabase's own messages are accurate but terse
// ("Invalid login credentials" doesn't say whether it's the email, the
// password, or that there's no account at all). Falls back to the original
// message for anything not recognized, so an unmapped error still shows
// something rather than going silent.
const KNOWN_MESSAGES = [
  {
    match: /invalid login credentials/i,
    friendly: 'That email or password doesn’t match our records. Double-check for typos, or use "Forgot Password?" below if you’re not sure.',
  },
  {
    match: /email not confirmed/i,
    friendly: 'Please confirm your email first — check your inbox (and spam folder) for the confirmation link we sent.',
  },
  {
    match: /user already registered|already.*exists/i,
    friendly: 'An account with this email already exists. Try signing in instead.',
  },
  {
    match: /password should be at least/i,
    friendly: 'Your password is too short — it needs to meet the requirements below.',
  },
  {
    match: /rate limit/i,
    friendly: 'Too many attempts — please wait a moment before trying again.',
  },
  {
    match: /network|fetch failed|failed to fetch/i,
    friendly: 'Could not reach the server — check your connection and try again.',
  },
];

export function friendlyAuthError(message) {
  if (!message) return message;
  const found = KNOWN_MESSAGES.find((k) => k.match.test(message));
  return found ? found.friendly : message;
}
