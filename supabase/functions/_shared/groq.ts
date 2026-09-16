// Calls Groq's OpenAI-compatible chat completions API — used only as a
// fallback when Gemini is unavailable (see parse-resume-upload/index.ts),
// since Groq's free tier runs on entirely separate infrastructure from
// Google's, so a Gemini-side outage (503 "model overloaded") doesn't affect
// it at all. Unlike Gemini's responseSchema, Groq's JSON mode only
// guarantees syntactically valid JSON, not a specific shape — the caller is
// responsible for describing the desired fields in the prompt itself and
// validating/coercing whatever comes back.
export async function callGroq(systemPrompt: string, userPrompt: string): Promise<{ ok: boolean; status: number; text?: string; error?: string }> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    return { ok: false, status: 500, error: 'GROQ_API_KEY is not configured.' };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  // deno-lint-ignore no-explicit-any
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, status: res.status, error: body?.error?.message || `Groq request failed (${res.status}).` };
  }
  const text = body?.choices?.[0]?.message?.content;
  if (!text) {
    return { ok: false, status: 502, error: 'Empty response from Groq.' };
  }
  return { ok: true, status: res.status, text };
}
