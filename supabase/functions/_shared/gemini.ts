// Calls the Gemini API, rotating through multiple API keys on quota
// exhaustion. GEMINI_API_KEY holds one or more comma-separated keys — add
// more (each from its own Google account/project, since Gemini's free-tier
// quota is granted per project, not per key) to extend how long a low-volume
// demo can run before hitting the free tier's daily/per-minute cap.
// Only rotates on HTTP 429 (quota exhausted) — any other failure (bad
// request, safety block, invalid key) would fail identically on every other
// key, so it returns immediately instead of burning through the whole list.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function callGemini(model: string, payload: unknown): Promise<{ ok: boolean; status: number; body: any }> {
  const keys = (Deno.env.get('GEMINI_API_KEY') || '').split(',').map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    return { ok: false, status: 500, body: { error: { message: 'GEMINI_API_KEY is not configured.' } } };
  }

  // So the key-status overlay can show every configured key (including ones
  // never actually exercised yet, e.g. Key 2/3 while Key 1 keeps succeeding)
  // instead of only the ones that happen to have a recorded status already.
  seedKeyLabels(keys.length).catch(() => {});

  let last: { ok: boolean; status: number; body: any } | null = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const keyLabel = `Key ${i + 1}`;
    const attempt = await fetchWithOverloadRetry(model, key, payload);
    if (attempt.ok) {
      recordKeyStatus(keyLabel, 'ok', attempt.body).catch(() => {});
      return attempt;
    }
    last = attempt;
    if (attempt.status === 429) {
      recordKeyStatus(keyLabel, 'rate_limited', attempt.body).catch(() => {});
      continue;
    }
    // A non-429 failure (bad request, safety block, invalid key) would fail
    // identically on every other key too, so this key's own status is left
    // alone rather than misreported as "rate limited."
    return last;
  }
  return last!;
}

// Gemini's own infrastructure occasionally returns 503 ("model overloaded")
// independent of any key's quota — switching keys wouldn't help, since
// they'd all hit the same overloaded model, but the overload is usually
// gone within a couple seconds. A couple of short, cheap retries on the
// SAME key resolve most of these transparently instead of failing a whole
// upload/match/evaluation over what's often a brief blip on Google's side.
const OVERLOAD_RETRY_DELAYS_MS = [800, 1600];

async function fetchWithOverloadRetry(model: string, key: string, payload: unknown): Promise<{ ok: boolean; status: number; body: any }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const body = await res.json();
    if (res.ok) return { ok: true, status: res.status, body };
    if (res.status === 503 && attempt < OVERLOAD_RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, OVERLOAD_RETRY_DELAYS_MS[attempt]));
      continue;
    }
    return { ok: false, status: res.status, body };
  }
}

// Ensures a row exists for every configured key without ever overwriting a
// real recorded status -- ignoreDuplicates makes this INSERT ... ON CONFLICT
// DO NOTHING, so a key that already has a status row (ok or rate_limited)
// keeps it untouched; only a genuinely never-seen key gets a fresh "ok" row.
async function seedKeyLabels(count: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return;
  const rows = Array.from({ length: count }, (_, i) => ({ key_label: `Key ${i + 1}`, status: 'ok' }));
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  await adminClient.from('api_key_status').upsert(rows, { onConflict: 'key_label', ignoreDuplicates: true });
}

// Best-effort, debug-only bookkeeping for the Ctrl+Shift+G key-status
// overlay on the frontend (see src/components/debug/ApiKeyMonitor) — never
// allowed to affect the actual Gemini call above, so every failure here is
// swallowed by the caller's .catch(() => {}), not surfaced or retried.
// deno-lint-ignore no-explicit-any
async function recordKeyStatus(keyLabel: string, status: 'ok' | 'rate_limited', body: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return;

  const now = new Date();
  // deno-lint-ignore no-explicit-any
  const row: Record<string, any> = {
    key_label: keyLabel,
    status,
    updated_at: now.toISOString(),
  };
  if (status === 'ok') {
    row.last_success_at = now.toISOString();
    row.retry_after = null;
  } else {
    row.limited_at = now.toISOString();
    const retryAfter = parseRetryDelay(body);
    row.retry_after = retryAfter ? retryAfter.toISOString() : null;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  await adminClient.from('api_key_status').upsert(row, { onConflict: 'key_label' });
  // Self-tracked usage count, not Google's own quota data (the API exposes
  // none) -- an atomic DB-side increment-with-daily-reset so concurrent
  // calls (parallel batches in match-resume-to-jobs, say) can't race and
  // undercount the way a read-then-write here could.
  await adminClient.rpc('increment_key_request_count', { p_key_label: keyLabel });
}

// Google's RESOURCE_EXHAUSTED errors sometimes (not always) include a
// google.rpc.RetryInfo detail with a "31s"-style delay — when present, that's
// a real, trustworthy countdown. When absent, the caller falls back to
// showing elapsed time instead of guessing, since a 429 with no retryDelay
// could be either a per-minute or a per-day limit and there's no way to tell
// which from the response alone.
// deno-lint-ignore no-explicit-any
function parseRetryDelay(body: any): Date | null {
  const details = body?.error?.details;
  if (!Array.isArray(details)) return null;
  for (const d of details) {
    if (typeof d?.retryDelay === 'string') {
      const match = d.retryDelay.match(/^([\d.]+)s$/);
      if (match) return new Date(Date.now() + parseFloat(match[1]) * 1000);
    }
  }
  return null;
}
