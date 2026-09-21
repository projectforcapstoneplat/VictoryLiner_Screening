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
import { formatWeight } from '../_shared/weightLabel.ts';
import { formatCooldownDate, getCooldownUntil } from '../_shared/declineCooldown.ts';

// Defaults to '*' for local/testing convenience; set the ALLOWED_ORIGIN secret to
// your production domain (supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com)
// once you have one, to stop other sites' browsers from being able to call this.
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

// Check https://ai.google.dev/gemini-api/docs/models for the current model list before relying on this in production.
const GEMINI_MODEL = 'gemini-3.6-flash';

// A single batch call can legitimately need many Gemini calls (one per
// unscored job) — cap how many get scored per invocation so one request
// can't burn through the whole quota if a lot of jobs are open at once.
// Any jobs left over just get picked up on the applicant's next visit.
const MAX_JOBS_PER_CALL = 15;

// Jobs are scored in batches of this size per Gemini call instead of one
// call per job — same per-job AI judgment, just fewer round trips, since
// Gemini's free-tier quota is metered per-request (RPD), not per-job-scored.
const BATCH_SIZE = 5;

// Mirrors evaluate-application's schema exactly (score + explanation +
// per-criterion breakdown) — this evaluation is meant to be a full,
// HR-quality substitute for that one, not a lighter preview. When an
// applicant quick-applies to a matched job (see quick-apply/index.ts),
// this row gets copied into resume_evaluations as-is instead of paying for
// a second AI call on the exact same resume/job pair.
const BATCH_EVALUATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    results: {
      type: 'ARRAY',
      description: 'Exactly one entry per job provided below, matched back by jobIndex — order does not matter.',
      items: {
        type: 'OBJECT',
        properties: {
          jobIndex: { type: 'INTEGER', description: 'The Job N number (from "=== Job N ===") this result is for.' },
          score: { type: 'INTEGER', description: 'Overall match score from 0 (no fit) to 100 (excellent fit), weighted toward higher-weight criteria.' },
          explanation: { type: 'STRING', description: '1-2 sentence explanation of the score, referencing specific evidence from the resume and which criteria drove it up or down.' },
          criteriaAssessment: {
            type: 'ARRAY',
            description: "One entry per that job's own screening criteria — never mix in another job's criteria.",
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
        required: ['jobIndex', 'score', 'explanation', 'criteriaAssessment'],
      },
    },
  },
  required: ['results'],
};

const SYSTEM_PROMPT =
  'You are an HR job-matching assistant for a bus transportation company, scoring one applicant\'s resume against ' +
  'one open job\'s screening criteria. Judge fit SEMANTICALLY, not by literal keywords — credit equivalent phrasing ' +
  '(e.g. "followed all traffic regulations" satisfies "Safe Driving"; "CPR certified" satisfies "First Aid"). ' +
  'Weigh higher-weight criteria more heavily in the overall score. Cite concrete resume evidence in your reasoning; ' +
  'if a criterion has no evidence, say so rather than guessing generously. Score ONLY on the weighted Screening ' +
  'Criteria — background facts (location, education level, license/clearance) are context, not points, unless a ' +
  'criterion specifically asks for them. Credit experience based on how CENTRAL the skill was to the applicant\'s ' +
  'actual role: a cashier or call-center agent gets strong credit for "customer service experience" even in a ' +
  'different industry, but a vet tech occasionally reassuring owners or an engineer occasionally emailing clients ' +
  'gets meaningfully less credit for that same criterion — say explicitly it was incidental, not zero. A skill ' +
  'listed only in the Skills section with nothing else in the resume (no work experience, description, or ' +
  'certification) backing it up is weak, self-reported evidence — don\'t award high credit for a high-weight ' +
  'criterion on that alone; note the lack of corroboration in your reasoning instead of treating the bare mention ' +
  'as proof. When scoring multiple jobs in one request, treat each fully independently: never let one job\'s ' +
  'criteria or context bleed into another\'s.';

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

    // Once HR has scheduled a personal interview off any of this applicant's
    // applications, they're already deep in an active hiring process — new
    // job matching stops making sense for them (they're not job-hunting
    // anymore) and would just spend AI quota nobody's going to act on.
    // applications' own RLS already restricts this select to the caller's
    // own rows, so callerClient is fine here, no service-role needed.
    const { data: scheduledApp } = await callerClient
      .from('applications')
      .select('id')
      .eq('applicant_id', user.id)
      .not('scheduled_interview_at', 'is', null)
      .limit(1)
      .maybeSingle();
    if (scheduledApp) {
      return json({ error: "You already have a scheduled interview — job matching is on hold while that moves forward." }, 403);
    }

    // Victory Liner HR policy: a decline on any application pauses new job
    // matching company-wide for 6 months from that decision, same reasoning
    // as the scheduled-interview pause above. application_decision_log is
    // HR-read-only by RLS, so this goes through adminClient, not callerClient.
    const cooldownUntil = await getCooldownUntil(adminClient, user.id);
    if (cooldownUntil) {
      return json({ error: `Your last application wasn't selected. New job matching is paused until ${formatCooldownDate(cooldownUntil)}.` }, 403);
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
    const resumeContext = buildResumeContext(resumeText, resume);

    // One query for every unscored job's criteria instead of one query per
    // job — also switches this off callerClient: criteria is HR-select-only
    // by RLS (criteria_select_hr in 0004_criteria.sql), so the previous
    // per-job callerClient.from('criteria') read silently came back empty
    // for every applicant caller, meaning every "Jobs That Match You" score
    // was ever only computed from the job description/qualifications text,
    // never the actual weighted screening criteria HR configured. adminClient
    // is already used for the resume_job_matches writes below, same
    // reasoning applies to this read.
    const criteriaByJob = new Map<string, { keyword: string; weight: number }[]>();
    if (unscored.length) {
      const { data: allCriteria } = await adminClient
        .from('criteria')
        .select('job_id, keyword, weight')
        .in('job_id', unscored.map((j) => j.id))
        .order('weight', { ascending: false });
      for (const c of allCriteria ?? []) {
        if (!criteriaByJob.has(c.job_id)) criteriaByJob.set(c.job_id, []);
        criteriaByJob.get(c.job_id)!.push({ keyword: c.keyword, weight: c.weight });
      }
    }

    const batches: (typeof unscored)[] = [];
    for (let i = 0; i < unscored.length; i += BATCH_SIZE) batches.push(unscored.slice(i, i + BATCH_SIZE));

    // Batches run concurrently, not one at a time — each is an independent
    // Gemini call (a few seconds each), so a first-time resume save waiting
    // on all of MAX_JOBS_PER_CALL sequentially could take well over a
    // minute; in parallel it takes roughly as long as the single slowest
    // call. Each batch only ever touches its own jobs' rows (via upsert),
    // so there's no shared-state race between them. Each job returns its
    // own true/false outcome instead of the caller just assuming every
    // unscored job succeeded — a batch that fails (quota, bad response)
    // used to still get reported as scored, silently stranding those jobs
    // with no retry until the WHOLE match cache went empty again.
    const batchResults = await Promise.all(batches.map(async (batch) => {
      const userPrompt = buildBatchPrompt(resumeContext, batch, criteriaByJob);

      const { ok, body: geminiBody } = await callGemini(GEMINI_MODEL, {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        // maxOutputTokens is a defensive ceiling, not a tuned budget — a
        // batch of BATCH_SIZE jobs' worth of scores/explanations/criteria
        // breakdowns comfortably fits well under this; it just stops a
        // batch with unusually many criteria from producing a runaway
        // response instead of failing cleanly.
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: BATCH_EVALUATION_SCHEMA,
          maxOutputTokens: 8192,
        },
      });
      // Best-effort per batch — one batch's failure (quota, safety block,
      // bad response) shouldn't stop the rest of the jobs from being scored.
      if (!ok) {
        console.error(`[match-resume-to-jobs] Gemini batch call failed (size=${batch.length})`, JSON.stringify(geminiBody));
        return batch.map(() => false);
      }

      const candidate = geminiBody.candidates?.[0];
      if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
        console.error(`[match-resume-to-jobs] bad finishReason=${candidate.finishReason} for batch (size=${batch.length})`);
        return batch.map(() => false);
      }
      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) {
        console.error(`[match-resume-to-jobs] empty text for batch (size=${batch.length})`, JSON.stringify(geminiBody));
        return batch.map(() => false);
      }

      // deno-lint-ignore no-explicit-any
      let parsedResults: any[];
      try {
        parsedResults = JSON.parse(text)?.results ?? [];
      } catch (err) {
        console.error(`[match-resume-to-jobs] batch parse failed (size=${batch.length})`, err instanceof Error ? err.message : err, text);
        return batch.map(() => false);
      }

      return Promise.all(batch.map(async (job, i) => {
        const entry = parsedResults.find((r) => r.jobIndex === i + 1);
        if (!entry) {
          console.error(`[match-resume-to-jobs] no result for jobIndex=${i + 1} (job=${job.id})`);
          return false;
        }
        const score = Math.max(0, Math.min(100, Math.round(Number(entry.score) || 0)));
        await adminClient.from('resume_job_matches').upsert(
          {
            applicant_id: user.id,
            job_id: job.id,
            score,
            explanation: entry.explanation ?? '',
            criteria_assessment: entry.criteriaAssessment ?? [],
            model: GEMINI_MODEL,
            matched_at: new Date().toISOString(),
          },
          { onConflict: 'applicant_id,job_id' },
        );
        return true;
      }));
    }));

    const scoredCount = batchResults.flat().filter(Boolean).length;

    const { data: allMatches, error: allMatchesError } = await callerClient
      .from('resume_job_matches')
      .select('*, job_postings(*)')
      .eq('applicant_id', user.id);
    if (allMatchesError) {
      return json({ error: allMatchesError.message }, 500);
    }

    return json({
      matches: allMatches ?? [],
      scoredThisCall: scoredCount,
      remainingJobs: (jobs ?? []).length - scoredJobIds.size - scoredCount,
    });
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
function buildResumeContext(resumeText: string, resume: any): string {
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
    'Applicant\'s Resume (the SAME resume applies to every job listed below):',
    totalYears != null ? `Total Years of Work Experience (already computed from the dates below — use this number as-is, don't recompute): ${totalYears}` : null,
    eligibilityFacts.length ? `Driving & Work Eligibility:\n${eligibilityFacts.join('\n')}` : null,
    `Resume Information:\n${resumeText || '(No skills, experience, education, or certifications provided.)'}`,
    resume.summary ? `Professional Summary:\n${resume.summary}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

// deno-lint-ignore no-explicit-any
function buildJobBlock(job: any, criteria: { keyword: string; weight: number }[], index: number): string {
  const criteriaText = criteria.length
    ? criteria.map((c) => `- ${c.keyword} (weight ${formatWeight(c.weight)})`).join('\n')
    : '(No specific criteria defined — evaluate general fit against the job description and qualifications below.)';

  return [
    `\n=== Job ${index} (jobIndex: ${index}) ===`,
    `Job Title: ${job.title}`,
    job.location ? `Job Location: ${job.location}` : null,
    job.description ? `Description: ${job.description}` : null,
    job.required_qualifications ? `Required Qualifications: ${job.required_qualifications}` : null,
    job.preferred_qualifications ? `Preferred Qualifications: ${job.preferred_qualifications}` : null,
    `Screening Criteria:\n${criteriaText}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// deno-lint-ignore no-explicit-any
function buildBatchPrompt(resumeContext: string, batch: any[], criteriaByJob: Map<string, { keyword: string; weight: number }[]>): string {
  const jobBlocks = batch.map((job, i) => buildJobBlock(job, criteriaByJob.get(job.id) ?? [], i + 1)).join('\n');
  return `${resumeContext}\n\nEvaluate the resume above against each of the following ${batch.length} job(s) — each job is independent, judge it only against its own criteria and description. Return one result per job in the "results" array, each tagged with the jobIndex shown in its "=== Job N ===" header so it can be matched back.\n${jobBlocks}`;
}
