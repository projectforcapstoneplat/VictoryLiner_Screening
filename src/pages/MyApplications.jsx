// Applicant — list of the jobs they've applied to, with a way to start
// (or resume) each one's video interview, and a plain-language status per
// application (in-app only — no email/SMS yet, see project notes).
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { listApplicationsForApplicant } from '../lib/applications.js';
import { getInterviewCompletionMap } from '../lib/interview.js';
import { listResumeEvaluationsForApplications } from '../lib/resumeEvaluation.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';

const STEP_LABELS = ['Create an Account/ Sign In', 'My Information/ Resume', 'Processing', 'Video Screening', 'Review'];

// A job posting can override the system-wide minimum with its own value
// (src/pages/JobPostingForm.jsx); null means "use the global default".
function resolveMinPercent(application, globalMinPercent) {
  const override = application.job_postings?.min_resume_match_percent;
  return override != null ? override : globalMinPercent;
}

// Same 5 steps the apply flow's Stepper shows on the way in (SignIn = 0,
// ApplicationForm = 1, Interview = 3) — this reconstructs "which step am I
// on" for an applicant looking back at an application already submitted,
// since nothing here tracks a literal step number once they've left the
// apply flow. Once a final decision is made, the whole pipeline is done, so
// every step reads as complete rather than parking on "Review" forever.
// Staying on "Processing" until HR advances them AND the resume clears the
// minimum match mirrors getStatusInfo below — both gate the interview step.
function getStepIndex(application, completion, resumeEvaluation, globalMinPercent) {
  if (application.status === 'advanced' || application.status === 'declined') return STEP_LABELS.length;
  if (application.status !== 'interview_stage') return 2;
  const minPercent = resolveMinPercent(application, globalMinPercent);
  if (!resumeEvaluation || resumeEvaluation.score < minPercent) return 2;
  const interviewComplete = completion && completion.total > 0 && completion.answered === completion.total;
  return interviewComplete ? 4 : 3;
}

// HR's decision (`status` column) always wins. The video interview only
// unlocks once BOTH are true: HR has reviewed the resume and advanced the
// applicant into "interview_stage" (see src/pages/HrApplicants.jsx), and the
// AI resume score clears the minimum — either the job posting's own
// override, or HR Head's system-wide default (see
// src/pages/HrHeadDashboard.jsx's Screening Settings card). Short of either,
// HR still sees and can decide the application manually, but the applicant
// can't jump straight to interview.
function getStatusInfo(application, completion, resumeEvaluation, globalMinPercent) {
  if (application.status === 'declined') {
    return { label: 'Not Selected', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' };
  }
  if (application.status === 'advanced') {
    return { label: 'Advanced to Next Step', bg: '#e3f6e6', fg: '#0ca30c' };
  }
  if (application.status !== 'interview_stage') {
    return { label: 'Submitted — Awaiting HR Review', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' };
  }
  if (!resumeEvaluation) {
    return { label: 'Processing Your Application', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' };
  }
  const minPercent = resolveMinPercent(application, globalMinPercent);
  if (resumeEvaluation.score < minPercent) {
    return { label: 'Below Minimum Resume Match', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' };
  }
  // Decision not made yet — still worth letting them revisit the interview
  // (to finish it, or re-record before HR reviews it).
  const interviewComplete = completion && completion.total > 0 && completion.answered === completion.total;
  if (!interviewComplete) {
    return { label: 'Action Needed — Complete Video Interview', bg: 'var(--pink-100)', fg: 'var(--red-700)', interviewCta: 'Continue to Video Interview' };
  }
  return { label: 'Under Review', bg: 'var(--pink-100)', fg: 'var(--red-700)', interviewCta: 'Review Video Interview' };
}

export function MyApplications({ profile, nav }) {
  const [applications, setApplications] = useState([]);
  const [completionMap, setCompletionMap] = useState({});
  const [resumeEvalMap, setResumeEvalMap] = useState({});
  const [minResumeMatchPercent, setMinResumeMatchPercent] = useState(50);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    getScreeningSettings().then(({ data }) => {
      if (data) setMinResumeMatchPercent(data.min_resume_match_percent);
    });
    listApplicationsForApplicant(profile.id).then(({ data }) => {
      setApplications(data);
      const appIds = data.map((a) => a.id);
      Promise.all([getInterviewCompletionMap(appIds), listResumeEvaluationsForApplications(appIds)]).then(
        ([{ data: completion }, { data: evaluations }]) => {
          setCompletionMap(completion || {});
          const evalMap = {};
          for (const e of evaluations || []) evalMap[e.application_id] = e;
          setResumeEvalMap(evalMap);
          setLoading(false);
        },
      );
    });
  }, [profile]);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
        <h1 style={{ fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 8px' }}>My Applications</h1>
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginBottom: 30 }}>Track your submitted applications and complete your video interview here.</p>
        {loading ? (
          <p>Loading…</p>
        ) : applications.length === 0 ? (
          <>
            <p>You haven't applied to any jobs yet.</p>
            <Button variant="ghost" size="sm" onClick={() => nav('filter')}>Browse Openings</Button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {applications.map((a) => {
              const status = getStatusInfo(a, completionMap[a.id], resumeEvalMap[a.id], minResumeMatchPercent);
              const expanded = expandedId === a.id;
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : a.id); } }}
                  style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 'var(--text-lg)' }}>{a.job_postings?.title || 'Job posting'}</strong>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>
                          {status.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginTop: 6 }}>{a.job_postings?.category}</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>Applied {new Date(a.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {status.interviewCta && (
                        <Button variant="strong" size="sm" onClick={(e) => { e.stopPropagation(); nav('interview', a); }}>{status.interviewCta}</Button>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', opacity: 0.6, whiteSpace: 'nowrap' }}>
                        {expanded ? 'Hide progress' : 'View progress'}
                        <svg
                          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                          style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {expanded && (
                    <div style={{ marginTop: 34, paddingTop: 10 }} onClick={(e) => e.stopPropagation()}>
                      <Stepper steps={STEP_LABELS} current={getStepIndex(a, completionMap[a.id], resumeEvalMap[a.id], minResumeMatchPercent)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
export default MyApplications;
