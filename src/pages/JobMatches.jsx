// "Which jobs suit me" — lands here right after saving a resume
// (ResumeForm.jsx), and is the permanent landing spot after that (see
// App.jsx). A normal visit is a pure cache read, no AI call — it only
// calls the (AI-token-costing) matching function itself when nothing is
// cached at all yet (a brand-new resume, or right after an edit, since
// ResumeForm.jsx clears the cache on save).
//
// A job published after the cache was last populated normally reaches the
// applicant through email (match-job-to-resumes fires automatically when
// HR publishes, and HR can manually retry it from Job Openings if that
// silently missed someone) — but that's still something happening *to* the
// applicant, with no way for them to just go check for themselves. The
// "Check for New Matches" button below covers that: match-resume-to-jobs is
// itself already scoped to only ever score jobs this resume hasn't been
// checked against yet (never re-scores what's already cached), so it's
// cheap and safe to call again on demand — a no-op if nothing new exists.
//
// Deliberately doesn't show the AI's match score or its evaluation
// reasoning to the applicant — same reasoning as HR never exposing an
// internal ATS score to a candidate. The score is used server/client-side
// only to decide which jobs qualify to be listed at all; what the applicant
// actually sees is a normal job card, same shape as everywhere else in the
// app (JobFilter.jsx), just pre-filtered to roles that suit them. Clicking
// Apply goes to the job's own details page — actually applying (and reusing
// this already-computed score, so it's never scored twice) happens from
// there, see JobDetails.jsx / quickApply.js.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { CategoryIcon } from '../components/icons/CategoryIcon.jsx';
import { getMyMatches, runResumeMatching } from '../lib/resumeMatches.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';
import { deadlineInfo } from '../lib/deadline.js';
import { listApplicationsForApplicant } from '../lib/applications.js';

const PULSE_BLOCK = { className: 'loading-pulse', style: { background: 'var(--surface-page-alt)', animation: 'skeletonPulse 1.4s ease-in-out infinite', borderRadius: 4 } };

const REFRESH_ICON = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 6.5A8 8 0 0 0 4.6 9M4.6 9V4M4.6 9h4.9" /><path d="M6.5 17.5A8 8 0 0 0 19.4 15M19.4 15v5M19.4 15h-4.9" /></svg>;
const CHECK_ICON = <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;

// A posting is only ever "new" for a short window after it first went
// live — past that it's just a normal open role, badge or not.
const NEW_BADGE_DAYS = 7;
function isNewlyPosted(job) {
  if (!job?.created_at) return false;
  const ageDays = (Date.now() - new Date(job.created_at).getTime()) / (24 * 60 * 60 * 1000);
  return ageDays <= NEW_BADGE_DAYS;
}

function SkeletonCard({ index }) {
  return (
    <div className="fade-in-up" style={{ animationDelay: `${index * 0.1}s`, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div {...PULSE_BLOCK} style={{ ...PULSE_BLOCK.style, width: 44, height: 44, borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div {...PULSE_BLOCK} style={{ ...PULSE_BLOCK.style, width: '40%', height: 16 }} />
          <div {...PULSE_BLOCK} style={{ ...PULSE_BLOCK.style, width: '60%', height: 12 }} />
        </div>
      </div>
      <div {...PULSE_BLOCK} style={{ ...PULSE_BLOCK.style, width: '100%', height: 12 }} />
      <div {...PULSE_BLOCK} style={{ ...PULSE_BLOCK.style, width: '85%', height: 12 }} />
    </div>
  );
}

export function JobMatches({ profile, nav }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState([]);
  const [minPercent, setMinPercent] = useState(50);
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [settingsResult, cachedResult, applicationsResult] = await Promise.all([
        getScreeningSettings(),
        getMyMatches(profile.id),
        listApplicationsForApplicant(profile.id),
      ]);
      if (cancelled) return;
      if (settingsResult.data) setMinPercent(settingsResult.data.min_resume_match_percent);
      setAppliedJobIds(new Set(applicationsResult.data.map((a) => a.job_id)));

      if (cachedResult.data?.length > 0) {
        setMatches(cachedResult.data);
        setLoading(false);
        return;
      }

      // Nothing cached at all — either this resume has never been matched,
      // or it was just edited (which clears the cache). Either way, this is
      // the one AI call this resume gets until it changes again.
      const matchResult = await runResumeMatching();
      if (cancelled) return;
      if (matchResult.error) {
        setError(matchResult.error);
        setLoading(false);
        return;
      }
      setMatches(matchResult.data.matches || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const qualifying = matches
    .filter((m) => m.score >= minPercent && m.job_postings?.status === 'published' && !deadlineInfo(m.job_postings?.application_deadline)?.closed)
    .sort((a, b) => b.score - a.score);

  const handleCheckForNewMatches = async () => {
    setChecking(true);
    setCheckMessage('');
    const result = await runResumeMatching();
    setChecking(false);
    if (result.error) {
      setCheckMessage(result.error);
      return;
    }
    const scoredThisCall = result.data.scoredThisCall ?? 0;
    if (scoredThisCall === 0) {
      setCheckMessage("You're already matched to every open position we currently have.");
      return;
    }
    // match-resume-to-jobs' response is already the complete, freshly
    // re-read match set (not just what changed this call) — comparing
    // qualifying counts before/after this update, rather than just echoing
    // scoredThisCall, avoids overclaiming "new matches" for newly-checked
    // jobs that didn't actually clear the threshold.
    const freshMatches = result.data.matches || [];
    const newQualifyingCount =
      freshMatches.filter((m) => m.score >= minPercent && m.job_postings?.status === 'published').length - qualifying.length;
    setMatches(freshMatches);
    setCheckMessage(
      newQualifyingCount > 0
        ? `Found ${newQualifyingCount} new match${newQualifyingCount === 1 ? '' : 'es'}!`
        : `Checked ${scoredThisCall} newly posted role${scoredThisCall === 1 ? '' : 's'} — none were a strong enough fit yet.`,
    );
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} profile={profile} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto 0', padding: '0 20px' }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>Jobs That Match You</h1>
              <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, margin: 0 }}>
                {loading
                  ? "Our AI is comparing your resume against every open position — this takes a few seconds."
                  : "Here's what suits your resume, based on our AI's comparison against every open position."}
              </p>
            </div>
            {/* Shrunk to a small icon rather than a full labeled button —
                the automatic pipeline (HR publishing -> match-job-to-resumes
                -> notification + email) already covers the normal case with
                zero clicks needed. This is a manual fallback for the one
                gap it has: an individual applicant's AI scoring call can
                silently fail with no auto-retry (the exact bug the City Bus
                Driver debugging session root-caused), which a prominent
                always-visible button would misrepresent as "part of the
                normal flow" rather than "rarely needed safety net." */}
            {!loading && !error && (
              <button
                onClick={handleCheckForNewMatches}
                disabled={checking}
                className="btn-animate"
                title="Manually re-check for new matches — rarely needed, since new postings normally notify you automatically. Useful only if that silently missed something."
                aria-label="Check for new matches"
                style={{
                  width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: checking ? 'default' : 'pointer', flexShrink: 0,
                  background: 'var(--surface-page-alt)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: checking ? 0.55 : 1,
                }}
              >
                {REFRESH_ICON}
              </button>
            )}
          </div>
          {checkMessage && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--action-primary-bg)', fontWeight: 600, marginTop: 10, marginBottom: 0 }}>{checkMessage}</p>
          )}
        </Reveal>
        <div style={{ marginBottom: 30 }} />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[0, 1, 2].map((i) => <SkeletonCard key={i} index={i} />)}
          </div>
        ) : error ? (
          <p style={{ color: 'var(--red-700)' }}>{error}</p>
        ) : qualifying.length === 0 ? (
          <Reveal delay={0.1} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
            </div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>No matching openings right now</h2>
            <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, maxWidth: 440, margin: 0 }}>
              None of our current openings are a strong enough fit for your resume yet. We'll email you the moment a
              role that matches you opens up — no need to keep checking back.
            </p>
            <Button variant="ghost" size="sm" onClick={() => nav('filter')}>Browse All Open Roles Anyway</Button>
          </Reveal>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {qualifying.map(({ job_id: jobId, job_postings: job }, i) => {
              const applied = appliedJobIds.has(jobId);
              const deadline = deadlineInfo(job?.application_deadline);
              return (
                <Reveal key={jobId} delay={Math.min(i * 0.06, 0.3)} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                      <CategoryIcon category={job?.category} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>{job?.title || 'Untitled role'}</span>
                          {isNewlyPosted(job) && (
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#0ca30c', color: '#fff', whiteSpace: 'nowrap' }}>
                              New
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65, marginTop: 4 }}>{[job?.category, job?.location].filter(Boolean).join(' · ')}</div>
                      </div>
                    </div>
                    {applied ? (
                      // "Already Applied" used to be a static, dead-end tag —
                      // true the moment they apply, but easy to misread as
                      // "you're done here" even while a video interview is
                      // still outstanding. Made it a button pointing at My
                      // Applications instead of trying to duplicate that
                      // page's full status logic (resume score, interview
                      // completion, HR decision) here too.
                      <button
                        onClick={() => nav('my-applications', jobId)}
                        className="btn-animate"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 700, padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--pink-100)', color: 'var(--action-primary-bg)', whiteSpace: 'nowrap' }}
                      >
                        {CHECK_ICON} Applied — View Status
                      </button>
                    ) : (
                      <Button variant="strong" size="sm" onClick={() => nav('details', job)}>Apply</Button>
                    )}
                  </div>
                  {job?.description && (
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', opacity: 0.85, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {job.description}
                    </p>
                  )}
                  <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', opacity: 0.75 }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ca30c' }} />
                      {job?.open_positions} Open Position{job?.open_positions === 1 ? '' : 's'}
                    </span>
                    {deadline && (
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: deadline.urgent ? 700 : 400, color: deadline.urgent ? 'var(--red-700)' : 'var(--text-primary)', opacity: deadline.urgent ? 1 : 0.75 }}>
                        {deadline.label}
                      </span>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default JobMatches;
