// HR Personnel's operational dashboard — per the paper, HR Personnel
// "Reviews automated candidate rankings and scores... Advances or declines
// candidates based on system-generated results." This is where that
// decision actually happens (HR Head's dashboard is reports-only, no
// approve/reject — see HrHeadDashboard.jsx).
import { useEffect, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { KpiCard } from '../components/dashboard/KpiCard/KpiCard.jsx';
import { PipelineBar } from '../components/dashboard/PipelineBar/PipelineBar.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { getPersonnelOverview } from '../lib/reports.js';
import { SentimentBar, HorizontalBarChart } from '../components/dashboard/charts/DashboardCharts.jsx';
import { scoreColor as scoreTone } from '../lib/scoreTone.js';
import { DROPDOWN_ARROW_STYLE } from '../components/core/Select/Select.jsx';

const JOB_FILTER_STYLE = {
  fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', padding: '6px 26px 6px 10px', borderRadius: 999,
  background: 'var(--surface-page-alt)', border: 'none', color: 'var(--text-primary)', flexShrink: 0,
  ...DROPDOWN_ARROW_STYLE, backgroundPosition: 'right 8px center',
};

const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const KPI_ICONS = {
  users: <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 4.7a3.5 3.5 0 0 1 0 6.6" /><path d="M20 20a6.5 6.5 0 0 0-4-6" /></svg>,
  video: <svg {...ICON_PROPS}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>,
  check: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>,
  bolt: <svg {...ICON_PROPS}><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>,
};

const STATUS_META = {
  submitted: { label: 'Awaiting Review', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' },
  interview_stage: { label: 'Interview Stage', bg: '#fff4e0', fg: '#c98500' },
  advanced: { label: 'Advanced', bg: '#e3f6e6', fg: '#0ca30c' },
  declined: { label: 'Declined', bg: 'var(--pink-100)', fg: 'var(--red-700)' },
};

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

function Badge({ tone = 'neutral', children }) {
  const TONES = {
    green: { bg: '#e3f6e6', fg: '#0ca30c' },
    neutral: { bg: 'var(--surface-page-alt)', fg: 'var(--text-primary)' },
  };
  const { bg, fg } = TONES[tone];
  return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {children}
    </span>
  );
}

function SectionCard({ title, subtitle, action, children, style, delay = 0 }) {
  return (
    <Reveal delay={delay} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, ...style }}>
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

// Replaced the old one-candidate-at-a-time Advance/Decline widget that used
// to live here — it quietly duplicated the Decisions tab (built later,
// specifically to replace this exact workflow with a full ranked list HR
// can filter instead of working one row at a time), so the dashboard ended
// up with two different places to make the same kind of call. This is a
// pure pointer now: no decide buttons, just "here's how many, go there."
function ReadyForDecisionSummary({ queue, nav }) {
  if (queue.length === 0) {
    return (
      <SectionCard title="Ready for Your Decision" subtitle="Candidates who've cleared screening and are awaiting a call" action={<Badge tone="green">Up to date</Badge>}>
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No candidates waiting on a decision right now — you&rsquo;re all caught up.</p>
      </SectionCard>
    );
  }
  const preview = queue.slice(0, 3);
  return (
    <SectionCard
      title="Ready for Your Decision"
      subtitle="Candidates who've cleared screening and are awaiting a call"
      action={<Badge>{queue.length} pending</Badge>}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-6xl)', color: 'var(--action-primary-bg)' }}>{queue.length}</span>
        <span style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>waiting on an Advance/Decline call</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {preview.map((c) => (
          <div key={c.applicationId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <span style={{ fontWeight: 600 }}>{c.name}</span>
            <span style={{ opacity: 0.6 }}>{c.job?.title}</span>
          </div>
        ))}
        {queue.length > preview.length && (
          <div style={{ fontSize: 'var(--text-xs)', opacity: 0.55 }}>+{queue.length - preview.length} more</div>
        )}
      </div>
      <Button variant="strong" size="sm" onClick={() => nav('hr-decisions')}>Go to Decisions</Button>
    </SectionCard>
  );
}

// Capped to 4 rows (not the full 8 reports.js hands back) — this is a quick
// glance, not the full record; the Applicants tab is where HR actually works
// through everyone. Keeping it short is what makes a one-screen, no-scroll
// dashboard possible at all alongside everything above it.
const RECENT_APPLICATIONS_VISIBLE = 4;

function RecentApplicationsTable({ recent, nav }) {
  // Filters within the already-limited "recent" set (see the comment on
  // RECENT_APPLICATIONS_VISIBLE above) rather than querying everyone who
  // ever applied to a job — this stays a quick glance, not a search tool;
  // the Applicants tab (with its own job filter) is where HR digs into a
  // specific role's full history.
  const [jobFilter, setJobFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const jobs = [...new Set(recent.map((r) => r.job?.title).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filtered = recent
    .filter((r) => jobFilter === 'all' || r.job?.title === jobFilter)
    .filter((r) => statusFilter === 'all' || r.status === statusFilter);
  const visible = filtered.slice(0, RECENT_APPLICATIONS_VISIBLE);
  return (
    <SectionCard
      title="Recent Applications"
      subtitle="Latest candidate submissions requiring your attention"
      action={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {jobs.length > 1 && (
            <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} style={JOB_FILTER_STYLE} aria-label="Filter by job">
              <option value="all">All Jobs</option>
              {jobs.map((title) => <option key={title} value={title}>{title}</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={JOB_FILTER_STYLE} aria-label="Filter by status">
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
          </select>
        </div>
      )}
    >
      {visible.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>{jobFilter === 'all' && statusFilter === 'all' ? 'No applications yet.' : 'No recent applications match this filter.'}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 'var(--text-xs)', opacity: 0.6, textTransform: 'uppercase' }}>
                <th style={{ padding: '0 10px 10px 0', fontWeight: 600 }}>Candidate</th>
                <th style={{ padding: '0 10px 10px', fontWeight: 600 }}>Applied Role</th>
                <th style={{ padding: '0 10px 10px', fontWeight: 600 }}>Applied On</th>
                <th style={{ padding: '0 10px 10px', fontWeight: 600 }}>Score</th>
                <th style={{ padding: '0 10px 10px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0 0 10px', fontWeight: 600 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.submitted;
                return (
                  <tr key={r.applicationId} style={{ borderTop: '1px solid var(--border-hairline)' }}>
                    <td style={{ padding: '12px 10px 12px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--pink-100)', color: 'var(--red-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {initials(r.name)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', opacity: 0.85 }}>{r.job?.title || '—'}</td>
                    <td style={{ padding: '12px 10px', opacity: 0.7 }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 10px', fontWeight: 700, color: scoreTone(r.totalScore) }}>{r.totalScore != null ? `${r.totalScore}%` : '—'}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: meta.bg, color: meta.fg }}>{meta.label}</span>
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" onClick={() => r.job && nav('hr-applicant-list', r.job)}>View</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export function HrPersonnelDashboard({ nav, profile }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  // Live clock for the header — ticks every 30s, which is plenty for a
  // "what day/time is it right now" glance and cheap enough not to bother
  // re-rendering the whole dashboard more often than that.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const load = () => {
    getPersonnelOverview().then(({ data, error: err }) => {
      if (err) setError(err.message || 'Failed to load dashboard.');
      else setReport(data);
    });
  };

  useEffect(load, []);

  return (
    <HrShell active="hr-dashboard" nav={nav} profile={profile} notifications={report?.queue || []}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 4px', fontFamily: 'var(--font-display)' }}>Dashboard</h1>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>Welcome back, {profile?.full_name || profile?.email}.</p>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', fontWeight: 600,
              background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', borderRadius: 999, padding: '10px 18px', whiteSpace: 'nowrap',
            }}>
              <span aria-hidden>📅</span>
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              <span style={{ opacity: 0.4 }}>•</span>
              {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
        </Reveal>

        {error && <p style={{ color: 'var(--red-700)' }}>{error}</p>}
        {!report && !error && <p style={{ opacity: 0.7 }}>Loading dashboard…</p>}

        {report && (
          <>
            <div className="hr-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <KpiCard icon={KPI_ICONS.users} accent="red" label="Total Applicants" value={report.kpis.totalApplicants} trend={report.trends.totalApplicants} onClick={() => nav('hr-applicant-list')} />
              <KpiCard icon={KPI_ICONS.video} accent="amber" label="Video Interviews Pending" value={report.kpis.videoPending} trend={null} onClick={() => nav('hr-applicant-list', null, { stageFilter: 'video-pending' })} />
              <KpiCard icon={KPI_ICONS.check} accent="green" label="Passed Initial Screening" value={report.kpis.passedScreening} trend={report.trends.passedScreening} onClick={() => nav('hr-applicant-list', null, { stageFilter: 'passed-screening' })} />
              <KpiCard icon={KPI_ICONS.bolt} accent="violet" label="Ready for Your Decision" value={report.kpis.readyForDecision} trend={null} onClick={() => nav('hr-decisions')} />
            </div>

            {(() => {
              const totalScored = report.resumeScoreDistribution.reduce((sum, b) => sum + b.count, 0);
              return (
                // Main column (left, wider) is where HR Personnel actually
                // works — the decision queue and the applicant table. The
                // narrower right rail is supporting context (pipeline
                // status, score/sentiment distribution) — reading top to
                // bottom in either column stays useful on its own, since
                // each is its own independent stack rather than paired
                // side-by-side rows.
                <div className="hr-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
                    <ReadyForDecisionSummary queue={report.queue} nav={nav} />
                    <RecentApplicationsTable recent={report.recent} nav={nav} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
                    <SectionCard
                      title="Hiring Progress"
                      subtitle="Top job postings by applicant volume"
                      delay={0.06}
                      action={report.jobBreakdown.length > 0 ? <Badge>{report.jobBreakdown.length} Job{report.jobBreakdown.length === 1 ? '' : 's'}</Badge> : null}
                    >
                      {report.jobBreakdown.length === 0 ? (
                        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No applications yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                          {report.jobBreakdown.map(({ job, applicantCount, pipeline }) => (
                            <div key={job.id}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <strong style={{ fontSize: 'var(--text-sm)' }}>{job.title}</strong>
                                <span
                                  onClick={() => nav('hr-applicant-list', job)}
                                  style={{ fontSize: 'var(--text-xs)', color: 'var(--text-link)', cursor: 'pointer' }}
                                >
                                  View all ({applicantCount})
                                </span>
                              </div>
                              <PipelineBar pipeline={pipeline} job={job} nav={nav} />
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard
                      title="Resume Score Distribution"
                      subtitle="Where your current applicant pool clusters"
                      delay={0.08}
                      action={totalScored > 0 ? <Badge>{totalScored} Screened</Badge> : null}
                    >
                      <HorizontalBarChart rows={report.resumeScoreDistribution} emptyMessage="No resumes screened yet." />
                    </SectionCard>

                    <SectionCard
                      title="How Applicants Are Coming Across"
                      subtitle="AI-read tone across every evaluated video answer"
                      delay={0.1}
                      action={report.sentiment.total > 0 ? <Badge>{report.sentiment.total} Response{report.sentiment.total === 1 ? '' : 's'}</Badge> : null}
                    >
                      <SentimentBar sentiment={report.sentiment} />
                    </SectionCard>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </HrShell>
  );
}
export default HrPersonnelDashboard;
