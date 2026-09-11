// Evaluates one recorded video interview answer using Gemini: transcribes the
// spoken response, scores its sentiment/tone and relevance to the question,
// and produces an overall score + explanation — matching the paper's Word
// Error Rate (via transcription), Sentiment Analysis, and Response Relevance
// metrics. Server-side because it holds the Gemini API key. Result is written
// to interview_evaluations so HR only pays the AI cost once per answer.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { callGemini } from '../_shared/gemini.ts';

// Defaults to '*' for local/testing convenience; set the ALLOWED_ORIGIN secret to
// your production domain (supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com)
// once you have one, to stop other sites' browsers from being able to call this.
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check https://ai.google.dev/gemini-api/docs/models for the current model list before relying on this in production.
const GEMINI_MODEL = 'gemini-3.6-flash';

const EVALUATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING', description: 'Best-effort verbatim transcript of what the applicant said.' },
    sentimentLabel: { type: 'STRING', description: 'One of: positive, neutral, negative — overall tone of the answer.' },
    sentimentScore: { type: 'INTEGER', description: '0-100, how strongly the answer expresses that tone (confidence/enthusiasm vs flat/hesitant).' },
    relevanceScore: { type: 'INTEGER', description: '0-100, how directly and appropriately the answer addresses the question asked.' },
    score: { type: 'INTEGER', description: 'Overall 0-100 score for this answer for hiring purposes, weighing relevance most heavily.' },
    explanation: { type: 'STRING', description: '2-3 sentence explanation citing specifics from what the applicant said.' },
  },
  required: ['transcript', 'sentimentLabel', 'sentimentScore', 'relevanceScore', 'score', 'explanation'],
};

const SYSTEM_PROMPT =
  'You are an HR video-interview evaluator for a bus transportation company. You are given one video of an ' +
  'applicant answering a single interview question. First transcribe their spoken answer as accurately as ' +
  'possible. Then assess the tone/sentiment of their delivery, how relevant and appropriate the content of the ' +
  'answer is to the question asked, and give an overall score for hiring purposes. Be specific in your ' +
  "explanation — cite what the applicant actually said, don't just restate the question.";

const SENTIMENT_LABELS = ['positive', 'neutral', 'negative'];

Deno.serve(async (req) => {
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

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['hr_personnel', 'hr_head'].includes(callerProfile.role)) {
      return json({ error: 'Only HR can request interview evaluations.' }, 403);
    }

    // Generous limit — this fires automatically once per un-evaluated answer
    // when HR opens a job's Applicants list, so it can legitimately burst.
    if (await checkRateLimit(callerClient, user.id, 'evaluate-interview-response', 60, 10)) {
      return json({ error: 'Too many requests — please wait a few minutes and try again.' }, 429);
    }

    const { responseId } = await req.json();
    if (!responseId) {
      return json({ error: 'responseId is required.' }, 400);
    }

    const { data: response, error: responseError } = await callerClient
      .from('interview_responses')
      .select('*, interview_questions(question_text)')
      .eq('id', responseId)
      .single();
    if (responseError || !response) {
      return json({ error: 'Interview response not found.' }, 404);
    }
    if (!response.video_path) {
      return json({ error: 'This question has not been answered yet.' }, 400);
    }

    const { data: videoBlob, error: downloadError } = await callerClient.storage
      .from('interview-videos')
      .download(response.video_path);
    if (downloadError || !videoBlob) {
      return json({ error: 'Could not download the interview video.' }, 500);
    }

    const bytes = new Uint8Array(await videoBlob.arrayBuffer());
    const base64Video = toBase64(bytes);

    const userPrompt = `Interview Question: ${response.interview_questions?.question_text ?? '(unknown question)'}`;

    const { ok: geminiOk, status: geminiStatus, body: geminiBody } = await callGemini(GEMINI_MODEL, {
      contents: [
        {
          parts: [
            { text: userPrompt },
            { inlineData: { mimeType: 'video/webm', data: base64Video } },
          ],
        },
      ],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: EVALUATION_SCHEMA,
      },
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
      return json({ error: `The AI declined to generate an evaluation (${candidate.finishReason}).` }, 502);
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      return json({ error: 'No evaluation returned.' }, 502);
    }

    const parsed = JSON.parse(text);
    const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    const sentimentLabel = SENTIMENT_LABELS.includes(parsed.sentimentLabel) ? parsed.sentimentLabel : 'neutral';

    const { data: saved, error: saveError } = await callerClient
      .from('interview_evaluations')
      .upsert(
        {
          response_id: response.id,
          application_id: response.application_id,
          transcript: parsed.transcript ?? '',
          sentiment_label: sentimentLabel,
          sentiment_score: clamp(parsed.sentimentScore),
          relevance_score: clamp(parsed.relevanceScore),
          evaluation_score: clamp(parsed.score),
          explanation: parsed.explanation ?? '',
          model: GEMINI_MODEL,
          evaluated_at: new Date().toISOString(),
        },
        { onConflict: 'response_id' },
      )
      .select()
      .single();

    if (saveError) {
      return json({ error: saveError.message }, 500);
    }

    return json({ evaluation: saved });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
