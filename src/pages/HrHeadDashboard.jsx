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
import { getHeadOverview } from '../lib/reports.js';

const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const KPI_ICONS = {
  users: <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 4.7a3.5 3.5 0 0 1 0 6.6" /><path d="M20 20a6.5 6.5 0 0 0-4-6" /></svg>,
  briefcase: <svg {...ICON_PROPS}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  doc: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></svg>,
  video: <svg {...ICON_PROPS}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>,
};

const RANK_ACCENT = ['#d4af37', '#9aa0a6', '#b56a3f']; // gold / silver / bronze — 4th+ stays plain

const STATUS_META = {
  published: { label: 'Published', color: '#0ca30c' },
  draft: { label: 'Draft', color: 'var(--gray-500)' },
  closed: { label: 'Closed', color: 'var(--red-700)' },
};

function SectionCard({ title, subtitle, action, children }) {
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <strong style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-display)' }}>{title}</strong>
          {subtitle && <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function CandidateRow({ rank, candidate, onView }) {
  const accent = RANK_ACCENT[rank - 1];
  return (
    <div
      onClick={onView}
      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: rank === 1 ? 'none' : '1px solid var(--border-hairline)', cursor: 'pointer' }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--text-xs)', fontWeight: 700, color: accent ? '#fff' : 'var(--text-primary)', background: accent || 'var(--surface-page-alt)',
      }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.name}</div>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>{candidate.job?.title || 'Unknown role'}</div>
      </div>
      <div style={{ display: 'flex', gap: 18, fontSize: 'var(--text-xs)', flexShrink: 0 }}>
        <span title="Resume match">R {candidate.resumeScore ?? '—'}%</span>
        <span title="Interview match">I {candidate.interviewScore ?? '—'}%</span>
      </div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, minWidth: 56, textAlign: 'right', flexShrink: 0 }}>{candidate.totalScore}%</div>
    </div>
  );
}

function SentimentBar({ sentiment }) {
  const { positive, neutral, negative, total } = sentiment;
  if (total === 0) return <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No interview responses evaluated yet.</p>;
  const segments = [
    { key: 'positive', label: 'Positive', value: positive, color: '#0ca30c' },
    { key: 'neutral', label: 'Neutral', value: neutral, color: 'var(--gray-500)' },
    { key: 'negative', label: 'Negative', value: negative, color: '#d03b3b' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {segments.map((s) => s.value > 0 && <div key={s.key} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {segments.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span>{s.label} ({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HrHeadDashboard({ nav, profile }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getHeadOverview().then(({ data, error: err }) => {
      if (err) setError(err.message || 'Failed to load reports.');
      else setReport(data);
    });
  }, []);

  return (
    <HrShell active="hr-dashboard" nav={nav} profile={profile}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Recruitment Overview</h1>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>
            Welcome back, {profile?.full_name || profile?.email}. System-wide performance across every job posting.
          </p>
        </div>

        {error && <p style={{ color: 'var(--red-700)' }}>{error}</p>}
        {!report && !error && <p style={{ opacity: 0.7 }}>Loading reports…</p>}

        {report && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <KpiCard icon={KPI_ICONS.users} accent="red" label="Total Applicants" value={report.applicantCount} trend={report.trends.applicants} />
              <KpiCard icon={KPI_ICONS.briefcase} accent="amber" label="Published Postings" value={report.jobStats.published} trend={null} />
              <KpiCard icon={KPI_ICONS.doc} accent="green" label="Resumes Screened" value={report.scores.resumeEvaluatedCount} trend={report.trends.resumeScreened} />
              <KpiCard icon={KPI_ICONS.video} accent="violet" label="Interviews Completed" value={report.scores.interviewCompletedCount} trend={report.trends.interviewsCompleted} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'stretch' }}>
              <SectionCard title="Candidate Ranking — Top Performers" subtitle="Combined resume + interview score">
                {report.topCandidates.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No fully-scored candidates yet.</p>
                ) : (
                  <div>
                    {report.topCandidates.map((c, i) => (
                      <CandidateRow key={c.applicationId} rank={i + 1} candidate={c} onView={() => c.job && nav('hr-applicants', c.job)} />
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Interview Sentiment" subtitle="NLP sentiment across all evaluated answers">
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

            <SectionCard title="Job Posting Pipelines" subtitle="Applications narrowing through screening, interview, and decision">
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
                          <Button variant="ghost" size="sm" onClick={() => nav('hr-applicants', job)}>View</Button>
                        </div>
                        <PipelineBar pipeline={pipeline} />
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="HR Personnel Activity" subtitle="Monitoring staff recruitment activity" action={<Button variant="ghost" size="sm" onClick={() => nav('hr-accounts')}>Manage</Button>}>
              {report.hrActivity.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No HR personnel accounts yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                  {report.hrActivity.map((p) => (
                    <div key={p.id} style={{ border: '1px solid var(--border-hairline)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name || p.email}</div>
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{p.jobsPosted} posting{p.jobsPosted === 1 ? '' : 's'} created</div>
                      </div>
                      <span style={{
                        fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, flexShrink: 0,
                        background: p.is_active ? 'var(--pink-100)' : 'var(--surface-page-alt)', color: p.is_active ? 'var(--red-700)' : 'var(--gray-600)',
                      }}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </HrShell>
  );
}
export default HrHeadDashboard;
