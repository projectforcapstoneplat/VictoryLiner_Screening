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
import { updateApplicationStatus, notifyApplicantStatusChange } from '../lib/applications.js';
import { getSignedVideoUrl } from '../lib/interviewEvaluation.js';

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

function scoreTone(score) {
  if (score == null) return 'var(--gray-500)';
  if (score >= 80) return '#0ca30c';
  if (score >= 60) return '#c98500';
  return '#d03b3b';
}

function SectionCard({ title, subtitle, action, children, style, delay = 0 }) {
  return (
    <Reveal delay={delay} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0, ...style }}>
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

function ScreeningQueue({ queue, onDecide, profile }) {
  const [answerIndex, setAnswerIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const candidate = queue[0];
  const answer = candidate?.interviewAnswers?.[answerIndex];

  useEffect(() => {
    setAnswerIndex(0);
  }, [candidate?.applicationId]);

  useEffect(() => {
    setVideoUrl(null);
    if (!answer?.response?.video_path) return;
    let cancelled = false;
    getSignedVideoUrl(answer.response.video_path).then(({ data }) => {
      if (!cancelled) setVideoUrl(data);
    });
    return () => { cancelled = true; };
  }, [answer?.response?.video_path]);

  if (!candidate) {
    return (
      <SectionCard title="Applicant Video Screening Queue" subtitle="Review and evaluate shortlisted candidates">
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No candidates waiting on a decision right now — you&rsquo;re all caught up.</p>
      </SectionCard>
    );
  }

  const handleDecide = async (status) => {
    setDeciding(true);
    const { error } = await updateApplicationStatus(candidate.applicationId, status, profile?.id);
    setDeciding(false);
    if (error) {
      window.alert(`Could not update this application: ${error.message}`);
    } else {
      notifyApplicantStatusChange(candidate.applicationId, status);
    }
    onDecide(candidate.applicationId);
  };

  const answers = candidate.interviewAnswers || [];

  return (
    <SectionCard title="Applicant Video Screening Queue" subtitle="Review and evaluate shortlisted candidates">
      <div className="hr-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24 }}>
        <div>
          <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '16 / 9' }}>
            {answer?.response?.interview_questions?.question_text && (
              <div style={{ position: 'absolute', top: 10, left: 12, right: 12, color: '#fff', fontSize: 'var(--text-xs)', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                Question {answerIndex + 1} of {answers.length}
                <div style={{ fontWeight: 600, marginTop: 2 }}>{answer.response.interview_questions.question_text}</div>
              </div>
            )}
            {videoUrl ? (
              <video key={videoUrl} src={videoUrl} controls style={{ width: '100%', height: '100%', display: 'block' }} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-sm)' }}>
                {answers.length === 0 ? 'No recorded answers.' : 'Loading video…'}
              </div>
            )}
          </div>
          {answers.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {answers.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setAnswerIndex(i)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700,
                    background: i === answerIndex ? 'var(--action-primary-bg)' : 'var(--surface-page-alt)',
                    color: i === answerIndex ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  Answer {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 'var(--text-lg)' }}>{candidate.name}</strong>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#e3f6e6', color: '#0ca30c' }}>Ready</span>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', opacity: 0.7 }}>{candidate.job?.title}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.6 }}>Applied on</span><span>{new Date(candidate.createdAt).toLocaleDateString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.6 }}>Resume Score</span><span style={{ fontWeight: 700, color: scoreTone(candidate.resumeScore) }}>{candidate.resumeScore}%</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.6 }}>Interview Score</span><span style={{ fontWeight: 700, color: scoreTone(candidate.interviewScore) }}>{candidate.interviewScore}%</span></div>
            {candidate.skills?.length > 0 && (
              <div>
                <span style={{ opacity: 0.6 }}>Skills</span>
                <div style={{ marginTop: 4 }}>{candidate.skills.slice(0, 6).join(', ')}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <Button variant="strong" size="sm" onClick={() => handleDecide('advanced')} disabled={deciding}>
              {deciding ? 'Saving…' : '✓ Advance'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDecide('declined')} disabled={deciding}>✕ Decline</Button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function RecentApplicationsTable({ recent, nav }) {
  return (
    <SectionCard title="Recent Applications">
      {recent.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No applications yet.</p>
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
              {recent.map((r) => {
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
                      <Button variant="ghost" size="sm" onClick={() => r.job && nav('hr-applicants', r.job)}>View</Button>
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

  const load = () => {
    getPersonnelOverview().then(({ data, error: err }) => {
      if (err) setError(err.message || 'Failed to load dashboard.');
      else setReport(data);
    });
  };

  useEffect(load, []);

  const handleDecide = (applicationId) => {
    setReport((r) => (r ? { ...r, queue: r.queue.filter((c) => c.applicationId !== applicationId) } : r));
  };

  return (
    <HrShell active="hr-dashboard" nav={nav} profile={profile} notifications={report?.queue || []}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Reveal>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Dashboard</h1>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>Welcome back, {profile?.full_name || profile?.email}.</p>
        </Reveal>

        {error && <p style={{ color: 'var(--red-700)' }}>{error}</p>}
        {!report && !error && <p style={{ opacity: 0.7 }}>Loading dashboard…</p>}

        {report && (
          <>
            <div className="hr-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <KpiCard icon={KPI_ICONS.users} accent="red" label="Total Applicants" value={report.kpis.totalApplicants} trend={report.trends.totalApplicants} />
              <KpiCard icon={KPI_ICONS.video} accent="amber" label="Video Interviews Pending" value={report.kpis.videoPending} trend={null} />
              <KpiCard icon={KPI_ICONS.check} accent="green" label="Passed Initial Screening" value={report.kpis.passedScreening} trend={report.trends.passedScreening} />
              <KpiCard icon={KPI_ICONS.bolt} accent="violet" label="Ready for Your Decision" value={report.kpis.readyForDecision} trend={null} />
            </div>

            <div className="hr-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
              <ScreeningQueue queue={report.queue} onDecide={handleDecide} profile={profile} />
              <SectionCard title="Live Pipeline Stages" subtitle="Top job postings by applicant volume" delay={0.06}>
                {report.jobBreakdown.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No applications yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {report.jobBreakdown.map(({ job, applicantCount, pipeline }) => (
                      <div key={job.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <strong style={{ fontSize: 'var(--text-sm)' }}>{job.title}</strong>
                          <span
                            onClick={() => nav('hr-applicants', job)}
                            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-link)', cursor: 'pointer' }}
                          >
                            View all ({applicantCount})
                          </span>
                        </div>
                        <PipelineBar pipeline={pipeline} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            <RecentApplicationsTable recent={report.recent} nav={nav} />
          </>
        )}
      </div>
    </HrShell>
  );
}
export default HrPersonnelDashboard;
