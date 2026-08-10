import { supabase } from './supabaseClient.js';

// Shared aggregation used by both the HR Head (reports/analytics, read-only)
// and HR Personnel (operational queue + decisions) dashboards — mirrors the
// paper's Candidate Ranking module (resume_score + interview_score ->
// total_score -> ranking) and Report concepts, computed live from the
// existing tables client-side rather than a stored `results`/`report` table,
// the same pattern HrApplicants.jsx already uses for its per-job ranked list.

const DAY_MS = 24 * 60 * 60 * 1000;

// Combined score = mean of resume score and interview score when both exist,
// otherwise whichever one exists, otherwise null (unranked/not yet screened) —
// identical formula to the per-job ranking in HrApplicants.jsx, kept
// consistent so a candidate's rank reads the same everywhere in the app.
function combineScore(resumeScore, interviewScore) {
  if (resumeScore != null && interviewScore != null) return Math.round((resumeScore + interviewScore) / 2);
  return resumeScore ?? interviewScore ?? null;
}

function average(nums) {
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);
}

// Real week-over-week comparison from actual created_at/evaluated_at
// timestamps — never a fabricated number. Returns null (no trend shown) when
// there's nothing in the prior window to compare against.
function weekTrend(timestamps) {
  const now = Date.now();
  const thisWeek = timestamps.filter((t) => now - new Date(t).getTime() < 7 * DAY_MS).length;
  const lastWeek = timestamps.filter((t) => {
    const age = now - new Date(t).getTime();
    return age >= 7 * DAY_MS && age < 14 * DAY_MS;
  }).length;
  if (lastWeek === 0) return thisWeek > 0 ? { direction: 'up', label: `+${thisWeek} this week` } : null;
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (pct === 0) return { direction: 'flat', label: 'steady vs last week' };
  return { direction: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : ''}${pct}% vs last week` };
}

async function loadRaw() {
  const [jobsRes, appsRes, resumeEvalRes, responsesRes, interviewEvalRes, hrRes] = await Promise.all([
    supabase.from('job_postings').select('*').order('created_at', { ascending: false }),
    supabase.from('applications').select('id, job_id, full_name, email, status, skills, created_at'),
    supabase.from('resume_evaluations').select('application_id, job_id, score, evaluated_at'),
    supabase.from('interview_responses').select('id, application_id, video_path, interview_questions(question_text)'),
    supabase.from('interview_evaluations').select('response_id, application_id, evaluation_score, sentiment_label, evaluated_at'),
    supabase.from('profiles').select('id, full_name, email, is_active, created_at').eq('role', 'hr_personnel'),
  ]);

  const error = jobsRes.error || appsRes.error || resumeEvalRes.error || responsesRes.error || interviewEvalRes.error || hrRes.error;
  if (error) return { error };

  const jobs = jobsRes.data || [];
  const applications = appsRes.data || [];
  const resumeEvaluations = resumeEvalRes.data || [];
  const responses = responsesRes.data || [];
  const interviewEvaluations = interviewEvalRes.data || [];
  const hrPersonnel = hrRes.data || [];

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const resumeEvalByApp = new Map(resumeEvaluations.map((e) => [e.application_id, e]));
  const evalByResponse = new Map(interviewEvaluations.map((e) => [e.response_id, e]));

  const responsesByApp = new Map();
  for (const r of responses) {
    if (!responsesByApp.has(r.application_id)) responsesByApp.set(r.application_id, []);
    responsesByApp.get(r.application_id).push(r);
  }

  // Per-application combined view — the basis for every aggregate below.
  const scored = applications.map((a) => {
    const resumeEval = resumeEvalByApp.get(a.id);
    const resumeScore = resumeEval?.score ?? null;
    const appResponses = responsesByApp.get(a.id) || [];
    const answered = appResponses.filter((r) => r.video_path);
    const answeredEvals = answered.map((r) => ({ response: r, evaluation: evalByResponse.get(r.id) }));
    const evaluatedAnswers = answeredEvals.filter((e) => e.evaluation);
    const interviewScore = answered.length > 0 && evaluatedAnswers.length === answered.length
      ? average(evaluatedAnswers.map((e) => e.evaluation.evaluation_score))
      : null;
    const interviewCompleted = answered.length > 0 && answered.length === appResponses.length && appResponses.length > 0;
    return {
      applicationId: a.id,
      jobId: a.job_id,
      name: a.full_name,
      email: a.email,
      skills: a.skills,
      status: a.status,
      createdAt: a.created_at,
      job: jobById.get(a.job_id),
      resumeScore,
      resumeEvaluatedAt: resumeEval?.evaluated_at ?? null,
      interviewScore,
      interviewCompleted,
      interviewAnswers: answeredEvals,
      totalScore: combineScore(resumeScore, interviewScore),
      readyForDecision: resumeScore != null && interviewCompleted && a.status === 'submitted',
    };
  });

  return { jobs, applications, resumeEvaluations, interviewEvaluations, hrPersonnel, scored };
}

// 4-stage pipeline, honest mapping to what the system actually tracks:
// every application starts at "Applications"; narrows to "Screened" once the
// AI has a resume score; narrows to "Interviewed" once all 3 video answers
// are evaluated; narrows to "Decided" once HR has advanced or declined it.
function buildPipeline(rows) {
  return {
    applications: rows.length,
    screened: rows.filter((r) => r.resumeScore != null).length,
    interviewed: rows.filter((r) => r.interviewCompleted).length,
    decided: rows.filter((r) => r.status !== 'submitted').length,
  };
}

export async function getHeadOverview() {
  const raw = await loadRaw();
  if (raw.error) return { error: raw.error };
  const { jobs, applications, resumeEvaluations, interviewEvaluations, hrPersonnel, scored } = raw;

  const jobStats = {
    total: jobs.length,
    published: jobs.filter((j) => j.status === 'published').length,
    draft: jobs.filter((j) => j.status === 'draft').length,
    closed: jobs.filter((j) => j.status === 'closed').length,
    openPositions: jobs.filter((j) => j.status === 'published').reduce((sum, j) => sum + (j.open_positions || 0), 0),
  };

  const resumeEvaluatedCount = scored.filter((s) => s.resumeScore != null).length;
  const interviewCompletedCount = scored.filter((s) => s.interviewCompleted).length;

  const funnel = [
    { label: 'Applied', value: applications.length },
    { label: 'Resume Screened', value: resumeEvaluatedCount },
    { label: 'Interview Completed', value: interviewCompletedCount },
  ];

  const scores = {
    avgResume: average(scored.map((s) => s.resumeScore).filter((n) => n != null)),
    avgInterview: average(scored.map((s) => s.interviewScore).filter((n) => n != null)),
    avgTotal: average(scored.map((s) => s.totalScore).filter((n) => n != null)),
    resumeEvaluatedCount,
    interviewCompletedCount,
  };

  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  for (const e of interviewEvaluations) {
    if (sentimentCounts[e.sentiment_label] != null) sentimentCounts[e.sentiment_label] += 1;
  }
  const sentiment = { ...sentimentCounts, total: interviewEvaluations.length };

  const topCandidates = scored
    .filter((s) => s.totalScore != null)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 8);

  const jobsPostedByHr = new Map();
  for (const j of jobs) {
    if (!j.created_by) continue;
    jobsPostedByHr.set(j.created_by, (jobsPostedByHr.get(j.created_by) || 0) + 1);
  }
  const hrActivity = hrPersonnel.map((p) => ({ ...p, jobsPosted: jobsPostedByHr.get(p.id) || 0 }));

  const jobBreakdown = jobs.map((job) => {
    const rows = scored.filter((s) => s.jobId === job.id);
    return {
      job,
      applicantCount: rows.length,
      avgResume: average(rows.map((r) => r.resumeScore).filter((n) => n != null)),
      avgInterview: average(rows.map((r) => r.interviewScore).filter((n) => n != null)),
      pipeline: buildPipeline(rows),
    };
  }).sort((a, b) => b.applicantCount - a.applicantCount);

  const trends = {
    applicants: weekTrend(applications.map((a) => a.created_at)),
    resumeScreened: weekTrend(resumeEvaluations.map((e) => e.evaluated_at)),
    interviewsCompleted: weekTrend(interviewEvaluations.map((e) => e.evaluated_at)),
  };

  return {
    data: {
      jobStats, applicantCount: applications.length, funnel, scores, sentiment,
      topCandidates, jobBreakdown, hrActivity, trends,
    },
  };
}

export async function getPersonnelOverview() {
  const raw = await loadRaw();
  if (raw.error) return { error: raw.error };
  const { jobs, applications, resumeEvaluations, interviewEvaluations, scored } = raw;

  const pending = scored.filter((s) => s.readyForDecision).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const videoPending = scored.filter((s) => !s.interviewCompleted && s.status === 'submitted').length;
  const decidedCount = scored.filter((s) => s.status !== 'submitted').length;

  const kpis = {
    totalApplicants: applications.length,
    videoPending,
    passedScreening: scored.filter((s) => s.resumeScore != null && s.resumeScore >= 50).length,
    readyForDecision: pending.length,
  };

  const trends = {
    totalApplicants: weekTrend(applications.map((a) => a.created_at)),
    videoPending: null,
    passedScreening: weekTrend(resumeEvaluations.filter((e) => e.score >= 50).map((e) => e.evaluated_at)),
    readyForDecision: null,
  };

  const jobBreakdown = jobs.map((job) => {
    const rows = scored.filter((s) => s.jobId === job.id);
    return { job, applicantCount: rows.length, pipeline: buildPipeline(rows) };
  }).filter((j) => j.applicantCount > 0).sort((a, b) => b.applicantCount - a.applicantCount).slice(0, 3);

  const recent = [...scored].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

  return {
    data: {
      kpis, trends, decidedCount,
      queue: pending,
      jobBreakdown,
      recent,
      sentiment: (() => {
        const counts = { positive: 0, neutral: 0, negative: 0 };
        for (const e of interviewEvaluations) if (counts[e.sentiment_label] != null) counts[e.sentiment_label] += 1;
        return { ...counts, total: interviewEvaluations.length };
      })(),
    },
  };
}
