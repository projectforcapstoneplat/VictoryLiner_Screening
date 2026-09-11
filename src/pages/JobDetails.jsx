// Careers job detail page — was a flat, unstyled list of headings and
// paragraphs with no cards, icons, or motion. Rebuilt as a two-column layout
// (content + sticky apply card) matching the rest of the redesigned site.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Breadcrumb } from '../components/navigation/Breadcrumb/Breadcrumb.jsx';
import { CategoryIcon } from '../components/icons/CategoryIcon.jsx';
import { deadlineInfo } from '../lib/deadline.js';
import { quickApply } from '../lib/quickApply.js';
import { getMyMatches } from '../lib/resumeMatches.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';

// Standard disclosures shown on every job posting — not something HR writes per job.
const STATIC_SECTIONS = [
  { h: 'Accommodations', icon: 'accommodations', body: 'Victory Liner is committed to providing an inclusive and accessible recruitment process. Applicants who require reasonable accommodations may request assistance at any stage of the recruitment process.' },
  { h: 'Artificial Intelligence', icon: 'ai', body: 'As part of our recruitment process, we may use artificial intelligence (AI) tools to assist in the screening and/or assessment of job applicants.' },
];

const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

const SECTION_ICONS = {
  responsibilities: <svg {...ICON_PROPS}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  required: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.2 2.2 4.8-4.8" /></svg>,
  preferred: <svg {...ICON_PROPS}><path d="M12 2l2.6 6.6L21 9.3l-5 4.5 1.4 7.2L12 17.5 6.6 21l1.4-7.2-5-4.5 6.4-.7z" /></svg>,
  accommodations: <svg {...ICON_PROPS}><circle cx="12" cy="5" r="2" /><path d="M4 9h16M12 9v5l-4 7M12 14l4 7" /></svg>,
  ai: <svg {...ICON_PROPS}><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M12 7V3M9 3h6M9 13h.01M15 13h.01" /></svg>,
};

// HR writes these in a plain <textarea> (JobPostingForm.jsx) and naturally
// enters one responsibility/qualification per line — but a bare <p> collapses
// every line break into a single space, so it rendered as one dense,
// hard-to-scan paragraph regardless of how HR actually structured it.
// Splitting on line breaks and rendering each as its own bullet respects
// whatever structure HR already wrote, no content changes needed on their
// end. A body with no line breaks (a genuine single sentence/paragraph, e.g.
// the static Accommodations/AI disclosures below) still renders as plain
// text — bullets only kick in when there's actually more than one line.
function SectionCard({ icon, title, body, delay }) {
  const lines = (body || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const isList = lines.length > 1;
  return (
    <div className="fade-in-up" style={{ animationDelay: `${delay}s`, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '28px 32px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {SECTION_ICONS[icon]}
        </span>
        <h3 style={{ fontWeight: 700, fontSize: 'var(--text-lg)', margin: 0 }}>{title}</h3>
      </div>
      {isList ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.map((line, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 'var(--text-sm)', lineHeight: 1.65, opacity: 0.85 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--action-primary-bg)', flexShrink: 0, marginTop: 8 }} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, opacity: 0.85, margin: 0 }}>{body}</p>
      )}
    </div>
  );
}

function MetaRow({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-sm)' }}>
      <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.7 }}>{icon}</span>
      {label}
    </div>
  );
}

export function JobDetails({ job, nav, profile }) {
  const j = job || { title: 'Bus Conductor', category: 'Operations' };
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  // Applying only ever happens from a job the AI has actually matched the
  // applicant's resume against (see JobMatches.jsx) — browsing straight to a
  // job's details (Homepage/Browse All Roles) is view-only. `qualifies` uses
  // the exact same score-vs-threshold check JobMatches.jsx uses to decide
  // what shows up in "Jobs That Match You", so a job that wouldn't appear
  // there can't be applied to from here either, even if you know the URL.
  // Starts as 'ready'/false for anyone who isn't a signed-in applicant
  // (signed out, HR) so they never see a "checking" flash before landing on
  // the same "Get Matched" prompt.
  const [matchState, setMatchState] = useState(() =>
    !profile || profile.role !== 'applicant' ? { status: 'ready', qualifies: false } : { status: 'checking', qualifies: false }
  );
  const sections = [
    { h: 'Required Qualifications', icon: 'required', body: j.required_qualifications },
    { h: 'Preferred Qualifications', icon: 'preferred', body: j.preferred_qualifications },
  ].filter((s) => s.body);
  const deadline = deadlineInfo(j.application_deadline);
  const canApply = !deadline?.closed;

  useEffect(() => {
    if (!profile || profile.role !== 'applicant' || !j.id) {
      setMatchState({ status: 'ready', qualifies: false });
      return;
    }
    let cancelled = false;
    setMatchState({ status: 'checking', qualifies: false });
    Promise.all([getMyMatches(profile.id), getScreeningSettings()]).then(([matchesResult, settingsResult]) => {
      if (cancelled) return;
      const match = (matchesResult.data || []).find((m) => m.job_id === j.id);
      const globalMinPercent = settingsResult.data?.min_resume_match_percent ?? 50;
      const effectiveMinPercent = j.min_resume_match_percent ?? globalMinPercent;
      setMatchState({ status: 'ready', qualifies: !!match && match.score >= effectiveMinPercent });
    });
    return () => {
      cancelled = true;
    };
  }, [profile, j.id, j.min_resume_match_percent]);

  // Reuses the AI score already computed for this exact job (JobMatches.jsx)
  // — quickApply() unlocks the interview immediately when it genuinely
  // clears the threshold, otherwise submits normally for HR to review.
  const handleApply = async () => {
    if (!canApply || !matchState.qualifies) return;
    setApplyError('');
    setApplying(true);
    const { data: application, error } = await quickApply(j.id);
    setApplying(false);
    if (error) {
      setApplyError(error.message || 'Something went wrong — please try again.');
      return;
    }
    if (application.status === 'interview_stage') {
      nav('interview', application);
      return;
    }
    nav('my-applications');
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>

      {/* Hero band — gives the page a real visual anchor instead of jumping straight into plain text on a bare background. */}
      <div className="fade-in-up" style={{ marginTop: 40, background: 'linear-gradient(120deg, var(--action-primary-bg), var(--red-700))', padding: '56px 20px' }}>
        <div style={{ maxWidth: 1086, margin: '0 auto' }}>
          <div style={{ marginBottom: 22, opacity: 0.9 }}>
            <Breadcrumb items={[{ label: 'Home', onClick: () => nav('home') }, 'Job Details']} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, filter: 'brightness(0) invert(1)' }}>
              <CategoryIcon category={j.category} style={{ width: 40, height: 40, background: 'transparent' }} />
            </span>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>{j.category}</div>
              <h1 style={{ fontWeight: 700, fontSize: 'var(--text-5xl)', margin: 0, color: '#fff' }}>{j.title}</h1>
            </div>
          </div>
        </div>
      </div>

      <section style={{ maxWidth: 1086, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: -32 }}>
          {/* Main content column */}
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {j.description && <SectionCard icon="responsibilities" title="Key Responsibilities" body={j.description} delay={0.05} />}
            {sections.map((s, i) => <SectionCard key={s.h} icon={s.icon} title={s.h} body={s.body} delay={0.1 + i * 0.05} />)}
            {STATIC_SECTIONS.map((s, i) => <SectionCard key={s.h} icon={s.icon} title={s.h} body={s.body} delay={0.2 + i * 0.05} />)}
          </div>

          {/* Sticky apply card */}
          <div style={{ flex: '1 1 300px', minWidth: 280 }}>
            <div className="fade-in-up hover-lift" style={{ animationDelay: '0.1s', position: 'sticky', top: 24, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>Job Overview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {j.location && (
                  <MetaRow
                    label={j.location}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 6.5-9 12-9 12S3 16.5 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>}
                  />
                )}
                {j.employment_type && (
                  <MetaRow
                    label={j.employment_type}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>}
                  />
                )}
                {j.open_positions != null && (
                  <MetaRow
                    label={`${j.open_positions} Open Position${j.open_positions === 1 ? '' : 's'}`}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                  />
                )}
                {deadline && (
                  <MetaRow
                    label={deadline.label}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={deadline.urgent ? 'var(--red-700)' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>}
                  />
                )}
              </div>
              {!canApply ? (
                <Button variant="primary" size="md" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Applications Closed</Button>
              ) : matchState.status === 'checking' ? (
                <Button variant="primary" size="md" disabled>Checking your match…</Button>
              ) : matchState.qualifies ? (
                <>
                  <Button variant="primary" size="md" disabled={applying} onClick={handleApply}>{applying ? 'Applying…' : 'Apply Now'}</Button>
                  {applyError && <p style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', margin: 0 }}>{applyError}</p>}
                </>
              ) : (
                <>
                  <p style={{ fontSize: 'var(--text-xs)', opacity: 0.65, margin: 0, lineHeight: 1.5 }}>
                    This role isn't one of your current AI matches yet.
                  </p>
                  <Button variant="ghost" size="md" onClick={() => nav('home')}>Back to Home</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default JobDetails;
