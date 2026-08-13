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
  const [jobsRes, appsRes, resumeEvalRes, responsesRes, interviewEvalRes, hrRes, decisionLogRes] = await Promise.all([
    supabase.from('job_postings').select('*').order('created_at', { ascending: false }),
    supabase.from('applications').select('id, job_id, full_name, email, status, skills, created_at'),
    supabase.from('resume_evaluations').select('application_id, job_id, score, evaluated_at'),
    supabase.from('interview_responses').select('id, application_id, video_path, interview_questions(question_text)'),
    supabase.from('interview_evaluations').select('response_id, application_id, evaluation_score, sentiment_label, evaluated_at'),
    supabase.from('profiles').select('id, full_name, email, is_active, created_at').eq('role', 'hr_personnel'),
    supabase.from('application_decision_log').select('decided_by, status, decided_at, application_id, applications(full_name, job_id)'),
  ]);

  const error = jobsRes.error || appsRes.error || resumeEvalRes.error || responsesRes.error || interviewEvalRes.error || hrRes.error || decisionLogRes.error;
  if (error) return { error };

  const jobs = jobsRes.data || [];
  const applications = appsRes.data || [];
  const resumeEvaluations = resumeEvalRes.data || [];
  const responses = responsesRes.data || [];
  const interviewEvaluations = interviewEvalRes.data || [];
  const hrPersonnel = hrRes.data || [];
  const decisionLog = decisionLogRes.data || [];

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
      // "Ready for decision" now means the *final* call — HR already
      // advanced them past the initial resume review (status ===
      // 'interview_stage'), and their interview is complete.
      readyForDecision: resumeScore != null && interviewCompleted && a.status === 'interview_stage',
    };
  });

  return { jobs, applications, resumeEvaluations, interviewEvaluations, hrPersonnel, decisionLog, scored };
}

// 4-stage pipeline, honest mapping to what the system actually tracks:
// every application starts at "Applications"; narrows to "Screened" once the
// AI has a resume score; narrows to "Interviewed" once all 3 video answers
// are evaluated; narrows to "Decided" once HR has made the final
// advanced/declined call (not just the stage-1 advance into interview_stage).
function buildPipeline(rows) {
  return {
    applications: rows.length,
    screened: rows.filter((r) => r.resumeScore != null).length,
    interviewed: rows.filter((r) => r.interviewCompleted).length,
    decided: rows.filter((r) => r.status === 'advanced' || r.status === 'declined').length,
  };
}

// Fixed-width buckets over the 0-100 score range — used for the resume
// score distribution chart. Order matters (drives left-to-right rendering);
// count stays 0 rather than being omitted when a bucket is empty, so the
// chart's x-axis doesn't silently skip a range.
const SCORE_BUCKETS = [
  { label: '0-20%', min: 0, max: 20 },
  { label: '21-40%', min: 21, max: 40 },
  { label: '41-60%', min: 41, max: 60 },
  { label: '61-80%', min: 61, max: 80 },
  { label: '81-100%', min: 81, max: 100 },
];

function buildScoreDistribution(scores) {
  return SCORE_BUCKETS.map((b) => ({
    label: b.label,
    count: scores.filter((s) => s >= b.min && s <= b.max).length,
  }));
}

export async function getHeadOverview() {
  const raw = await loadRaw();
  if (raw.error) return { error: raw.error };
  const { jobs, applications, resumeEvaluations, interviewEvaluations, hrPersonnel, decisionLog, scored } = raw;

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

  // Unsliced — HrHeadDashboard.jsx filters by job category (if the HR Head
  // picks one) and takes the top 8 of whatever's left, so filtering doesn't
  // need a second round trip.
  const topCandidates = scored
    .filter((s) => s.totalScore != null)
    .sort((a, b) => b.totalScore - a.totalScore);

  const jobsPostedByHr = new Map();
  for (const j of jobs) {
    if (!j.created_by) continue;
    jobsPostedByHr.set(j.created_by, (jobsPostedByHr.get(j.created_by) || 0) + 1);
  }
  // What HR Personnel actually spend their time on per the paper's role
  // split — advancing/declining applicants — not job postings, which HR
  // Head just as often creates. "0 postings created" was always going to
  // read as empty/broken for a role that mostly makes decisions, not posts.
  const jobByIdForDecisions = new Map(jobs.map((j) => [j.id, j]));
  const decisionsByHr = new Map();
  for (const d of decisionLog) {
    if (!d.decided_by) continue;
    const entry = decisionsByHr.get(d.decided_by) || { advanced: 0, declined: 0, interviewStage: 0, lastDecidedAt: null, recent: [] };
    if (d.status === 'advanced') entry.advanced += 1;
    else if (d.status === 'declined') entry.declined += 1;
    else if (d.status === 'interview_stage') entry.interviewStage += 1;
    if (!entry.lastDecidedAt || new Date(d.decided_at) > new Date(entry.lastDecidedAt)) entry.lastDecidedAt = d.decided_at;
    entry.recent.push({
      applicationId: d.application_id,
      applicantName: d.applications?.full_name || 'Unknown applicant',
      job: jobByIdForDecisions.get(d.applications?.job_id),
      status: d.status,
      decidedAt: d.decided_at,
    });
    decisionsByHr.set(d.decided_by, entry);
  }
  const hrActivity = hrPersonnel.map((p) => {
    const decisions = decisionsByHr.get(p.id) || { advanced: 0, declined: 0, interviewStage: 0, lastDecidedAt: null, recent: [] };
    const recent = [...decisions.recent].sort((a, b) => new Date(b.decidedAt) - new Date(a.decidedAt)).slice(0, 8);
    return {
      ...p,
      jobsPosted: jobsPostedByHr.get(p.id) || 0,
      decisionsTotal: decisions.advanced + decisions.declined + decisions.interviewStage,
      advanced: decisions.advanced,
      declined: decisions.declined,
      interviewStage: decisions.interviewStage,
      lastDecidedAt: decisions.lastDecidedAt,
      recentDecisions: recent,
    };
  }).sort((a, b) => b.decisionsTotal - a.decisionsTotal);

  const resumeScoreDistribution = buildScoreDistribution(scored.map((s) => s.resumeScore).filter((n) => n != null));

  const categoryBreakdown = (() => {
    const byCategory = new Map();
    for (const s of scored) {
      const cat = s.job?.category || 'Uncategorized';
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
    }
    return [...byCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  })();

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
      resumeScoreDistribution, categoryBreakdown,
    },
  };
}

// Full, uncapped applicant list with every score/job field already computed
// by loadRaw() — backs the "Applicants" tab (HrApplicantsList.jsx), which
// unlike topCandidates above needs every applicant (not just the top 8
// scored ones) so HR can filter/sort the whole pool themselves.
export async function getScoredApplicants() {
  const raw = await loadRaw();
  if (raw.error) return { error: raw.error };
  return { data: { scored: raw.scored, jobs: raw.jobs } };
}

export async function getPersonnelOverview() {
  const raw = await loadRaw();
  if (raw.error) return { error: raw.error };
  const { jobs, applications, interviewEvaluations, scored } = raw;

  const pending = scored.filter((s) => s.readyForDecision).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  // "Video pending" — HR already advanced them into interview_stage, but
  // they haven't finished recording yet.
  const videoPending = scored.filter((s) => !s.interviewCompleted && s.status === 'interview_stage').length;
  const decidedCount = scored.filter((s) => s.status === 'advanced' || s.status === 'declined').length;

  const kpis = {
    totalApplicants: applications.length,
    videoPending,
    // "Passed initial screening" now means HR actually advanced them past
    // stage 1 — not just an AI score threshold, since that's HR's call to
    // make now (the AI score is one input, not the decision itself).
    passedScreening: scored.filter((s) => s.status !== 'submitted').length,
    readyForDecision: pending.length,
  };

  const trends = {
    totalApplicants: weekTrend(applications.map((a) => a.created_at)),
    videoPending: null,
    // No reliable "when HR advanced" timestamp without joining
    // application_decision_log — drop the trend rather than fake one.
    passedScreening: null,
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
