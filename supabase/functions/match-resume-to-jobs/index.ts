// Scores an applicant's standalone resume (applicant_resumes) against every
// currently published job in one pass, so "which jobs suit me" is answered
// up front instead of the applicant guessing which posting to apply to.
// Only scores jobs that don't already have a cached row in
// resume_job_matches for this applicant — keeps repeat visits cheap and
// doesn't re-burn AI quota on jobs already scored. ResumeForm.jsx clears an
// applicant's cached matches whenever they save changes, so an edited
// resume gets fresh scores the next time they view their matches.
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

// A single batch call can legitimately need many Gemini calls (one per
// unscored job) — cap how many get scored per invocation so one request
// can't burn through the whole quota if a lot of jobs are open at once.
// Any jobs left over just get picked up on the applicant's next visit.
const MAX_JOBS_PER_CALL = 15;

// Mirrors evaluate-application's schema exactly (score + explanation +
// per-criterion breakdown) — this evaluation is meant to be a full,
// HR-quality substitute for that one, not a lighter preview. When an
// applicant quick-applies to a matched job (see quick-apply/index.ts),
// this row gets copied into resume_evaluations as-is instead of paying for
// a second AI call on the exact same resume/job pair.
const EVALUATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'INTEGER', description: 'Overall match score from 0 (no fit) to 100 (excellent fit), weighted toward higher-weight criteria.' },
    explanation: { type: 'STRING', description: '2-4 sentence explanation of the score, referencing specific evidence from the resume and which criteria drove it up or down.' },
    criteriaAssessment: {
      type: 'ARRAY',
      description: 'One entry per screening criterion provided.',
      items: {
        type: 'OBJECT',
        properties: {
          keyword: { type: 'STRING' },
          weight: { type: 'INTEGER' },
          matched: { type: 'BOOLEAN', description: 'True if the resume demonstrates this, even via different wording (e.g. "obeys traffic laws" satisfies "Safe Driving").' },
          reasoning: { type: 'STRING', description: 'One short sentence citing what in the resume supports or fails this criterion.' },
        },
        required: ['keyword', 'weight', 'matched', 'reasoning'],
      },
    },
  },
  required: ['score', 'explanation', 'criteriaAssessment'],
};

const SYSTEM_PROMPT =
  'You are an HR job-matching assistant for a bus transportation company. You are given one applicant\'s general ' +
  'resume (not tailored to any specific job) and one open job\'s screening criteria and description. Judge how well ' +
  'the resume fits this job SEMANTICALLY: credit the applicant for expressing the same meaning in different words ' +
  '(e.g. "followed all traffic regulations" satisfies a "Safe Driving" criterion, "CPR certified" satisfies "First ' +
  'Aid"), not just literal keyword matches. Weigh higher-weight criteria more heavily in the overall score. Be ' +
  "concrete in your reasoning — cite what the resume actually says, don't just restate the criterion. If the resume " +
  'has no evidence for a criterion, say so plainly rather than guessing generously.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client scoped to the caller's own JWT — every read below goes through
    // this client, bound by the caller's own RLS grants (their own resume,
    // their own match rows).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // resume_job_matches is select/delete-only for the applicant by RLS
    // (see 0029_resume_job_matches_lockdown.sql) — writing a *score* has to
    // go through this privileged client instead, the same way quick-apply's
    // resume_evaluations write and match-job-to-resumes' writes already do.
    // Reads stay on callerClient throughout; only the actual score write
    // below is elevated.
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

    if (!callerProfile || callerProfile.role !== 'applicant') {
      return json({ error: 'Only applicants can request job matches.' }, 403);
    }

    // Generous limit — each call can itself make many Gemini calls, so this
    // bounds how often the whole batch can be kicked off, not how many jobs
    // it can score in one go (that's MAX_JOBS_PER_CALL).
    if (await checkRateLimit(callerClient, user.id, 'match-resume-to-jobs', 8, 10)) {
      return json({ error: 'Too many requests — please wait a few minutes and try again.' }, 429);
    }

    const { data: resume, error: resumeError } = await callerClient
      .from('applicant_resumes')
      .select('*')
      .eq('applicant_id', user.id)
      .maybeSingle();
    if (resumeError) {
      return json({ error: resumeError.message }, 500);
    }
    if (!resume) {
      return json({ error: 'No resume on file yet.' }, 400);
    }
    if (!resume.completed_at) {
      return json({ error: 'Please finish building your resume first.' }, 400);
    }

    const { data: jobs, error: jobsError } = await callerClient
      .from('job_postings')
      .select('*')
      .eq('status', 'published');
    if (jobsError) {
      return json({ error: jobsError.message }, 500);
    }

    const { data: existing, error: existingError } = await callerClient
      .from('resume_job_matches')
      .select('job_id')
      .eq('applicant_id', user.id);
    if (existingError) {
      return json({ error: existingError.message }, 500);
    }
    const scoredJobIds = new Set((existing ?? []).map((m) => m.job_id));
    const unscored = (jobs ?? []).filter((j) => !scoredJobIds.has(j.id)).slice(0, MAX_JOBS_PER_CALL);

    const resumeText = buildResumeText(resume);

    for (const job of unscored) {
      const { data: criteria } = await callerClient
        .from('criteria')
        .select('keyword, weight')
        .eq('job_id', job.id)
        .order('weight', { ascending: false });

      const userPrompt = buildPrompt(job, criteria ?? [], resumeText, resume);

      const { ok, body: geminiBody } = await callGemini(GEMINI_MODEL, {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: EVALUATION_SCHEMA,
        },
      });
      // Best-effort per job — one job's failure (quota, safety block, bad
      // response) shouldn't stop the rest of the batch from being scored.
      if (!ok) continue;

      const candidate = geminiBody.candidates?.[0];
      if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) continue;
      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) continue;

      try {
        const parsed = JSON.parse(text);
        const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
        await adminClient.from('resume_job_matches').upsert(
          {
            applicant_id: user.id,
            job_id: job.id,
            score,
            explanation: parsed.explanation ?? '',
            criteria_assessment: parsed.criteriaAssessment ?? [],
            model: GEMINI_MODEL,
            matched_at: new Date().toISOString(),
          },
          { onConflict: 'applicant_id,job_id' },
        );
      } catch {
        // Malformed JSON from the model — skip this job, next visit retries it.
        continue;
      }
    }

    const { data: allMatches, error: allMatchesError } = await callerClient
      .from('resume_job_matches')
      .select('*, job_postings(*)')
      .eq('applicant_id', user.id);
    if (allMatchesError) {
      return json({ error: allMatchesError.message }, 500);
    }

    return json({ matches: allMatches ?? [], scoredThisCall: unscored.length, remainingJobs: (jobs ?? []).length - scoredJobIds.size - unscored.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

// deno-lint-ignore no-explicit-any
function buildResumeText(resume: any): string {
  const parts: (string | null | undefined)[] = [];
  if (resume.skills?.length) parts.push(resume.skills.join(', '));
  for (const exp of resume.work_experience || []) {
    const dateRange = exp.startDate ? `${exp.startDate} to ${exp.endDate || 'present'}` : null;
    parts.push([exp.position, exp.company, dateRange, exp.description].filter(Boolean).join(' — '));
  }
  for (const edu of resume.education || []) {
    const year = edu.yearGraduated ? `(${edu.yearGraduated})` : null;
    parts.push([edu.degree, edu.school, year].filter(Boolean).join(' — '));
  }
  for (const cert of resume.certifications || []) {
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
function buildPrompt(job: any, criteria: any[], resumeText: string, resume: any): string {
  const criteriaText = criteria.length
    ? criteria.map((c) => `- ${c.keyword} (weight ${c.weight}/5)`).join('\n')
    : '(No specific criteria defined — evaluate general fit against the job description and qualifications below.)';

  const totalYears = computeYearsOfExperience(resume.work_experience);

  const eligibilityFacts: string[] = [];
  if (resume.drivers_license_type) {
    const codes = resume.drivers_license_restrictions?.length
      ? ` (Restriction Codes: ${resume.drivers_license_restrictions.join(', ')})`
      : '';
    eligibilityFacts.push(`Driver's License: ${resume.drivers_license_type}${codes}`);
  }
  if (resume.years_driving_experience != null) {
    eligibilityFacts.push(`Years of Driving Experience: ${resume.years_driving_experience}`);
  }
  if (resume.has_nbi_clearance != null) {
    eligibilityFacts.push(`NBI/Police Clearance: ${resume.has_nbi_clearance ? 'Yes' : 'No'}`);
  }
  if (resume.willing_shifting_schedule != null) {
    eligibilityFacts.push(`Willing to Work Shifting Schedule: ${resume.willing_shifting_schedule ? 'Yes' : 'No'}`);
  }
  if (resume.has_medical_certificate != null) {
    eligibilityFacts.push(`Medical/Physical Fitness Certificate: ${resume.has_medical_certificate ? 'Yes' : 'No'}`);
  }
  if (resume.education_level) {
    eligibilityFacts.push(`Highest Educational Attainment: ${resume.education_level}`);
  }
  if (resume.current_location) {
    eligibilityFacts.push(`Applicant's Current Location: ${resume.current_location}`);
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
    resume.summary ? `\nApplicant's Professional Summary:\n${resume.summary}` : null,
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
