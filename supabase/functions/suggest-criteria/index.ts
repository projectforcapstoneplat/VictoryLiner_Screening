// Suggests screening criteria (keyword/weight pairs) for a job posting using
// Gemini, so HR starts from an AI-drafted list and customizes it instead of
// writing keywords from scratch. Server-side because it holds the Gemini
// API key — never exposed to the browser.
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
const GEMINI_MODEL = 'gemini-2.5-flash';

// Gemini's schema format uses uppercase type names (its own Type enum, not
// standard lowercase JSON Schema).
const CRITERIA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    criteria: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          keyword: { type: 'STRING', description: 'A single skill, qualification, or requirement, 1-4 words.' },
          weight: { type: 'INTEGER', description: 'Importance from 1 (nice to have) to 5 (critical requirement).' },
        },
        required: ['keyword', 'weight'],
      },
    },
  },
  required: ['criteria'],
};

const SYSTEM_PROMPT =
  'You extract screening keywords for HR job postings at a bus transportation company. ' +
  'Given a job title, description, and qualifications, list 5-10 concrete keywords/skills a resume ' +
  "should be matched against, each weighted 1-5 by how critical it is to the role. Prefer specific " +
  'terms (e.g. "Defensive Driving", "Professional Driver\'s License") over generic ones (e.g. "hardworking").';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

    // Client scoped to the caller's own JWT — used only to verify who is calling.
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
      return json({ error: 'Only HR can request criteria suggestions.' }, 403);
    }

    if (await checkRateLimit(callerClient, user.id, 'suggest-criteria', 10, 10)) {
      return json({ error: 'Too many requests — please wait a few minutes and try again.' }, 429);
    }

    const { title, description, requiredQualifications, preferredQualifications } = await req.json();
    if (!title?.trim()) {
      return json({ error: 'Job title is required.' }, 400);
    }

    const userPrompt = [
      `Job Title: ${title}`,
      description ? `Description: ${description}` : null,
      requiredQualifications ? `Required Qualifications: ${requiredQualifications}` : null,
      preferredQualifications ? `Preferred Qualifications: ${preferredQualifications}` : null,
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
            responseSchema: CRITERIA_SCHEMA,
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
    return json({ criteria: parsed.criteria ?? [] });
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
