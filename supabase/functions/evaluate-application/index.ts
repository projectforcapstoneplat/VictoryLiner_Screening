// Evaluates one applicant against a job's screening criteria using Gemini,
// so the match score reflects semantic meaning ("obeys traffic laws" counts
// for a "Safe Driving" criterion) instead of only literal keyword overlap.
// Server-side because it holds the Gemini API key — never exposed to the
// browser. Result is written to resume_evaluations so the Applicants view
// only has to call this once per applicant, not on every page load.
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

// Gemini's schema format uses uppercase type names (its own Type enum, not
// standard lowercase JSON Schema).
const EVALUATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'INTEGER', description: 'Overall match score from 0 (no fit) to 100 (excellent fit), weighted toward higher-weight criteria.' },
    explanation: { type: 'STRING', description: '2-4 sentence explanation of the score, referencing specific evidence from the applicant and which criteria drove it up or down.' },
    criteriaAssessment: {
      type: 'ARRAY',
      description: 'One entry per screening criterion provided.',
      items: {
        type: 'OBJECT',
        properties: {
          keyword: { type: 'STRING' },
          weight: { type: 'INTEGER' },
          matched: { type: 'BOOLEAN', description: 'True if the applicant demonstrates this, even via different wording (e.g. "obeys traffic laws" satisfies "Safe Driving").' },
          reasoning: { type: 'STRING', description: 'One short sentence citing what in the applicant\'s info supports or fails this criterion.' },
        },
        required: ['keyword', 'weight', 'matched', 'reasoning'],
      },
    },
  },
  required: ['score', 'explanation', 'criteriaAssessment'],
};

const SYSTEM_PROMPT =
  'You are an HR resume screener for a bus transportation company. You evaluate one applicant against a job\'s ' +
  'screening criteria and description. Judge criteria SEMANTICALLY: credit an applicant who expresses the same ' +
  'meaning in different words (e.g. "followed all traffic regulations" satisfies a "Safe Driving" criterion, ' +
  '"CPR certified" satisfies "First Aid"), not just literal keyword matches. Weigh higher-weight criteria more ' +
  'heavily in the overall score. Be concrete and specific in your reasoning — cite what the applicant actually ' +
  'wrote, don\'t just restate the criterion. If the applicant has no evidence for a criterion, say so plainly ' +
  'rather than guessing generously.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

    // Client scoped to the caller's own JWT — every read/write below goes
    // through this client, so it's bound by the caller's own RLS grants
    // (HR-only) rather than any elevated service-role access.
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
      return json({ error: 'Only HR can request applicant evaluations.' }, 403);
    }

    // Generous limit — this fires automatically once per un-evaluated
    // applicant when HR opens a job's Applicants list, so a job with many
    // applicants can legitimately trigger a burst of calls at once.
    if (await checkRateLimit(callerClient, user.id, 'evaluate-application', 60, 10)) {
      return json({ error: 'Too many requests — please wait a few minutes and try again.' }, 429);
    }

    const { applicationId } = await req.json();
    if (!applicationId) {
      return json({ error: 'applicationId is required.' }, 400);
    }

    const { data: application, error: appError } = await callerClient
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single();
    if (appError || !application) {
      return json({ error: 'Application not found.' }, 404);
    }

    const { data: job, error: jobError } = await callerClient
      .from('job_postings')
      .select('*')
      .eq('id', application.job_id)
      .single();
    if (jobError || !job) {
      return json({ error: 'Job posting not found.' }, 404);
    }

    const { data: criteria } = await callerClient
      .from('criteria')
      .select('keyword, weight')
      .eq('job_id', job.id)
      .order('weight', { ascending: false });

    const resumeText = buildResumeText(application);
    const userPrompt = buildPrompt(job, criteria ?? [], resumeText, application);

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
            responseSchema: EVALUATION_SCHEMA,
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
      return json({ error: `The AI declined to generate an evaluation (${candidate.finishReason}).` }, 502);
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      return json({ error: 'No evaluation returned.' }, 502);
    }

    const parsed = JSON.parse(text);
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));

    const { data: saved, error: saveError } = await callerClient
      .from('resume_evaluations')
      .upsert(
        {
          application_id: application.id,
          job_id: job.id,
          score,
          explanation: parsed.explanation ?? '',
          criteria_assessment: parsed.criteriaAssessment ?? [],
          model: GEMINI_MODEL,
          evaluated_at: new Date().toISOString(),
        },
        { onConflict: 'application_id' },
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

// deno-lint-ignore no-explicit-any
function buildResumeText(application: any): string {
  const parts: (string | null | undefined)[] = [];
  if (application.skills?.length) parts.push(application.skills.join(', '));
  for (const exp of application.work_experience || []) {
    const dateRange = exp.startDate ? `${exp.startDate} to ${exp.endDate || 'present'}` : null;
    parts.push([exp.position, exp.company, dateRange, exp.description].filter(Boolean).join(' — '));
  }
  for (const edu of application.education || []) {
    const year = edu.yearGraduated ? `(${edu.yearGraduated})` : null;
    parts.push([edu.degree, edu.school, year].filter(Boolean).join(' — '));
  }
  for (const cert of application.certifications || []) {
    const year = cert.year ? `(${cert.year})` : null;
    parts.push([cert.title, cert.issuer, year].filter(Boolean).join(' — '));
  }
  return parts.filter(Boolean).join('. ');
}

// Sums each entry's start/end date range in months. Not overlap-aware (two
// concurrent jobs both count in full) — an acceptable simplification since
// applicants rarely list overlapping full-time positions. LLMs are
// unreliable at date arithmetic, so this is computed in code and handed to
// the model as a fact rather than left for it to infer from raw date text.
// deno-lint-ignore no-explicit-any
function computeYearsOfExperience(workExperience: any[]): number | null {
  if (!workExperience?.length) return null;
  let totalMonths = 0;
  let hasValidRange = false;
  for (const exp of workExperience) {
    if (!exp.startDate) continue;
    const start = new Date(exp.startDate);
    const end = exp.endDate ? new Date(exp.endDate) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) continue;
    totalMonths += Math.max((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()), 0);
    hasValidRange = true;
  }
  if (!hasValidRange) return null;
  return Math.round((totalMonths / 12) * 10) / 10;
}

// deno-lint-ignore no-explicit-any
function buildPrompt(job: any, criteria: any[], resumeText: string, application: any): string {
  const criteriaText = criteria.length
    ? criteria.map((c) => `- ${c.keyword} (weight ${c.weight}/5)`).join('\n')
    : '(No specific criteria defined — evaluate general fit against the job description and qualifications below.)';

  const totalYears = computeYearsOfExperience(application.work_experience);

  const eligibilityFacts: string[] = [];
  if (application.drivers_license_type) {
    const codes = application.drivers_license_restrictions?.length
      ? ` (Restriction Codes: ${application.drivers_license_restrictions.join(', ')})`
      : '';
    eligibilityFacts.push(`Driver's License: ${application.drivers_license_type}${codes}`);
  }
  if (application.years_driving_experience != null) {
    eligibilityFacts.push(`Years of Driving Experience: ${application.years_driving_experience}`);
  }
  if (application.has_nbi_clearance != null) {
    eligibilityFacts.push(`NBI/Police Clearance: ${application.has_nbi_clearance ? 'Yes' : 'No'}`);
  }
  if (application.willing_shifting_schedule != null) {
    eligibilityFacts.push(`Willing to Work Shifting Schedule: ${application.willing_shifting_schedule ? 'Yes' : 'No'}`);
  }
  if (application.has_medical_certificate != null) {
    eligibilityFacts.push(`Medical/Physical Fitness Certificate: ${application.has_medical_certificate ? 'Yes' : 'No'}`);
  }
  if (application.education_level) {
    eligibilityFacts.push(`Highest Educational Attainment: ${application.education_level}`);
  }
  if (application.current_location) {
    eligibilityFacts.push(`Applicant's Current Location: ${application.current_location}`);
  }

  return [
    `Job Title: ${job.title}`,
    job.location ? `Job Location: ${job.location}` : null,
    job.description ? `Description: ${job.description}` : null,
    job.required_qualifications ? `Required Qualifications: ${job.required_qualifications}` : null,
    job.preferred_qualifications ? `Preferred Qualifications: ${job.preferred_qualifications}` : null,
    `\nScreening Criteria:\n${criteriaText}`,
    totalYears != null ? `\nTotal Years of Work Experience (already computed from the dates below — use this number as-is, don't recompute): ${totalYears}` : null,
    eligibilityFacts.length ? `\nDriving & Work Eligibility:\n${eligibilityFacts.join('\n')}` : null,
    `\nApplicant's Resume Information:\n${resumeText || '(No skills, experience, education, or certifications provided.)'}`,
    application.cover_note ? `\nApplicant's Cover Note:\n${application.cover_note}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
