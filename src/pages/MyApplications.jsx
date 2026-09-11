// Applicant — list of the jobs they've applied to, with a way to start
// (or resume) each one's video interview, and a plain-language status per
// application (in-app only — no email/SMS yet, see project notes).
import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { listApplicationsForApplicant } from '../lib/applications.js';
import { getInterviewCompletionMap } from '../lib/interview.js';
import { listResumeEvaluationsForApplications } from '../lib/resumeEvaluation.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';

const STEP_LABELS = ['Create Account', 'Resume', 'Video Screening', 'Reviewing', 'Result'];

const HOME_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" /></svg>;
const DETAILS_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;

// The video-screening deadline — 3 days from the moment an application
// enters interview_stage (see interview_stage_at, stamped either by
// quick-apply's auto-advance or updateApplicationStatus's manual one in
// src/lib/applications.js). Mirrors DEADLINE_DAYS in the
// send-interview-reminders edge function, which emails a warning once only
// 1 day of this window is left.
const VIDEO_SCREENING_DEADLINE_DAYS = 3;

// A job posting can override the system-wide minimum with its own value
// (src/pages/JobPostingForm.jsx); null means "use the global default".
function resolveMinPercent(application, globalMinPercent) {
  const override = application.job_postings?.min_resume_match_percent;
  return override != null ? override : globalMinPercent;
}

// Reconstructs "which step am I on" for an applicant looking back at an
// application already submitted, since nothing here tracks a literal step
// number once they've left the apply flow. AI/HR resume screening happens
// invisibly between "Resume" and "Video Screening" — it's not its own
// visible node (most applicants clear it instantly via AI matching, so a
// dedicated "Screening" step just sat there implying a wait that usually
// isn't real) — so an application stays parked on "Resume" until video
// screening genuinely unlocks. Once HR makes the final call, this returns
// the "Result" step's own index (not one past it) so the stepper's bus
// parks *on* Result as the step just arrived at, rather than checking it
// off along with everything else as if it were already behind them.
function getStepIndex(application, completion, resumeEvaluation, globalMinPercent) {
  if (application.status === 'advanced' || application.status === 'declined') return 4;
  if (application.status !== 'interview_stage') return 1;
  const minPercent = resolveMinPercent(application, globalMinPercent);
  if (!resumeEvaluation || resumeEvaluation.score < minPercent) return 1;
  const interviewComplete = completion && completion.total > 0 && completion.answered === completion.total;
  return interviewComplete ? 3 : 2;
}

// HR's decision (`status` column) always wins. The video interview only
// unlocks once BOTH are true: HR has reviewed the resume and advanced the
// applicant into "interview_stage" (see src/pages/HrApplicantsList.jsx), and
// the AI resume score clears the minimum — either the job posting's own
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
    return { label: 'Screening Your Application', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' };
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

// Only meaningful while genuinely still waiting on the applicant to finish
// recording — once it's fully answered, or HR has already made the final
// call (advanced/declined), the clock no longer matters (the
// send-interview-reminders edge function stops emailing at that point too).
function videoScreeningDeadline(application, completion) {
  if (application.status !== 'interview_stage') return null;
  if (!application.interview_stage_at) return null;
  // No questions were ever assigned for this role's category (a thin/empty
  // question bank) — there's nothing to record yet, so a ticking deadline
  // would just be misleading. Matches the same exemption on the reminder
  // email cron (supabase/functions/send-interview-reminders).
  if (completion && completion.total === 0) return null;
  const interviewComplete = completion && completion.total > 0 && completion.answered === completion.total;
  if (interviewComplete) return null;
  const deadline = new Date(application.interview_stage_at);
  deadline.setDate(deadline.getDate() + VIDEO_SCREENING_DEADLINE_DAYS);
  return deadline;
}

function DeadlineNotice({ deadline }) {
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const label = daysLeft <= 0
    ? 'Your video interview window has closed — sign in and finish it as soon as you can.'
    : `Complete your video interview by ${deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left).`;
  return (
    <p style={{ fontSize: 'var(--text-xs)', color: daysLeft <= 1 ? 'var(--red-700)' : 'var(--text-primary)', opacity: daysLeft <= 1 ? 1 : 0.65, marginTop: 6, fontWeight: daysLeft <= 1 ? 700 : 400 }}>
      {label}
    </p>
  );
}

function ScheduledInterviewBanner({ application }) {
  if (!application.scheduled_interview_at) return null;
  const when = new Date(application.scheduled_interview_at).toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return (
    <div style={{ marginTop: 10, background: 'var(--pink-100)', borderRadius: 10, padding: '12px 16px' }}>
      <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)' }}>Personal Interview Scheduled</strong>
      <div style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>{when}</div>
      {application.scheduled_interview_location && (
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.75, marginTop: 2 }}>{application.scheduled_interview_location}</div>
      )}
      {application.scheduled_interview_notes && (
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.75, marginTop: 4 }}>{application.scheduled_interview_notes}</div>
      )}
    </div>
  );
}

export function MyApplications({ profile, nav, focusJobId }) {
  const [applications, setApplications] = useState([]);
  const [completionMap, setCompletionMap] = useState({});
  const [resumeEvalMap, setResumeEvalMap] = useState({});
  const [minResumeMatchPercent, setMinResumeMatchPercent] = useState(50);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const cardRefs = useRef({});

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

  // Landed here from a specific job (e.g. JobMatches.jsx's "Applied — View
  // Status") — open that one application's card and scroll it into view
  // instead of dropping the applicant into the top of a list they then have
  // to hunt through themselves.
  useEffect(() => {
    if (!focusJobId || loading) return;
    const match = applications.find((a) => a.job_id === focusJobId);
    if (!match) return;
    setExpandedId(match.id);
    requestAnimationFrame(() => {
      cardRefs.current[match.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [focusJobId, loading, applications]);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} onLogoClick={() => nav('home')} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
        {/* The logo doubles as a home link, but that's only obvious to
            people already used to that web convention — a real labeled
            button here doesn't rely on anyone knowing that. */}
        <button
          onClick={() => nav('home')}
          className="btn-animate"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20,
            padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', color: 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 700,
          }}
        >
          {HOME_ICON} Home
        </button>
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
              const deadline = videoScreeningDeadline(a, completionMap[a.id]);
              const expanded = expandedId === a.id;
              return (
                <div
                  key={a.id}
                  ref={(el) => { cardRefs.current[a.id] = el; }}
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : a.id); } }}
                  style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px', cursor: 'pointer' }}
                >
                  {/* `minWidth: 0` on the title column is what actually keeps
                      this consistent card to card — without it, a long title
                      ("IT Systems & Technical Support Specialist") sizes to
                      its own natural width first and forces the *whole row*
                      to wrap, dropping the buttons to a second line
                      left-aligned instead of staying pinned to the right like
                      every shorter-titled card. `minWidth: 0` lets the title
                      column shrink and wrap its own text internally instead,
                      so the buttons column never has to move. */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                      {/* Title and badge always stack (badge on its own line
                          below), never inline — inline only actually worked
                          for short titles ("Provincial Bus Driver"); a
                          longer one ("Ticketing & Customer Service
                          Representative") ran out of room and wrapped the
                          badge underneath anyway, so the badge's position
                          silently depended on title length. Stacking always
                          makes every card read the same regardless. */}
                      <strong style={{ fontSize: 'var(--text-lg)', display: 'block' }}>{a.job_postings?.title || 'Job posting'}</strong>
                      <span style={{ display: 'inline-block', marginTop: 8, fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>
                        {status.label}
                      </span>
                      <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginTop: 6 }}>{a.job_postings?.category}</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>Applied {new Date(a.created_at).toLocaleDateString()}</div>
                      {deadline && <DeadlineNotice deadline={deadline} />}
                      <ScheduledInterviewBanner application={a} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                      {status.interviewCta ? (
                        <Button variant="strong" size="sm" onClick={(e) => { e.stopPropagation(); nav('interview', a); }}>{status.interviewCta}</Button>
                      ) : (
                        // Every card gets somewhere to go, even the ones with
                        // genuinely nothing to act on yet (still awaiting
                        // HR's first look, declined, etc.) — a bare status
                        // badge with no button anywhere on the card read as a
                        // dead end.
                        a.job_postings?.id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); nav('details', a.job_postings); }}
                            className="btn-animate"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 8, height: 45, padding: '0 18px', borderRadius: 999,
                              border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700,
                              background: 'var(--pink-100)', color: 'var(--action-primary-bg)', whiteSpace: 'nowrap',
                            }}
                          >
                            {DETAILS_ICON} View Job Details
                          </button>
                        )
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
