// Calls the Gemini API, rotating through multiple API keys on quota
// exhaustion. GEMINI_API_KEY holds one or more comma-separated keys — add
// more (each from its own Google account/project, since Gemini's free-tier
// quota is granted per project, not per key) to extend how long a low-volume
// demo can run before hitting the free tier's daily/per-minute cap.
// Only rotates on HTTP 429 (quota exhausted) — any other failure (bad
// request, safety block, invalid key) would fail identically on every other
// key, so it returns immediately instead of burning through the whole list.
export async function callGemini(model: string, payload: unknown): Promise<{ ok: boolean; status: number; body: any }> {
  const keys = (Deno.env.get('GEMINI_API_KEY') || '').split(',').map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    return { ok: false, status: 500, body: { error: { message: 'GEMINI_API_KEY is not configured.' } } };
  }

  let last: { ok: boolean; status: number; body: any } | null = null;
  for (const key of keys) {
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
    last = { ok: false, status: res.status, body };
    if (res.status !== 429) return last;
  }
  return last!;
}
