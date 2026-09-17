-- The Ctrl+Shift+G key-status panel is meant to work "anywhere on the site,"
-- including the Sign In page before anyone's authenticated at all -- gating
-- it behind a signed-in session (0034's original policy) defeated that. The
-- data itself was always designed to be safe either way: no key material,
-- no PII, just a generic "Key 1/2/3" label plus status/usage counts.
drop policy if exists api_key_status_select_authenticated on api_key_status;

create policy api_key_status_select_anyone on api_key_status
  for select
  to anon, authenticated
  using (true);
