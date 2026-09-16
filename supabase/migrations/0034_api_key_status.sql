-- Debug-only visibility into the health of the rotating GEMINI_API_KEY pool
-- (see supabase/functions/_shared/gemini.ts) -- lets the dev-facing key
-- monitor (Ctrl+Shift+K on the frontend) show which of the 3 keys are
-- currently usable vs. rate-limited, without ever exposing the actual key
-- values (only a generic "Key 1/2/3" label is ever stored here).
create table if not exists api_key_status (
  key_label text primary key,
  status text not null default 'ok' check (status in ('ok', 'rate_limited')),
  last_success_at timestamptz,
  limited_at timestamptz,
  -- Best-effort only -- Gemini doesn't always tell us how long a 429 lasts,
  -- and when it does, we still can't tell a per-minute limit from a
  -- per-day one. Null means "unknown, show elapsed time instead of a countdown."
  retry_after timestamptz,
  updated_at timestamptz not null default now()
);

alter table api_key_status enable row level security;

-- Read-only for any signed-in user -- this is operational debug info (no key
-- material, no PII), safe for either role to see while testing. Only the
-- service-role client (used server-side in gemini.ts) ever writes to it, so
-- no insert/update/delete policy is needed for clients at all.
create policy api_key_status_select_authenticated on api_key_status
  for select
  to authenticated
  using (true);
