import { supabase } from './supabaseClient.js';

// Shared aggregation used by both the HR Head (reports/analytics, read-only)
// and HR Personnel (operational queue + decisions) dashboards — mirrors the
// paper's Candidate Ranking module (resume_score + interview_score ->
// total_score -> ranking) and Report concepts, computed live from the
// existing tables client-side rather than a stored `results`/`report` table.
// `scored` here is also the lightweight cross-job summary HrApplicantsList.jsx
// reads for its overview table (see getScoredApplicants below).

const DAY_MS = 24 * 60 * 60 * 1000;

// Combined score = mean of resume score and interview score when both exist,
// otherwise whichever one exists, otherwise null (unranked/not yet screened) —
// identical formula HrApplicantsList.jsx uses, kept consistent so a
// candidate's rank reads the same everywhere in the app.
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

// When each application actually left "submitted" — i.e. passed initial
// screening, whether HR advanced it to interview_stage, HR declined it
// straight from the resume stage, or quick-apply auto-advanced it. Prefers
// the real decision_log timestamp (covers every *manual* HR action —
// updateApplicationStatus in src/lib/applications.js logs every one), falls
// back to interview_stage_at (the one path that never logs a decision:
// quick-apply's own auto-advance, see supabase/functions/quick-apply), and
// created_at as a last resort so a row is never silently dropped from the
// trend just because neither of those was ever set.
function passedScreeningAt(application, decisionLogByApp) {
  return decisionLogByApp.get(application.id) || application.interview_stage_at || application.created_at;
}

async function loadRaw() {
  const [jobsRes, appsRes, resumeEvalRes, responsesRes, interviewEvalRes, hrRes, decisionLogRes] = await Promise.all([
    supabase.from('job_postings').select('*').order('created_at', { ascending: false }),
    supabase.from('applications').select('id, job_id, full_name, email, status, skills, created_at, scheduled_interview_at, interview_stage_at'),
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
      scheduledInterviewAt: a.scheduled_interview_at,
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

// Uneven on purpose, and deliberately coarse. A sub-threshold score isn't
// just rare here, it's structurally unreachable: JobDetails.jsx's "Apply
// Now" button only ever renders when matchState.qualifies (score >= the
// job's effective minimum, same >= check JobMatches.jsx uses to decide what
// even shows up as a match) — quickApply() has exactly one caller in the
// whole client, that same gated button. There's no path in the app for an
// applicant to submit an application below the threshold, so a bucket
// implying that's a normal, expected category would be actively misleading.
// The lowest bucket's floor is still 0 (not the threshold itself) purely as
// a safety net for real but rare historical drift — a job's own
// min_resume_match_percent override can be edited *after* applications
// already exist against it, which could leave an old application reading
// below a since-raised bar; this still counts that application rather than
// silently dropping it, it just doesn't get its own misleading row. Order
// matters (drives left-to-right rendering); count stays 0 rather than being
// omitted when a bucket is empty, so the chart doesn't silently skip a range.
const SCORE_BUCKETS = [
  { label: 'Borderline (up to 69%)', min: 0, max: 69 },
  { label: 'Strong (70-89%)', min: 70, max: 89 },
  { label: 'Excellent (90-100%)', min: 90, max: 100 },
];

function buildScoreDistribution(scores) {
  return SCORE_BUCKETS.map((b) => ({
    label: b.label,
    count: scores.filter((s) => s >= b.min && s <= b.max).length,
  }));
}

// Same idea as buildWeeklyVolume below, but bucketed across an arbitrary
// [from, to] span instead of a fixed "last 8 weeks ending now" — used when
// HR Head has an explicit report period selected, where a chart still
// anchored to today would be misleading (e.g. picking "Last Month" should
// show that month's weeks, not today's).
function buildRangeVolume(timestamps, from, to) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59`).getTime();
  const weeks = Math.max(1, Math.ceil((end - start + 1) / (7 * DAY_MS)));
  const buckets = [];
  for (let i = 0; i < weeks; i += 1) {
    const bucketStart = start + i * 7 * DAY_MS;
    const bucketEnd = Math.min(bucketStart + 7 * DAY_MS, end + 1);
    const count = timestamps.filter((t) => {
      const time = new Date(t).getTime();
      return time >= bucketStart && time < bucketEnd;
    }).length;
    buckets.push({ label: new Date(bucketStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
  }
  return buckets;
}

// Weekly application volume for the last `weeks` weeks (oldest first, so a
// chart reads left-to-right as time moving forward) — the one thing a real
// trend/line-style chart actually needs that a single before/after
// percentage (weekTrend, above) can't provide. Empty weeks stay in the
// output at 0 rather than being skipped, same reasoning as SCORE_BUCKETS:
// a chart's time axis shouldn't silently skip a week just because nothing
// happened in it.
function buildWeeklyVolume(timestamps, weeks = 8) {
  const now = Date.now();
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = now - i * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    const count = timestamps.filter((t) => {
      const time = new Date(t).getTime();
      return time >= start && time < end;
    }).length;
    buckets.push({ label: new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
  }
  return buckets;
}

// Classic recruiting cycle-time metric — calendar days from an applicant's
// submission to HR's final call. Only counts applications that actually
// reached advanced/declined; a still-pending application has no end date to
// measure to, so including it would understate the real average. One
// decimal place (not rounded to a whole day) since this is usually a small
// enough number that the fraction is the meaningful part of it.
// `outcomeFilter` narrows to just 'advanced' or just 'declined' — used to
// compare whether one kind of call tends to take longer than the other,
// rather than only ever seeing one blended average.
function averageTimeToDecision(scored, decisionLog, outcomeFilter = null) {
  const decidedAtByApp = new Map();
  for (const d of decisionLog) {
    if (d.status !== 'advanced' && d.status !== 'declined') continue;
    if (outcomeFilter && d.status !== outcomeFilter) continue;
    const existing = decidedAtByApp.get(d.application_id);
    if (!existing || new Date(d.decided_at) > new Date(existing)) decidedAtByApp.set(d.application_id, d.decided_at);
  }
  const days = [];
  for (const s of scored) {
    const decidedAt = decidedAtByApp.get(s.applicationId);
    if (!decidedAt) continue;
    const diff = (new Date(decidedAt).getTime() - new Date(s.createdAt).getTime()) / DAY_MS;
    if (diff >= 0) days.push(diff);
  }
  if (!days.length) return null;
  return Math.round((days.reduce((sum, d) => sum + d, 0) / days.length) * 10) / 10;
}

// Applicants whose video interview just finished (every question answered
// AND AI-evaluated) — ready for HR to look at, most-recently-finished first.
// Deliberately not "scheduled" or "live" anything: interviews here are
// pre-recorded on the applicant's own time, not a real-time call HR joins.
function buildRecentInterviews(scored, limit = 5) {
  return scored
    .filter((s) => s.interviewCompleted)
    .map((s) => {
      const evaluatedTimestamps = s.interviewAnswers.map((a) => a.evaluation?.evaluated_at).filter(Boolean);
      const completedAt = evaluatedTimestamps.length ? evaluatedTimestamps.sort().at(-1) : null;
      return { ...s, interviewEvaluatedAt: completedAt };
    })
    .filter((s) => s.interviewEvaluatedAt)
    .sort((a, b) => new Date(b.interviewEvaluatedAt) - new Date(a.interviewEvaluatedAt))
    .slice(0, limit);
}

function inRange(iso, from, to) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

// `{ from, to }` — 'YYYY-MM-DD' strings, either or both omitted for an
// unbounded side. Scopes the whole report to the cohort of applicants who
// *applied* within that window (applications.created_at is the single
// anchor timestamp) — resume/interview scores, sentiment, and decision
// counts all narrow to that same cohort so every number on the page is
// talking about the same group of people. Week-over-week `trends` are
// dropped entirely for a custom range (comparing "this week" is meaningless
// once HR Head is looking at, say, last month specifically).
//
// `category` — a job_postings.category value, or omitted/'all' for every
// category. Narrows the *entire* report the same way `from`/`to` does,
// including `jobStats` and `jobBreakdown` (unlike the date range, a category
// filter genuinely does mean something for "how many postings currently
// exist" — it's "how many postings currently exist in this category"). The
// returned `allCategories` list is always the full, unfiltered set of
// options, independent of which one (if any) is currently selected.
export async function getHeadOverview({ from, to, category } = {}) {
  const raw = await loadRaw();
  if (raw.error) return { error: raw.error };
  const { hrPersonnel } = raw;
  const hasRange = Boolean(from || to);
  const hasCategory = Boolean(category && category !== 'all');

  // Computed from the full, unfiltered job list (not the `jobs` below, which
  // narrows to the selected category) — the report's own category dropdown
  // needs every option to stay available regardless of which one is
  // currently selected, or picking a category would collapse the list down
  // to just that one entry and make it impossible to pick a different one.
  const allCategories = [...new Set(raw.jobs.map((j) => j.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const jobs = hasCategory ? raw.jobs.filter((j) => j.category === category) : raw.jobs;
  const jobIdsInCategory = hasCategory ? new Set(jobs.map((j) => j.id)) : null;

  let applications = hasRange ? raw.applications.filter((a) => inRange(a.created_at, from, to)) : raw.applications;
  let scored = hasRange ? raw.scored.filter((s) => inRange(s.createdAt, from, to)) : raw.scored;
  if (hasCategory) {
    applications = applications.filter((a) => jobIdsInCategory.has(a.job_id));
    scored = scored.filter((s) => jobIdsInCategory.has(s.jobId));
  }
  const scoredIds = new Set(scored.map((s) => s.applicationId));
  const resumeEvaluations = hasRange ? raw.resumeEvaluations.filter((e) => scoredIds.has(e.application_id)) : raw.resumeEvaluations;
  const interviewEvaluations = hasRange ? raw.interviewEvaluations.filter((e) => scoredIds.has(e.application_id)) : raw.interviewEvaluations;
  const decisionLog = hasRange ? raw.decisionLog.filter((d) => scoredIds.has(d.application_id)) : raw.decisionLog;

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
  const interviewScoreDistribution = buildScoreDistribution(scored.map((s) => s.interviewScore).filter((n) => n != null));

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

  const trends = hasRange
    ? { applicants: null, resumeScreened: null, interviewsCompleted: null }
    : {
        applicants: weekTrend(applications.map((a) => a.created_at)),
        resumeScreened: weekTrend(resumeEvaluations.map((e) => e.evaluated_at)),
        interviewsCompleted: weekTrend(interviewEvaluations.map((e) => e.evaluated_at)),
      };

  const weeklyApplications = hasRange
    ? buildRangeVolume(applications.map((a) => a.created_at), from, to)
    : buildWeeklyVolume(applications.map((a) => a.created_at));

  // System-wide final-call breakdown — "pending" covers anything HR hasn't
  // made a final advanced/declined call on yet (submitted or interview_stage),
  // separate from the per-job pipeline stages above, which track how far
  // along each application is rather than its eventual outcome.
  const decisionOutcomes = {
    advanced: applications.filter((a) => a.status === 'advanced').length,
    declined: applications.filter((a) => a.status === 'declined').length,
    pending: applications.filter((a) => a.status === 'submitted' || a.status === 'interview_stage').length,
  };

  // Splits the "pending" bucket above by where each application is actually
  // stuck — awaiting a first look versus already through screening and
  // waiting on HR's final call after the video interview.
  const pendingBreakdown = {
    awaitingScreening: applications.filter((a) => a.status === 'submitted').length,
    awaitingFinalDecision: applications.filter((a) => a.status === 'interview_stage').length,
  };

  const avgTimeToHire = averageTimeToDecision(scored, decisionLog);
  // Same metric, split by outcome — reveals whether advances or declines
  // tend to take systematically longer to reach.
  const avgTimeToHireByOutcome = {
    advanced: averageTimeToDecision(scored, decisionLog, 'advanced'),
    declined: averageTimeToDecision(scored, decisionLog, 'declined'),
  };
  const recentInterviews = buildRecentInterviews(scored);

  return {
    data: {
      jobStats, applicantCount: applications.length, funnel, scores, sentiment,
      topCandidates, jobBreakdown, hrActivity, trends,
      resumeScoreDistribution, interviewScoreDistribution, categoryBreakdown, weeklyApplications, decisionOutcomes,
      pendingBreakdown, avgTimeToHire, avgTimeToHireByOutcome, recentInterviews,
      range: { from: from || null, to: to || null },
      allCategories, category: hasCategory ? category : null,
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
  const { jobs, applications, interviewEvaluations, decisionLog, scored } = raw;

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

  // Earliest logged interview_stage/declined decision per application — see
  // passedScreeningAt's own comment for why this (rather than just
  // interview_stage_at alone) is the right source.
  const passedScreeningLogAt = new Map();
  for (const d of decisionLog) {
    if (d.status !== 'interview_stage' && d.status !== 'declined') continue;
    const existing = passedScreeningLogAt.get(d.application_id);
    if (!existing || new Date(d.decided_at) < new Date(existing)) passedScreeningLogAt.set(d.application_id, d.decided_at);
  }

  const trends = {
    totalApplicants: weekTrend(applications.map((a) => a.created_at)),
    videoPending: null,
    passedScreening: weekTrend(
      applications.filter((a) => a.status !== 'submitted').map((a) => passedScreeningAt(a, passedScreeningLogAt)),
    ),
    // No reliable "when this became ready-for-decision" timestamp — it's a
    // derived state (resume score + interview completion + status), not a
    // single logged event, so there's nothing honest to compare week over
    // week. Drop the trend rather than fake one.
    readyForDecision: null,
  };

  // Not capped here anymore — HrPersonnelDashboard.jsx's Hiring Progress
  // card paginates this itself (same reasoning as `recent` below), so a
  // posting past the old top-3 cutoff is still reachable, not silently gone.
  const jobBreakdown = jobs.map((job) => {
    const rows = scored.filter((s) => s.jobId === job.id);
    return { job, applicantCount: rows.length, pipeline: buildPipeline(rows) };
  }).filter((j) => j.applicantCount > 0).sort((a, b) => b.applicantCount - a.applicantCount);

  // Not capped here anymore — HrPersonnelDashboard.jsx's Recent Applications
  // card paginates this itself, so a growing applicant pool gets more pages
  // instead of quietly dropping everyone past a hardcoded cutoff.
  const recent = [...scored].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Where the current applicant pool's resume scores cluster — helps HR
  // Personnel gauge their queue at a glance (mostly borderline candidates?
  // mostly strong ones?) rather than just working through it one row at a
  // time. Same bucketing as HR Head's system-wide version (buildScoreDistribution)
  // so a score bucket reads identically everywhere it appears.
  const resumeScoreDistribution = buildScoreDistribution(scored.map((s) => s.resumeScore).filter((n) => n != null));

  return {
    data: {
      kpis, trends, decidedCount,
      queue: pending,
      jobBreakdown,
      recent,
      resumeScoreDistribution,
      sentiment: (() => {
        const counts = { positive: 0, neutral: 0, negative: 0 };
        for (const e of interviewEvaluations) if (counts[e.sentiment_label] != null) counts[e.sentiment_label] += 1;
        return { ...counts, total: interviewEvaluations.length };
      })(),
    },
  };
}
