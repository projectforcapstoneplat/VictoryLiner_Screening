// Suggests video-interview questions for a job category using Gemini, so HR
// Head starts from an AI-drafted set and edits it instead of writing
// questions from scratch. Server-side because it holds the Gemini API key —
// never exposed to the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

// Defaults to '*' for local/testing convenience; set the ALLOWED_ORIGIN secret to
// your production domain (supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com)
// once you have one, to stop other sites' browsers from being able to call this.
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check https://ai.google.dev/gemini-api/docs/models for the current model list before relying on this in production.
const GEMINI_MODEL = 'gemini-3.6-flash';

const QUESTIONS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      description: '5-8 open-ended spoken interview questions.',
      items: { type: 'STRING' },
    },
  },
  required: ['questions'],
};

const SYSTEM_PROMPT =
  'You write video-interview questions for HR at a bus transportation company, for a given job category. ' +
  'Draft 5-8 open-ended questions a candidate would answer out loud on video — each should let a candidate ' +
  'demonstrate relevant experience, judgment, or communication skills for that category. Avoid yes/no questions. ' +
  'Avoid anything about protected characteristics (age, marital status, religion, disability, etc.).';

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

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['hr_personnel', 'hr_head'].includes(callerProfile.role)) {
      return json({ error: 'Only HR can request interview question suggestions.' }, 403);
    }

    if (await checkRateLimit(callerClient, user.id, 'suggest-interview-questions', 10, 10)) {
      return json({ error: 'Too many requests — please wait a few minutes and try again.' }, 429);
    }

    const { category, jobTitle, jobDescription } = await req.json();
    if (!category?.trim()) {
      return json({ error: 'Category is required.' }, 400);
    }

    const userPrompt = [
      `Job Category: ${category}`,
      jobTitle ? `Example Job Title: ${jobTitle}` : null,
      jobDescription ? `Example Job Description: ${jobDescription}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: QUESTIONS_SCHEMA,
          },
        }),
      },
    );

    const geminiBody = await geminiRes.json();
    if (!geminiRes.ok) {
      return json({ error: geminiBody.error?.message || 'Gemini request failed.' }, 502);
    }

    const candidate = geminiBody.candidates?.[0];
    if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
      return json({ error: `The AI declined to generate suggestions (${candidate.finishReason}).` }, 502);
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      return json({ error: 'No suggestion returned.' }, 502);
    }

    const parsed = JSON.parse(text);
    return json({ questions: parsed.questions ?? [] });
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
