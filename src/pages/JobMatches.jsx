// "Which jobs suit me" — lands here right after saving a resume
// (ResumeForm.jsx), and is the permanent landing spot after that (see
// App.jsx). Runs the AI match at most ONCE per resume: reads whatever's
// already cached first, and only calls the (AI-token-costing) matching
// function when nothing is cached yet at all — i.e. a brand-new resume, or
// right after an edit (ResumeForm.jsx clears the cache on save). A normal
// repeat visit is a pure cache read, no AI call, since this page is now
// visited far more often than it used to be. Trade-off: a job published
// after the cache was last populated won't show up here until the resume is
// edited again (clearing the cache) — catching that automatically is the
// not-yet-built "notify when a new match opens" piece.
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

const PULSE_BLOCK = { className: 'loading-pulse', style: { background: 'var(--surface-page-alt)', animation: 'skeletonPulse 1.4s ease-in-out infinite', borderRadius: 4 } };

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [settingsResult, cachedResult] = await Promise.all([
        getScreeningSettings(),
        getMyMatches(profile.id),
      ]);
      if (cancelled) return;
      if (settingsResult.data) setMinPercent(settingsResult.data.min_resume_match_percent);

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
    .filter((m) => m.score >= minPercent && m.job_postings?.status === 'published')
    .sort((a, b) => b.score - a.score);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} profile={profile} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto 0', padding: '0 20px' }}>
        <Reveal>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>Jobs That Match You</h1>
          <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginBottom: 30 }}>
            {loading
              ? "Our AI is comparing your resume against every open position — this takes a few seconds."
              : "Here's what suits your resume, based on our AI's comparison against every open position."}
          </p>
        </Reveal>

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
            {qualifying.map(({ job_id: jobId, job_postings: job }, i) => (
              <Reveal key={jobId} delay={Math.min(i * 0.06, 0.3)} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                    <CategoryIcon category={job?.category} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>{job?.title || 'Untitled role'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65, marginTop: 4 }}>{[job?.category, job?.location].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                  <Button variant="strong" size="sm" onClick={() => nav('details', job)}>Apply</Button>
                </div>
                {job?.description && (
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', opacity: 0.85, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {job.description}
                  </p>
                )}
              </Reveal>
            ))}
          </div>
        )}
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default JobMatches;
