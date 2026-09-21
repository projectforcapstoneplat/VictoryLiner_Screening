// Careers job detail page — was a flat, unstyled list of headings and
// paragraphs with no cards, icons, or motion. Rebuilt as a two-column layout
// (content + sticky apply card) matching the rest of the redesigned site.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { CategoryIcon } from '../components/icons/CategoryIcon.jsx';
import { deadlineInfo } from '../lib/deadline.js';
import { quickApply } from '../lib/quickApply.js';
import { getMyMatches } from '../lib/resumeMatches.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';
import { listApplicationsForApplicant } from '../lib/applications.js';

// Standard disclosures shown on every job posting — not something HR writes per job.
const STATIC_SECTIONS = [
  { h: 'Accommodations', icon: 'accommodations', body: 'Victory Liner is committed to providing an inclusive and accessible recruitment process. Applicants who require reasonable accommodations may request assistance at any stage of the recruitment process.' },
  { h: 'Artificial Intelligence', icon: 'ai', body: 'As part of our recruitment process, we may use artificial intelligence (AI) tools to assist in the screening and/or assessment of job applicants.' },
];

const ARROW_LEFT_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;

const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

const SECTION_ICONS = {
  responsibilities: <svg {...ICON_PROPS}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  required: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.2 2.2 4.8-4.8" /></svg>,
  preferred: <svg {...ICON_PROPS}><path d="M12 2l2.6 6.6L21 9.3l-5 4.5 1.4 7.2L12 17.5 6.6 21l1.4-7.2-5-4.5 6.4-.7z" /></svg>,
  accommodations: <svg {...ICON_PROPS}><circle cx="12" cy="5" r="2" /><path d="M4 9h16M12 9v5l-4 7M12 14l4 7" /></svg>,
  ai: <svg {...ICON_PROPS}><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M12 7V3M9 3h6M9 13h.01M15 13h.01" /></svg>,
};

// Per-bullet markers matching that section's own header icon — Required
// gets a small checkmark, Preferred a small star, so scanning the list
// itself echoes the section it belongs to instead of every list looking
// identical regardless of what kind of item it is. Anything else (plain
// disclosures split across lines) keeps the neutral dot.
const BULLET_ICON_PROPS = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
const BULLET_ICONS = {
  required: <svg {...BULLET_ICON_PROPS}><path d="M4 12l5 5 11-11" /></svg>,
  preferred: <svg {...BULLET_ICON_PROPS} strokeWidth={1.6} fill="var(--action-primary-bg)"><path d="M12 2l2.6 6.6L21 9.3l-5 4.5 1.4 7.2L12 17.5 6.6 21l1.4-7.2-5-4.5 6.4-.7z" /></svg>,
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
    <div className="fade-in-up" style={{ animationDelay: `${delay}s`, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '32px 36px', marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {SECTION_ICONS[icon]}
        </span>
        <h3 style={{ fontWeight: 700, fontSize: 'var(--text-lg)', margin: 0 }}>{title}</h3>
      </div>
      {isList ? (
        <ul style={{ margin: 0, padding: 0, paddingLeft: 42, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.map((line, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 'var(--text-sm)', lineHeight: 1.65, opacity: 0.85 }}>
              {BULLET_ICONS[icon] ? (
                <span style={{ display: 'flex', flexShrink: 0, marginTop: 5 }}>{BULLET_ICONS[icon]}</span>
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--action-primary-bg)', flexShrink: 0, marginTop: 8 }} />
              )}
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, opacity: 0.85, margin: 0, paddingLeft: 42 }}>{body}</p>
      )}
    </div>
  );
}

// Shared between the desktop sidebar card and the mobile sticky bottom bar
// (see .mobile-apply-bar in styles.css) so the two surfaces can never drift
// out of sync on what state shows what — `compact` just drops the
// explanatory copy the bottom bar has no room for, keeping only the button.
function ApplyAction({ canApply, profile, matchState, applying, applyError, existingApplication, onApply, onSignIn, onBackHome, onTrackApplication, compact }) {
  // Checked before everything else, including the deadline — someone who
  // already has an application on file doesn't need "Applications Closed"
  // (which reads like a rejection of a new attempt that was never being
  // made) or a re-apply prompt; the only place their answer is meaningful
  // is Track Application, so send them straight there instead of routing
  // them back through "View Job Details -> Apply Now" for a job they've
  // already applied to.
  if (existingApplication) {
    return (
      <>
        {!compact && (
          <p style={{ fontSize: 'var(--text-xs)', opacity: 0.65, margin: 0, lineHeight: 1.5 }}>
            You've already applied for this role — track its progress and continue your video interview from there.
          </p>
        )}
        <Button variant="primary" size="md" onClick={onTrackApplication}>Go to Track Application</Button>
      </>
    );
  }
  if (!canApply) {
    return <Button variant="primary" size="md" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Applications Closed</Button>;
  }
  if (!profile) {
    return (
      <>
        {!compact && (
          <p style={{ fontSize: 'var(--text-xs)', opacity: 0.65, margin: 0, lineHeight: 1.5 }}>
            Sign in and build your resume — we'll tell you instantly if you're a match for this role.
          </p>
        )}
        <Button variant="primary" size="md" onClick={onSignIn}>Sign In to Apply</Button>
      </>
    );
  }
  if (matchState.status === 'checking') {
    return <Button variant="primary" size="md" disabled>Checking your match…</Button>;
  }
  if (matchState.qualifies) {
    return (
      <>
        <Button variant="primary" size="md" disabled={applying} onClick={onApply}>{applying ? 'Applying…' : 'Apply Now'}</Button>
        {!compact && applyError && <p style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', margin: 0 }}>{applyError}</p>}
      </>
    );
  }
  // Genuinely doesn't qualify — no meaningful action to pin to a persistent
  // mobile bar, so the compact form renders nothing rather than a floating
  // "Go Back" that would look like it's begging you to leave.
  if (compact) return null;
  return (
    <>
      <p style={{ fontSize: 'var(--text-xs)', opacity: 0.65, margin: 0, lineHeight: 1.5 }}>
        This role isn't one of your current AI matches yet.
      </p>
      <Button variant="ghost" size="md" onClick={onBackHome}>Go Back</Button>
    </>
  );
}

function MetaRow({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 'var(--text-sm)' }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8, background: 'var(--pink-100)', color: 'var(--action-primary-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </span>
      {label}
    </div>
  );
}

export function JobDetails({ job, nav, profile, backTo }) {
  const j = job || { title: 'Bus Conductor', category: 'Operations' };
  // Reachable from a handful of very different places (Browse All Roles,
  // Track Application, Jobs That Match You, the homepage's own job cards) —
  // `backTo` (App.jsx's previousStateRef, same pattern Contact.jsx uses)
  // returns to whichever of those actually opened this page, instead of a
  // single hardcoded destination that's wrong most of the time it's used.
  const handleBack = () => nav(backTo?.screen || 'home', backTo?.job || null);
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
  // Whether this applicant already has an application on file for this
  // specific job — undefined until checked, then either the existing
  // application row or null. Gates the whole Apply flow: re-applying to a
  // job already on record isn't a real path, just an accidental one via
  // View Job Details, and "View Job Details -> Apply Now" is exactly the
  // repetitive detour Track Application shouldn't be sending anyone
  // through in the first place.
  const [existingApplication, setExistingApplication] = useState(undefined);
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

  useEffect(() => {
    if (!profile || profile.role !== 'applicant' || !j.id) {
      setExistingApplication(null);
      return;
    }
    let cancelled = false;
    listApplicationsForApplicant(profile.id).then(({ data }) => {
      if (cancelled) return;
      setExistingApplication((data || []).find((a) => a.job_id === j.id) || null);
    });
    return () => {
      cancelled = true;
    };
  }, [profile, j.id]);

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
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap">
        <Header
          nav={nav}
          links={[{ label: 'Contact Us', onClick: () => nav('contact') }]}
        />
      </div>

      {/* Hero band — gives the page a real visual anchor instead of jumping straight into plain text on a bare background. */}
      <div className="fade-in-up" style={{ marginTop: 40, background: 'linear-gradient(120deg, var(--action-primary-bg), var(--red-700))', padding: '56px 20px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center' }}>
            <button
              onClick={handleBack}
              className="btn-animate"
              aria-label="Back"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%',
                border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.18)', color: '#fff', flexShrink: 0,
              }}
            >
              {ARROW_LEFT_ICON}
            </button>
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

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: -32 }}>
          {/* Main content column */}
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {j.description && <SectionCard icon="responsibilities" title="Key Responsibilities" body={j.description} delay={0.05} />}
            {sections.map((s, i) => <SectionCard key={s.h} icon={s.icon} title={s.h} body={s.body} delay={0.1 + i * 0.05} />)}
            {STATIC_SECTIONS.map((s, i) => <SectionCard key={s.h} icon={s.icon} title={s.h} body={s.body} delay={0.2 + i * 0.05} />)}
          </div>

          {/* Sticky apply card — deliberately no .hover-lift here (unlike
              the content cards): that class is meant for clickable-feeling
              cards, but this one is a sticky info panel with its own
              Apply button inside, not a click target itself. Combined with
              position:sticky, the translateY(-6px) hover motion read as a
              stray shadow/edge artifact rather than an intentional effect. */}
          <div style={{ flex: '1 1 300px', minWidth: 280 }}>
            <div
              className="fade-in-up"
              style={{
                animationDelay: '0.1s', position: 'sticky', top: 24, background: 'var(--surface-card)',
                borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '28px',
                display: 'flex', flexDirection: 'column', gap: 16,
                border: '1.5px solid var(--pink-100)',
              }}
            >
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
              <ApplyAction
                canApply={canApply} profile={profile} matchState={matchState} applying={applying} applyError={applyError}
                existingApplication={existingApplication}
                onApply={handleApply} onSignIn={() => nav('signin', j)} onBackHome={handleBack} onTrackApplication={() => nav('my-applications')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile-only — on a narrow screen the sidebar above (and its Apply
          button) lands below four long paragraphs of description, so the
          one action that matters on this page is invisible until a visitor
          scrolls past everything else. This mirrors the sticky bottom "Apply"
          bar virtually every job board uses on mobile for the same reason.
          Hidden on desktop via .mobile-apply-bar in styles.css. */}
      <div className="mobile-apply-bar">
        <ApplyAction
          canApply={canApply} profile={profile} matchState={matchState} applying={applying} applyError={applyError}
          existingApplication={existingApplication}
          onApply={handleApply} onSignIn={() => nav('signin', j)} onBackHome={handleBack} onTrackApplication={() => nav('my-applications')}
          compact
        />
      </div>

      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default JobDetails;
