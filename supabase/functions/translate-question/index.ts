// Translates an interview question into Taglish (a natural Tagalog/English
// mix) so applicants more comfortable with Filipino can understand it more
// easily. Server-side because it holds the Gemini API key — never exposed
// to the browser. Any signed-in user may call this (not HR-only), since
// applicants are the ones using it from the Interview screen.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT =
  'You translate a single job-interview question into Taglish — a natural mix of Tagalog and English the way ' +
  'Filipinos actually speak day to day, not pure/formal Tagalog. Keep it clear and easy for a job applicant to ' +
  'understand. Return ONLY the translated question text — no quotes, no explanation, no English restatement.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return json({ error: 'Not authenticated.' }, 401);
    }

    const { text } = await req.json();
    if (!text?.trim()) {
      return json({ error: 'Text is required.' }, 400);
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text.trim() }] }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        }),
      },
    );

    const geminiBody = await geminiRes.json();
    if (!geminiRes.ok) {
      return json({ error: geminiBody.error?.message || 'Gemini request failed.' }, 502);
    }

    const candidate = geminiBody.candidates?.[0];
    if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
      return json({ error: `The AI declined to translate (${candidate.finishReason}).` }, 502);
    }

    const translated = candidate?.content?.parts?.[0]?.text?.trim();
    if (!translated) {
      return json({ error: 'No translation returned.' }, 502);
    }

    return json({ text: translated });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
