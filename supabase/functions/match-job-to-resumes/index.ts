// The other direction of match-resume-to-jobs: instead of one resume against
// every job, this scores one freshly-published job against every applicant's
// completed resume — closes the gap that "run matching once per resume"
// leaves open (a job published after an applicant's cache was already
// populated would otherwise never get scored for them). Triggered once, by
// HR, right when a job is published (see src/pages/HrDashboard.jsx) — not on
// a schedule, so it costs nothing when nothing changes. Only scores
// applicants who don't already have a cached row for this exact job, same
// "never re-score what's already known" principle as match-resume-to-jobs.
// Anyone who newly clears the threshold gets an email, honoring the promise
// already shown on JobMatches.jsx ("We'll email you the moment a role that
// matches you opens up").
//
// resume_job_matches is applicant-write-only by RLS (resume_job_matches_own
// in 0022_resume_job_matches.sql) — HR writing match rows on another user's
// behalf needs the service-role client for that, same reasoning as
// quick-apply's resume_evaluations write.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { callGemini } from '../_shared/gemini.ts';
import { sendEmail } from '../_shared/mailer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-3.6-flash';

// One publish can in principle need to score every applicant who's ever
// completed a resume — cap it per invocation so a large applicant pool can't
// blow through the function's execution time or the AI quota in one go.
// Anyone left uncapped simply won't be notified for this posting — the
// trade-off is scoped to "very high applicant volume," not normal use.
const MAX_RESUMES_PER_CALL = 20;

// Resumes are scored in batches of this size per Gemini call instead of one
// call per resume — same AI evaluation (still one model judgment per
// applicant, still fully semantic), just fewer round trips, since Gemini's
// free-tier quota is metered per-request (RPD), not per-applicant-evaluated.
// 5 keeps a single batch's prompt small enough to stay well inside the
// per-request token limit while still cutting call volume 5x.
const BATCH_SIZE = 5;

const BATCH_EVALUATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    results: {
      type: 'ARRAY',
      description: 'Exactly one entry per applicant provided below, matched back by applicantIndex — order does not matter.',
      items: {
        type: 'OBJECT',
        properties: {
          applicantIndex: { type: 'INTEGER', description: 'The Applicant N number (from "=== Applicant N ===") this result is for.' },
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
                matched: { type: 'BOOLEAN', description: 'True if the resume demonstrates this, even via different wording.' },
                reasoning: { type: 'STRING', description: 'One short sentence citing what in the resume supports or fails this criterion.' },
              },
              required: ['keyword', 'weight', 'matched', 'reasoning'],
            },
          },
        },
        required: ['applicantIndex', 'score', 'explanation', 'criteriaAssessment'],
      },
    },
  },
  required: ['results'],
};

const SYSTEM_PROMPT =
  'You are an HR job-matching assistant for a bus transportation company. You are given one applicant\'s general ' +
  'resume (not tailored to any specific job) and one open job\'s screening criteria and description. Judge how well ' +
  'the resume fits this job SEMANTICALLY: credit the applicant for expressing the same meaning in different words ' +
  '(e.g. "followed all traffic regulations" satisfies a "Safe Driving" criterion, "CPR certified" satisfies "First ' +
  'Aid"), not just literal keyword matches. Weigh higher-weight criteria more heavily in the overall score. Be ' +
  "concrete in your reasoning — cite what the resume actually says, don't just restate the criterion. If the resume " +
  'has no evidence for a criterion, say so plainly rather than guessing generously. The score must be driven ' +
  'entirely by the weighted Screening Criteria listed below — general background facts (current location, highest ' +
  'educational attainment, driving/work eligibility) are context only, not scoring criteria in themselves. Do not ' +
  'award points for having a degree, living near the job\'s location, or holding a license/clearance unless a ' +
  'specific listed criterion actually asks for that. When judging whether experience satisfies a listed criterion, ' +
  'weigh how CENTRAL that skill actually was to the applicant\'s role, not merely whether something similar is ' +
  'mentioned. A role where the skill was the core function (e.g. a retail cashier or call center agent, for a ' +
  '"customer service experience" criterion) deserves strong credit even though the industry differs. A role where ' +
  'a similar-sounding activity was only a minor, incidental part of a fundamentally different, specialized job ' +
  '(e.g. a veterinary technician occasionally reassuring pet owners, an engineer occasionally emailing clients) ' +
  'deserves meaningfully less credit for that same criterion — not zero, but say explicitly in your explanation ' +
  'that it was incidental, not their core function, rather than treating brief exposure as full satisfaction of ' +
  'the criterion. You may be given several applicants to evaluate against this same job in one request — judge ' +
  'each one entirely independently and on their own merits against the criteria; never compare, rank, or curve ' +
  'applicants against each other.';

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
      return json({ error: 'Only HR can trigger this.' }, 403);
    }

    if (await checkRateLimit(callerClient, user.id, 'match-job-to-resumes', 20, 10)) {
      return json({ error: 'Too many requests — please wait a few minutes and try again.' }, 429);
    }

    const { jobId } = await req.json();
    if (!jobId) {
      return json({ error: 'jobId is required.' }, 400);
    }

    const { data: job, error: jobError } = await callerClient
      .from('job_postings')
      .select('*')
      .eq('id', jobId)
      .single();
    if (jobError || !job) {
      return json({ error: 'Job posting not found.' }, 404);
    }

    const { data: criteria } = await callerClient
      .from('criteria')
      .select('keyword, weight')
      .eq('job_id', jobId)
      .order('weight', { ascending: false });

    const { data: settings } = await callerClient
      .from('screening_settings')
      .select('min_resume_match_percent')
      .eq('id', 1)
      .single();
    const effectiveMinPercent = job.min_resume_match_percent ?? settings?.min_resume_match_percent ?? 50;

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: resumes, error: resumesError } = await adminClient
      .from('applicant_resumes')
      .select('*')
      .not('completed_at', 'is', null);
    if (resumesError) {
      return json({ error: resumesError.message }, 500);
    }

    const { data: existing } = await adminClient
      .from('resume_job_matches')
      .select('applicant_id')
      .eq('job_id', jobId);
    const alreadyScored = new Set((existing ?? []).map((m) => m.applicant_id));
    const unscored = (resumes ?? []).filter((r) => !alreadyScored.has(r.applicant_id)).slice(0, MAX_RESUMES_PER_CALL);
    console.log(`[match-job-to-resumes] job=${jobId} totalResumes=${(resumes ?? []).length} alreadyScored=${alreadyScored.size} unscored=${unscored.length}`);

    const rawSiteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const siteUrl = rawSiteUrl && rawSiteUrl !== '*' ? rawSiteUrl : null;

    const batches: (typeof unscored)[] = [];
    for (let i = 0; i < unscored.length; i += BATCH_SIZE) batches.push(unscored.slice(i, i + BATCH_SIZE));

    // Batches run concurrently, not one at a time — each is an independent
    // Gemini call (a few seconds each), so publishing a job against a real
    // applicant pool waiting on them sequentially could take minutes; in
    // parallel it takes roughly as long as the single slowest call. Each
    // batch returns its own array of outcomes rather than mutating a shared
    // counter directly, then those get flattened and summed once every
    // batch has settled — avoids any doubt about concurrent increments.
    const batchResults = await Promise.all(batches.map(async (batch) => {
      const userPrompt = buildBatchPrompt(job, criteria ?? [], batch);

      const { ok, body: geminiBody } = await callGemini(GEMINI_MODEL, {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { responseMimeType: 'application/json', responseSchema: BATCH_EVALUATION_SCHEMA },
      });
      if (!ok) {
        console.error(`[match-job-to-resumes] Gemini batch call failed (size=${batch.length})`, JSON.stringify(geminiBody));
        return batch.map(() => ({ scored: false, notified: false }));
      }

      const candidate = geminiBody.candidates?.[0];
      if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
        console.error(`[match-job-to-resumes] bad finishReason=${candidate.finishReason} for batch (size=${batch.length})`);
        return batch.map(() => ({ scored: false, notified: false }));
      }
      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) {
        console.error(`[match-job-to-resumes] empty text for batch (size=${batch.length})`, JSON.stringify(geminiBody));
        return batch.map(() => ({ scored: false, notified: false }));
      }

      // deno-lint-ignore no-explicit-any
      let parsedResults: any[];
      try {
        parsedResults = JSON.parse(text)?.results ?? [];
      } catch (err) {
        console.error(`[match-job-to-resumes] batch parse failed (size=${batch.length})`, err instanceof Error ? err.message : err, text);
        return batch.map(() => ({ scored: false, notified: false }));
      }

      return Promise.all(batch.map(async (resume, i) => {
        const entry = parsedResults.find((r) => r.applicantIndex === i + 1);
        if (!entry) {
          console.error(`[match-job-to-resumes] no result for applicantIndex=${i + 1} (applicant=${resume.applicant_id})`);
          return { scored: false, notified: false };
        }

        const score = Math.max(0, Math.min(100, Math.round(Number(entry.score) || 0)));
        await adminClient.from('resume_job_matches').upsert(
          {
            applicant_id: resume.applicant_id,
            job_id: jobId,
            score,
            explanation: entry.explanation ?? '',
            criteria_assessment: entry.criteriaAssessment ?? [],
            model: GEMINI_MODEL,
            matched_at: new Date().toISOString(),
          },
          { onConflict: 'applicant_id,job_id' },
        );

        if (score >= effectiveMinPercent) {
          // In-website notification — same trigger point as the email
          // below, so an applicant sees "a job matches you" on their next
          // visit even if the email never arrives (spam filter, mistyped
          // address, Gmail SMTP not configured yet, etc.).
          await adminClient.from('applicant_notifications').insert({
            applicant_id: resume.applicant_id,
            job_id: jobId,
            title: `A new opening matches you — ${job.title}`,
            body: "We compared your resume against this role and it's a strong fit. Take a look and apply if you're interested.",
          });

          let notified = false;
          if (resume.email) {
            notified = await sendMatchEmail(resume.email, resume.full_name, job.title, siteUrl);
          }
          return { scored: true, notified };
        }
        return { scored: true, notified: false };
      }));
    }));

    const results = batchResults.flat();
    const scoredCount = results.filter((r) => r.scored).length;
    const notifiedCount = results.filter((r) => r.notified).length;

    return json({ scored: scoredCount, notified: notifiedCount, remaining: (resumes ?? []).length - alreadyScored.size - unscored.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

async function sendMatchEmail(
  toEmail: string,
  fullName: string | null,
  jobTitle: string,
  siteUrl: string | null,
): Promise<boolean> {
  // Same reasoning as send-status-email's link: takes the applicant straight
  // to their scored matches instead of a bare "sign in and find it yourself"
  // instruction. Falls back to plain text when ALLOWED_ORIGIN isn't set
  // (local/testing) — there's no real domain to link to in that case.
  const link = siteUrl ? `${siteUrl}/?screen=matches` : null;
  const result = await sendEmail({
    to: toEmail,
    subject: `A new opening matches you — ${jobTitle}`,
    html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
      <p>Hi ${fullName || 'there'},</p>
      <p>A new opening just went live that matches your resume: <strong>${jobTitle}</strong>.</p>
      <p>${
        link
          ? `<a href="${link}" style="color:#c0152f;font-weight:700;">Sign in to view it and apply</a>.`
          : 'Sign in to Victory Liner Careers to view it and apply.'
      }</p>
      <p style="margin-top:24px;color:#888;font-size:13px;">Victory Liner Careers</p>
    </div>`,
  });
  return result.ok;
}

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
function buildJobContext(job: any, criteria: any[]): string {
  const criteriaText = criteria.length
    ? criteria.map((c) => `- ${c.keyword} (weight ${c.weight}/5)`).join('\n')
    : '(No specific criteria defined — evaluate general fit against the job description and qualifications below.)';

  return [
    `Job Title: ${job.title}`,
    job.location ? `Job Location: ${job.location}` : null,
    job.description ? `Description: ${job.description}` : null,
    job.required_qualifications ? `Required Qualifications: ${job.required_qualifications}` : null,
    job.preferred_qualifications ? `Preferred Qualifications: ${job.preferred_qualifications}` : null,
    `\nScreening Criteria:\n${criteriaText}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// deno-lint-ignore no-explicit-any
function buildApplicantBlock(resume: any, index: number): string {
  const resumeText = buildResumeText(resume);
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
    `\n=== Applicant ${index} (applicantIndex: ${index}) ===`,
    totalYears != null ? `Total Years of Work Experience (already computed from the dates below — use this number as-is, don't recompute): ${totalYears}` : null,
    eligibilityFacts.length ? `Driving & Work Eligibility:\n${eligibilityFacts.join('\n')}` : null,
    `Resume Information:\n${resumeText || '(No skills, experience, education, or certifications provided.)'}`,
    resume.summary ? `Professional Summary:\n${resume.summary}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

// deno-lint-ignore no-explicit-any
function buildBatchPrompt(job: any, criteria: any[], batch: any[]): string {
  const jobContext = buildJobContext(job, criteria);
  const applicantBlocks = batch.map((resume, i) => buildApplicantBlock(resume, i + 1)).join('\n');
  return `${jobContext}\n\nEvaluate each of the following ${batch.length} applicant(s) independently against the SAME job above — do not compare, rank, or curve them against each other. Return one result per applicant in the "results" array, each tagged with the applicantIndex shown in its "=== Applicant N ===" header so it can be matched back.\n${applicantBlocks}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
