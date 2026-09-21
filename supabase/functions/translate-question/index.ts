// Translates an interview question into Taglish (a natural Tagalog/English
// mix) so applicants more comfortable with Filipino can understand it more
// easily. Server-side because it holds the Gemini API key — never exposed
// to the browser. Any signed-in user may call this (not HR-only), since
// applicants are the ones using it from the Interview screen.
//
// When called with a `questionId`, this caches its result on
// interview_questions.question_text_taglish (migration
// 0041_interview_question_taglish_cache.sql) — shared across every
// applicant ever asked that question, not just the one who triggered this
// call. Interview.jsx prefetches every assigned question's translation up
// front, before the applicant ever starts a timed question, specifically so
// a cache miss (the real Gemini call) never happens mid-recording; a cache
// hit here returns near-instantly with no Gemini call at all.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { callGemini } from '../_shared/gemini.ts';

// Defaults to '*' for local/testing convenience; set the ALLOWED_ORIGIN secret to
// your production domain (supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com)
// once you have one, to stop other sites' browsers from being able to call this.
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

// Check https://ai.google.dev/gemini-api/docs/models for the current model list before relying on this in production.
const GEMINI_MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT =
  'You translate a single job-interview question into Taglish — a natural mix of Tagalog and English the way ' +
  'Filipinos actually speak day to day, not pure/formal Tagalog. Keep it clear and easy for a job applicant to ' +
  'understand. Return ONLY the translated question text — no quotes, no explanation, no English restatement.';

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return json({ error: 'Not authenticated.' }, 401);
    }

    const { text, questionId } = await req.json();
    if (!text?.trim()) {
      return json({ error: 'Text is required.' }, 400);
    }

    // Cache hit — every applicant asked this same question after the first
    // one gets this instantly, no Gemini call and no rate-limit cost at all.
    if (questionId) {
      const { data: cached } = await callerClient
        .from('interview_questions')
        .select('question_text_taglish')
        .eq('id', questionId)
        .maybeSingle();
      if (cached?.question_text_taglish) {
        return json({ text: cached.question_text_taglish });
      }
    }

    if (await checkRateLimit(callerClient, user.id, 'translate-question', 15, 10)) {
      return json({ error: 'Too many translation requests — please wait a few minutes and try again.' }, 429);
    }

    const { ok: geminiOk, status: geminiStatus, body: geminiBody } = await callGemini(GEMINI_MODEL, {
      contents: [{ parts: [{ text: text.trim() }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    });
    if (!geminiOk) {
      const status = geminiStatus === 429 ? 429 : 502;
      const message = geminiStatus === 429
        ? 'All configured Gemini API keys are currently rate-limited. Try again shortly.'
        : geminiBody.error?.message || 'Gemini request failed.';
      return json({ error: message }, status);
    }

    const candidate = geminiBody.candidates?.[0];
    if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
      return json({ error: `The AI declined to translate (${candidate.finishReason}).` }, 502);
    }

    const translated = candidate?.content?.parts?.[0]?.text?.trim();
    if (!translated) {
      return json({ error: 'No translation returned.' }, 502);
    }

    // Best-effort cache write — interview_questions is HR-head-write-only
    // (see 0038_interview_questions_hr_head_only.sql), so this needs the
    // service-role client even though the caller here is an applicant.
    // Awaited (rather than fire-and-forget) since an edge function's
    // isolate can be recycled the moment the response is sent, which would
    // risk dropping an un-awaited write before it actually lands; a one-time
    // cache-miss write is rare enough that this small added latency doesn't
    // matter. A failed write never fails the response itself, though — worst
    // case, the next applicant asked this question just pays for another
    // Gemini call instead of getting a cache hit.
    if (questionId) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient.from('interview_questions').update({ question_text_taglish: translated }).eq('id', questionId);
    }

    return json({ text: translated });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});
