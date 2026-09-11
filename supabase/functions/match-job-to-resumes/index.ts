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
          matched: { type: 'BOOLEAN', description: 'True if the resume demonstrates this, even via different wording.' },
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

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Victory Liner Careers <onboarding@resend.dev>';
    const rawSiteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const siteUrl = rawSiteUrl && rawSiteUrl !== '*' ? rawSiteUrl : null;
    let scoredCount = 0;
    let notifiedCount = 0;

    for (const resume of unscored) {
      const resumeText = buildResumeText(resume);
      const userPrompt = buildPrompt(job, criteria ?? [], resumeText, resume);

      const { ok, body: geminiBody } = await callGemini(GEMINI_MODEL, {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { responseMimeType: 'application/json', responseSchema: EVALUATION_SCHEMA },
      });
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
            applicant_id: resume.applicant_id,
            job_id: jobId,
            score,
            explanation: parsed.explanation ?? '',
            criteria_assessment: parsed.criteriaAssessment ?? [],
            model: GEMINI_MODEL,
            matched_at: new Date().toISOString(),
          },
          { onConflict: 'applicant_id,job_id' },
        );
        scoredCount += 1;

        if (score >= effectiveMinPercent) {
          // In-website notification — same trigger point as the email
          // below, so an applicant sees "a job matches you" on their next
          // visit even if the email never arrives (spam filter, mistyped
          // address, RESEND_API_KEY not configured yet, etc.).
          await adminClient.from('applicant_notifications').insert({
            applicant_id: resume.applicant_id,
            job_id: jobId,
            title: `A new opening matches you — ${job.title}`,
            body: "We compared your resume against this role and it's a strong fit. Take a look and apply if you're interested.",
          });

          if (resendKey && resume.email) {
            const sent = await sendMatchEmail(resendKey, fromEmail, resume.email, resume.full_name, job.title, siteUrl);
            if (sent) notifiedCount += 1;
          }
        }
      } catch {
        continue;
      }
    }

    return json({ scored: scoredCount, notified: notifiedCount, remaining: (resumes ?? []).length - alreadyScored.size - unscored.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

async function sendMatchEmail(
  resendKey: string,
  fromEmail: string,
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
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
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
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
