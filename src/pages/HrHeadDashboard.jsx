// HR Head landing screen — per the capstone paper's scope section, the HR
// Head "monitors HR personnel activities and recruitment progress" and
// "views recruitment reports, analytics, and overall system performance"
// rather than managing individual applicant records directly. This page is
// that reporting/oversight surface — no advance/decline actions live here;
// that decision belongs to HrPersonnelDashboard.jsx per the paper's role split.
import { useEffect, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { KpiCard } from '../components/dashboard/KpiCard/KpiCard.jsx';
import { PipelineBar } from '../components/dashboard/PipelineBar/PipelineBar.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { getHeadOverview } from '../lib/reports.js';
import { getScreeningSettings, updateMinResumeMatchPercent, updateInterviewQuestionCount } from '../lib/screeningSettings.js';
import { SentimentBar, HorizontalBarChart } from '../components/dashboard/charts/DashboardCharts.jsx';

const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const KPI_ICONS = {
  users: <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 4.7a3.5 3.5 0 0 1 0 6.6" /><path d="M20 20a6.5 6.5 0 0 0-4-6" /></svg>,
  briefcase: <svg {...ICON_PROPS}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  doc: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></svg>,
  video: <svg {...ICON_PROPS}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>,
};

const RANK_ACCENT = ['#d4af37', '#9aa0a6', '#b56a3f']; // gold / silver / bronze — 4th+ stays plain

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

const STATUS_META = {
  published: { label: 'Published', color: '#0ca30c' },
  draft: { label: 'Draft', color: 'var(--gray-500)' },
  closed: { label: 'Closed', color: 'var(--red-700)' },
};

const DECISION_ROW_META = {
  interview_stage: { label: 'Interview', bg: '#fff4e0', fg: '#c98500' },
  advanced: { label: 'Advanced', bg: '#e3f6e6', fg: '#0ca30c' },
  declined: { label: 'Declined', bg: 'var(--pink-100)', fg: 'var(--red-700)' },
};

const RANK_BY_OPTIONS = [
  { value: 'total', label: 'Overall Score' },
  { value: 'resume', label: 'Resume Score' },
  { value: 'interview', label: 'Interview Score' },
];

function scoreFor(candidate, rankBy) {
  if (rankBy === 'resume') return candidate.resumeScore;
  if (rankBy === 'interview') return candidate.interviewScore;
  return candidate.totalScore;
}

function SectionCard({ title, subtitle, action, children, delay = 0 }) {
  return (
    <Reveal delay={delay} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <strong style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-display)' }}>{title}</strong>
          {subtitle && <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </Reveal>
  );
}

function CandidateRow({ rank, candidate, rankBy, onView }) {
  const accent = RANK_ACCENT[rank - 1];
  const primaryScore = scoreFor(candidate, rankBy);
  return (
    <div
      onClick={onView}
      className="hover-lift"
      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 8px', borderTop: rank === 1 ? 'none' : '1px solid var(--border-hairline)', cursor: 'pointer', borderRadius: 8 }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: accent ? '#fff' : 'var(--text-primary)', background: accent || 'var(--surface-page-alt)',
      }}>
        {rank}
      </div>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--text-xs)', fontWeight: 700, color: '#fff', background: 'var(--action-primary-bg)',
      }}>
        {initials(candidate.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.name}</div>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>{candidate.job?.title || 'Unknown role'}</div>
      </div>
      <div style={{ display: 'flex', gap: 18, fontSize: 'var(--text-xs)', flexShrink: 0 }}>
        <span title="Resume match">R {candidate.resumeScore ?? '—'}%</span>
        <span title="Interview match">I {candidate.interviewScore ?? '—'}%</span>
      </div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, minWidth: 56, textAlign: 'right', flexShrink: 0 }}>{primaryScore}%</div>
    </div>
  );
}

// Interviews here are pre-recorded on the applicant's own time, not a
// real-time call HR joins — "recently completed" (finished + AI-evaluated),
// not "scheduled" or "live," to keep that distinction honest.
function RecentInterviewRow({ candidate, isFirst, onView }) {
  return (
    <div onClick={onView} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 8px', borderTop: isFirst ? 'none' : '1px solid var(--border-hairline)', cursor: 'pointer', borderRadius: 8 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--text-xs)', fontWeight: 700, color: '#fff', background: 'var(--action-primary-bg)',
      }}>
        {initials(candidate.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.name}</div>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>{candidate.job?.title || 'Unknown role'}</div>
      </div>
      <span style={{ fontSize: 'var(--text-xs)', opacity: 0.55, flexShrink: 0, whiteSpace: 'nowrap' }}>{new Date(candidate.interviewEvaluatedAt).toLocaleDateString()}</span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, flexShrink: 0, minWidth: 44, textAlign: 'right' }}>{candidate.interviewScore != null ? `${candidate.interviewScore}%` : '—'}</span>
    </div>
  );
}

// Two-row comparison of average days-to-decision for advanced vs. declined
// outcomes. Kept separate from HorizontalBarChart because its values are
// fractional days rather than whole counts, and either side can be null
// (no decisions of that kind yet) — a state HorizontalBarChart's
// count-based empty check doesn't represent correctly.
function TimeToHireByOutcome({ data }) {
  const rows = [
    { label: 'Advanced', value: data.advanced, color: 'var(--status-positive, #2e7d32)' },
    { label: 'Declined', value: data.declined, color: 'var(--status-negative, #c62828)' },
  ];
  if (rows.every((r) => r.value == null)) {
    return <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No applications with a final decision yet.</p>;
  }
  const max = Math.max(...rows.map((r) => r.value || 0), 0.1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 'var(--text-xs)', width: 96, flexShrink: 0, opacity: 0.7 }}>{r.label}</span>
          <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'var(--surface-page-alt)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${r.value != null ? (r.value / max) * 100 : 0}%`, borderRadius: 999, background: r.color, transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }} />
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, width: 50, textAlign: 'right', flexShrink: 0 }}>{r.value != null ? `${r.value}d` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

// Time-series get vertical bars, not horizontal ones — a left-to-right axis
// reading "oldest to newest" is the natural convention for a trend, the same
// reason line charts run left-to-right. Still bars rather than a smoothed
// line/area: weekly volume is discrete, bucketed data (see buildWeeklyVolume
// in reports.js), not a continuously-sampled quantity, so bars represent it
// more honestly than a line would.
function WeeklyTrendChart({ rows, emptyMessage }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>{emptyMessage}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
      {rows.map((r) => (
        <div key={r.label} title={`Week of ${r.label}: ${r.count} application${r.count === 1 ? '' : 's'}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>{r.count}</span>
          <div style={{
            width: '100%', maxWidth: 32, height: `${(r.count / max) * 100}%`, minHeight: r.count > 0 ? 4 : 0,
            borderRadius: '4px 4px 0 0', background: 'var(--action-primary-bg)', transition: 'height 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
          <span style={{ fontSize: 10, opacity: 0.6, whiteSpace: 'nowrap' }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// The minimum AI resume-match score an applicant needs before "Continue to
// Video Interview" unlocks on their end (see src/pages/MyApplications.jsx) —
// HR Head is the only role allowed to change it (see the RLS policy in
// supabase/migrations/0014_screening_settings.sql). Collapsed by default and
// moved to the bottom of the page — it's a rarely-touched config value, not
// something that deserves the most prominent spot on the dashboard.
function ScreeningSettingsCard({ profile }) {
  const [expanded, setExpanded] = useState(false);
  const [minPercent, setMinPercent] = useState(null);
  const [draft, setDraft] = useState('');
  const [questionCount, setQuestionCount] = useState(null);
  const [questionCountDraft, setQuestionCountDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingQuestionCount, setSavingQuestionCount] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [questionCountSavedAt, setQuestionCountSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [questionCountError, setQuestionCountError] = useState('');

  useEffect(() => {
    getScreeningSettings().then(({ data, error: err }) => {
      if (err) {
        setError(err.message || 'Failed to load screening settings.');
        return;
      }
      setMinPercent(data.min_resume_match_percent);
      setDraft(String(data.min_resume_match_percent));
      setQuestionCount(data.interview_question_count);
      setQuestionCountDraft(String(data.interview_question_count));
    });
  }, []);

  const handleSave = async () => {
    const percent = Number(draft);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      setError('Enter a whole number between 0 and 100.');
      return;
    }
    setError('');
    setSaving(true);
    const { data, error: err } = await updateMinResumeMatchPercent(percent, profile.id);
    setSaving(false);
    if (err) {
      setError(err.message || 'Failed to save.');
      return;
    }
    setMinPercent(data.min_resume_match_percent);
    setSavedAt(new Date());
  };

  const handleSaveQuestionCount = async () => {
    const count = Number(questionCountDraft);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      setQuestionCountError('Enter a whole number between 1 and 10.');
      return;
    }
    setQuestionCountError('');
    setSavingQuestionCount(true);
    const { data, error: err } = await updateInterviewQuestionCount(count, profile.id);
    setSavingQuestionCount(false);
    if (err) {
      setQuestionCountError(err.message || 'Failed to save.');
      return;
    }
    setQuestionCount(data.interview_question_count);
    setQuestionCountSavedAt(new Date());
  };

  return (
    <SectionCard
      title="Screening Settings"
      subtitle="Minimum resume match to unlock the video interview"
      action={
        <div onClick={() => setExpanded((e) => !e)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)' }}>
          {expanded ? '▲ Hide' : '▼ Show'}
        </div>
      }
    >
      {expanded && (
        <>
          {error && <p style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)', margin: 0 }}>{error}</p>}
          {minPercent == null && !error ? (
            <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6, margin: 0 }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
                Applicants need at least
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  style={{
                    width: 70, padding: '8px 10px', textAlign: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)',
                    background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)', border: 'none', borderRadius: 4, color: 'var(--text-primary)',
                  }}
                />
                % resume match to proceed to the video interview (a job posting can override this — see its edit form).
              </label>
              <Button variant="strong" size="sm" onClick={handleSave} disabled={saving || Number(draft) === minPercent}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {savedAt && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Saved.</span>}
            </div>
          )}
          {questionCountError && <p style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)', margin: '12px 0 0' }}>{questionCountError}</p>}
          {questionCount != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
                Assign
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={questionCountDraft}
                  onChange={(e) => setQuestionCountDraft(e.target.value)}
                  style={{
                    width: 60, padding: '8px 10px', textAlign: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)',
                    background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)', border: 'none', borderRadius: 4, color: 'var(--text-primary)',
                  }}
                />
                video interview question{Number(questionCountDraft) === 1 ? '' : 's'} per applicant.
              </label>
              <Button variant="strong" size="sm" onClick={handleSaveQuestionCount} disabled={savingQuestionCount || Number(questionCountDraft) === questionCount}>
                {savingQuestionCount ? 'Saving…' : 'Save'}
              </Button>
              {questionCountSavedAt && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Saved.</span>}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

export function HrHeadDashboard({ nav, profile }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [rankBy, setRankBy] = useState('total');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [expandedHrId, setExpandedHrId] = useState(null);

  useEffect(() => {
    getHeadOverview().then(({ data, error: err }) => {
      if (err) setError(err.message || 'Failed to load reports.');
      else setReport(data);
    });
  }, []);

  const categories = report
    ? [...new Set(report.topCandidates.map((c) => c.job?.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    : [];
  const filteredCandidates = report
    ? report.topCandidates
        .filter((c) => categoryFilter === 'all' || c.job?.category === categoryFilter)
        .filter((c) => {
          const score = scoreFor(c, rankBy);
          return score != null && score >= scoreMin && score <= scoreMax;
        })
        .sort((a, b) => scoreFor(b, rankBy) - scoreFor(a, rankBy))
        .slice(0, 8)
    : [];

  return (
    <HrShell active="hr-dashboard" nav={nav} profile={profile}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Reveal style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 6 }}>
              Recruitment Overview
            </div>
            <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>
              {timeOfDayGreeting()}, {(profile?.full_name || profile?.email || '').split(' ')[0]}.
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · System-wide performance across every job posting.
            </p>
          </div>
          <Button variant="strong" size="sm" onClick={() => nav('hr-job-form', null)}>+ New Job Posting</Button>
        </Reveal>

        {error && <p style={{ color: 'var(--red-700)' }}>{error}</p>}
        {!report && !error && <p style={{ opacity: 0.7 }}>Loading reports…</p>}

        {report && (
          <>
            <div className="hr-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <KpiCard icon={KPI_ICONS.users} accent="red" label="Total Applicants" value={report.applicantCount} trend={report.trends.applicants} />
              <KpiCard icon={KPI_ICONS.briefcase} accent="amber" label="Published Postings" value={report.jobStats.published} trend={null} />
              <KpiCard icon={KPI_ICONS.doc} accent="green" label="Resumes Screened" value={report.scores.resumeEvaluatedCount} trend={report.trends.resumeScreened} />
              <KpiCard icon={KPI_ICONS.video} accent="violet" label="Interviews Completed" value={report.scores.interviewCompletedCount} trend={report.trends.interviewsCompleted} />
            </div>

            <div className="hr-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>
              <SectionCard title="Active in Pipeline" subtitle="Applications still awaiting a final decision" delay={0.01}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-6xl)', color: 'var(--action-primary-bg)' }}>
                    {report.decisionOutcomes.pending}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>of {report.applicantCount} total applicants</span>
                </div>
                <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-hairline)', flexWrap: 'wrap' }}>
                  {report.funnel.map((f) => (
                    <div key={f.label}>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{f.label}</div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginBottom: 10 }}>Where the pending ones are stuck</p>
                  <HorizontalBarChart
                    rows={[
                      { label: 'Screening', count: report.pendingBreakdown.awaitingScreening },
                      { label: 'Final call', count: report.pendingBreakdown.awaitingFinalDecision },
                    ]}
                    emptyMessage="Nothing pending right now."
                  />
                </div>
              </SectionCard>
              <SectionCard title="Average Time-to-Hire" subtitle="Days from application to HR's final call" delay={0.02}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-6xl)', color: 'var(--action-primary-bg)' }}>
                    {report.avgTimeToHire != null ? report.avgTimeToHire : '—'}
                  </span>
                  {report.avgTimeToHire != null && <span style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>days</span>}
                </div>
                <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
                  {report.avgTimeToHire != null
                    ? `Based on ${report.decisionOutcomes.advanced + report.decisionOutcomes.declined} application${report.decisionOutcomes.advanced + report.decisionOutcomes.declined === 1 ? '' : 's'} with a final decision.`
                    : 'No applications have reached a final decision yet.'}
                </p>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginBottom: 10 }}>Advanced vs. declined — does one take longer?</p>
                  <TimeToHireByOutcome data={report.avgTimeToHireByOutcome} />
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Recently Completed Interviews" subtitle="Video interviews finished and AI-evaluated, most recent first" delay={0.015}>
              {report.recentInterviews.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No interviews completed yet.</p>
              ) : (
                <div>
                  {report.recentInterviews.map((c, i) => (
                    <RecentInterviewRow key={c.applicationId} candidate={c} isFirst={i === 0} onView={() => c.job && nav('hr-applicant-list', c.job)} />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Applications Over Time" subtitle="Weekly volume, last 8 weeks" delay={0.02}>
              <WeeklyTrendChart rows={report.weeklyApplications} emptyMessage="No applications yet." />
            </SectionCard>

            <SectionCard title="Overall Hiring Funnel" subtitle="How applicants narrow down, across every job posting" delay={0.03}>
              <HorizontalBarChart rows={report.funnel.map((f) => ({ label: f.label, count: f.value }))} emptyMessage="No applications yet." />
            </SectionCard>

            <div className="hr-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'stretch' }}>
              <SectionCard
                title="Top Candidates"
                subtitle="Filter and rank by whichever score matters right now"
                action={categories.length > 0 && (
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{
                      fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', padding: '6px 10px', borderRadius: 8,
                      background: 'var(--surface-field)', border: 'none', color: 'var(--text-primary)',
                    }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                )}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingBottom: 14, borderBottom: '1px solid var(--border-hairline)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
                    Rank by
                    <select
                      value={rankBy}
                      onChange={(e) => setRankBy(e.target.value)}
                      style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', padding: '6px 10px', borderRadius: 8, background: 'var(--surface-field)', border: 'none', color: 'var(--text-primary)' }}
                    >
                      {RANK_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
                    Score
                    <input
                      type="number" min={0} max={100} value={scoreMin}
                      onChange={(e) => setScoreMin(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      style={{ width: 52, padding: '6px 8px', textAlign: 'center', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', background: 'var(--surface-field)', border: 'none', borderRadius: 8, color: 'var(--text-primary)' }}
                    />
                    to
                    <input
                      type="number" min={0} max={100} value={scoreMax}
                      onChange={(e) => setScoreMax(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      style={{ width: 52, padding: '6px 8px', textAlign: 'center', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', background: 'var(--surface-field)', border: 'none', borderRadius: 8, color: 'var(--text-primary)' }}
                    />
                    %
                  </label>
                </div>
                {report.topCandidates.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No fully-scored candidates yet.</p>
                ) : filteredCandidates.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No candidates match these filters.</p>
                ) : (
                  <div>
                    {filteredCandidates.map((c, i) => (
                      <CandidateRow key={c.applicationId} rank={i + 1} candidate={c} rankBy={rankBy} onView={() => c.job && nav('hr-applicant-list', c.job)} />
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Interview Sentiment" subtitle="NLP sentiment across all evaluated answers" delay={0.06}>
                <SentimentBar sentiment={report.sentiment} />
                <div style={{ display: 'flex', gap: 24, borderTop: '1px solid var(--border-hairline)', paddingTop: 16, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Avg Resume Score</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-2xl)' }}>{report.scores.avgResume != null ? `${report.scores.avgResume}%` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Avg Interview Score</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-2xl)' }}>{report.scores.avgInterview != null ? `${report.scores.avgInterview}%` : '—'}</div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="hr-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>
              <SectionCard title="Resume Score Distribution" subtitle="How applicants' AI resume scores spread out">
                <HorizontalBarChart rows={report.resumeScoreDistribution} emptyMessage="No resumes screened yet." />
              </SectionCard>
              <SectionCard title="Applications by Category" subtitle="Where interest is concentrated" delay={0.06}>
                <HorizontalBarChart rows={report.categoryBreakdown.map((c) => ({ label: c.category, count: c.count }))} emptyMessage="No applications yet." />
              </SectionCard>
            </div>

            <div className="hr-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>
              <SectionCard title="Job Postings by Status" subtitle="Published, draft, and closed">
                <HorizontalBarChart
                  rows={[
                    { label: 'Published', count: report.jobStats.published },
                    { label: 'Draft', count: report.jobStats.draft },
                    { label: 'Closed', count: report.jobStats.closed },
                  ]}
                  emptyMessage="No job postings yet."
                />
              </SectionCard>
              <SectionCard title="Overall Decision Outcomes" subtitle="Final calls across every application" delay={0.06}>
                <HorizontalBarChart
                  rows={[
                    { label: 'Advanced', count: report.decisionOutcomes.advanced },
                    { label: 'Declined', count: report.decisionOutcomes.declined },
                    { label: 'Pending', count: report.decisionOutcomes.pending },
                  ]}
                  emptyMessage="No applications yet."
                />
              </SectionCard>
            </div>

            <SectionCard title="Hiring Progress by Job" subtitle="Applications narrowing through screening, interview, and decision">
              {report.jobBreakdown.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No job postings yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {report.jobBreakdown.map(({ job, applicantCount, avgResume, avgInterview, pipeline }) => {
                    const meta = STATUS_META[job.status];
                    return (
                      <div key={job.id} style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta?.color, flexShrink: 0 }} />
                            <strong style={{ fontSize: 'var(--text-sm)' }}>{job.title}</strong>
                            <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{applicantCount} applicant{applicantCount === 1 ? '' : 's'}</span>
                            {avgResume != null && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>· avg resume {avgResume}%</span>}
                            {avgInterview != null && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>· avg interview {avgInterview}%</span>}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => nav('hr-applicant-list', job)}>View</Button>
                        </div>
                        <PipelineBar pipeline={pipeline} job={job} nav={nav} />
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="HR Personnel Activity" subtitle="Decisions made per staff member" action={<Button variant="ghost" size="sm" onClick={() => nav('hr-accounts')}>Manage</Button>}>
              {report.hrActivity.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No HR personnel accounts yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }}>
                  {report.hrActivity.map((p) => {
                    const isExpanded = expandedHrId === p.id;
                    return (
                      <div
                        key={p.id}
                        className="hover-lift"
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedHrId(isExpanded ? null : p.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedHrId(isExpanded ? null : p.id); } }}
                        style={{ border: '1px solid var(--border-hairline)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name || p.email}</div>
                            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
                              {p.lastDecidedAt ? `Last active ${new Date(p.lastDecidedAt).toLocaleDateString()}` : 'No decisions yet'}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, flexShrink: 0,
                            background: p.is_active ? 'var(--pink-100)' : 'var(--surface-page-alt)', color: p.is_active ? 'var(--red-700)' : 'var(--gray-600)',
                          }}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 'var(--text-xs)', borderTop: '1px solid var(--border-hairline)', paddingTop: 10 }}>
                          <span title="Advanced to interview stage">→ Interview {p.interviewStage}</span>
                          <span title="Advanced to final stage" style={{ color: '#0ca30c', fontWeight: 600 }}>✓ Advanced {p.advanced}</span>
                          <span title="Declined" style={{ color: 'var(--red-700)', fontWeight: 600 }}>✕ Declined {p.declined}</span>
                        </div>
                        {p.jobsPosted > 0 && (
                          <div style={{ fontSize: 'var(--text-xs)', opacity: 0.55 }}>{p.jobsPosted} posting{p.jobsPosted === 1 ? '' : 's'} created</div>
                        )}
                        {p.decisionsTotal > 0 && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-link)' }}>{isExpanded ? '▲ Hide recent decisions' : '▼ Show recent decisions'}</div>
                        )}
                        {isExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-hairline)', paddingTop: 10 }} onClick={(e) => e.stopPropagation()}>
                            {p.recentDecisions.length === 0 ? (
                              <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, margin: 0 }}>No decisions yet.</p>
                            ) : (
                              p.recentDecisions.map((d) => {
                                const meta = DECISION_ROW_META[d.status] || DECISION_ROW_META.interview_stage;
                                return (
                                  <div
                                    key={`${d.applicationId}-${d.decidedAt}`}
                                    onClick={() => d.job && nav('hr-applicant-list', d.job)}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: d.job ? 'pointer' : 'default' }}
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.applicantName}</div>
                                      <div style={{ fontSize: 10, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.job?.title || 'Unknown role'} · {new Date(d.decidedAt).toLocaleDateString()}</div>
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, flexShrink: 0, background: meta.bg, color: meta.fg }}>{meta.label}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <ScreeningSettingsCard profile={profile} />
          </>
        )}
      </div>
    </HrShell>
  );
}
export default HrHeadDashboard;
