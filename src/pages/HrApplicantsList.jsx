// HR — the single unified Applicants surface: every applicant across every
// job posting, filterable/sortable in one table. This used to be two
// separate, differently-designed pages — this cross-job overview table, and
// a whole separate per-job "detail cards" page (HrApplicants.jsx) you
// navigated into for the actual resume/interview review and decide actions —
// which looked and felt like two different apps. Merged into one: click a
// row to expand it in place for the full detail and every action (advance/
// decline, video review, compare, reset password) instead of leaving this
// page. `job` (optional) pre-filters to one posting when arriving from
// a job-scoped link elsewhere (Job Openings, a dashboard "View", a
// PipelineBar stage) — same nav('hr-applicant-list', job, opts) shape the
// old per-job page used, so every existing caller kept working unchanged.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { ActionPill } from '../components/core/ActionPill/ActionPill.jsx';
import { ConfirmModal } from '../components/core/ConfirmModal/ConfirmModal.jsx';
import { FormError } from '../components/feedback/FormError/FormError.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { DROPDOWN_ARROW_STYLE } from '../components/core/Select/Select.jsx';
import { getScoredApplicants } from '../lib/reports.js';
import {
  getApplicationById,
  listApplicationsByIds,
  updateApplicationStatus,
  listDecisionLogForApplications,
  notifyApplicantStatusChange,
  scheduleInterview,
  notifyInterviewScheduled,
  listScheduledInterviewDates,
  sendTestInterviewReminder,
  sendTestScheduleReminder,
} from '../lib/applications.js';
import { computeYearsOfExperience } from '../lib/experience.js';
import { listResumeEvaluationsForApplications, evaluateApplication } from '../lib/resumeEvaluation.js';
import {
  listResponsesForApplications,
  listEvaluationsForApplications,
  evaluateResponse,
  getSignedVideoUrl,
  resetInterviewAttempts,
} from '../lib/interviewEvaluation.js';
import { buildReportCsv, downloadCsv } from '../lib/csvExport.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';
import { MAX_ATTEMPTS } from '../lib/interviewConstants.js';
import { scoreColor } from '../lib/scoreTone.js';

const SCORE_TYPE_OPTIONS = [
  { value: 'total', label: 'Resume + Interview (Combined)' },
  { value: 'resume', label: 'Resume Score Only' },
  { value: 'interview', label: 'Interview Score Only' },
];

const DECISION_META = {
  submitted: { label: 'Awaiting Review', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' },
  interview_stage: { label: 'Interview Stage', bg: '#fff4e0', fg: '#c98500' },
  advanced: { label: 'Advanced', bg: '#e3f6e6', fg: '#0ca30c' },
  declined: { label: 'Declined', bg: 'var(--pink-100)', fg: 'var(--red-700)' },
};

const SELECT_STYLE = {
  fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', padding: '7px 28px 7px 10px', borderRadius: 8,
  background: 'var(--surface-field)', border: 'none', color: 'var(--text-primary)',
  ...DROPDOWN_ARROW_STYLE, backgroundPosition: 'right 8px center',
};

const CALENDAR_ICON = <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
const REOPEN_ICON = <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;
const REFRESH_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 6.5A8 8 0 0 0 4.6 9M4.6 9V4M4.6 9h4.9" /><path d="M6.5 17.5A8 8 0 0 0 19.4 15M19.4 15v5M19.4 15h-4.9" /></svg>;
const WATCH_ICON = <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8V4z" /></svg>;
const ADVANCE_ICON = <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6" /></svg>;
const DECLINE_ICON = <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round"><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></svg>;
const CAL_PREV_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 5 8 12l7 7" /></svg>;
const CAL_NEXT_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>;

// Same circular icon-only button HrDashboard.jsx uses for "re-check
// matches" — was a plain underlined text link here ("Re-evaluate"/
// "Retry"), inconsistent with how the exact same kind of "redo an AI call"
// action looks everywhere else in the HR side of the app.
function RecheckButton({ onClick, title = 'Re-evaluate' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-animate"
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%',
        border: 'none', cursor: 'pointer', background: 'var(--pink-100)', color: 'var(--action-primary-bg)',
      }}
    >
      {REFRESH_ICON}
    </button>
  );
}

// One icon per AccordionSection below — same pink-chip-plus-red-icon
// language used elsewhere in the app (job detail bullets, resume section
// headers), just scoped to this file instead of pulling in ResumeFields.jsx's
// whole icon set for six specific icons.
const ACCORDION_ICON_PROPS = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const SKILLS_ICON = <svg {...ACCORDION_ICON_PROPS}><path d="M12 2l2.6 6.6L21 9.3l-5 4.5 1.4 7.2L12 17.5 6.6 21l1.4-7.2-5-4.5 6.4-.7z" /></svg>;
const EXPERIENCE_ICON = <svg {...ACCORDION_ICON_PROPS}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const EDUCATION_ICON = <svg {...ACCORDION_ICON_PROPS}><path d="M2 9l10-5 10 5-10 5-10-5z" /><path d="M6 11.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" /></svg>;
const NOTE_ICON = <svg {...ACCORDION_ICON_PROPS}><path d="M5 3h11l3 3v15H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>;
const AI_ICON = <svg {...ACCORDION_ICON_PROPS} fill="currentColor" stroke="none"><path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9L12 2z" /></svg>;
const VIDEO_ICON = <svg {...ACCORDION_ICON_PROPS}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>;

// Skills are free text off a resume, not a fixed taxonomy — there's no way
// to have one exact icon per possible skill, so this buckets a skill into
// a broad category by keyword match and shows that category's icon
// instead. Order matters (first match wins): more specific categories
// (driving, language) are checked before the broad catch-alls (tech,
// people) so e.g. "Defensive Driving" doesn't fall into a generic
// transportation-adjacent tech bucket. GENERIC_SKILL_ICON is the fallback
// for anything that doesn't match a known category at all — every skill
// still gets a real icon, just a neutral one, never a blank badge.
const SKILL_ICON_PROPS = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const GENERIC_SKILL_ICON = <svg {...SKILL_ICON_PROPS}><path d="M12 2l2.6 6.6L21 9.3l-5 4.5 1.4 7.2L12 17.5 6.6 21l1.4-7.2-5-4.5 6.4-.7z" /></svg>;
const SKILL_CATEGORIES = [
  {
    key: 'driving',
    match: /driv|license|vehicle|transport|logistics|dispatch/i,
    icon: <svg {...SKILL_ICON_PROPS}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4.5V9M12 15v4.5M5.5 8.5l3.8 2.4M14.7 13.1l3.8 2.4M18.5 8.5l-3.8 2.4M9.3 13.1l-3.8 2.4" /></svg>,
  },
  {
    key: 'language',
    match: /english|tagalog|filipino|bisaya|bilingual|language|translat/i,
    icon: <svg {...SKILL_ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>,
  },
  {
    key: 'customer',
    match: /customer|client|guest|hospitality|receptionist/i,
    icon: <svg {...SKILL_ICON_PROPS}><path d="M3 13.5a9 9 0 0 1 18 0" /><path d="M21 14.5a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3zM3 14.5a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H3z" /></svg>,
  },
  {
    key: 'leadership',
    match: /lead|manag|supervis|team|coordinat|train|mentor/i,
    icon: <svg {...SKILL_ICON_PROPS}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 4.7a3.5 3.5 0 0 1 0 6.6" /><path d="M20 20a6.5 6.5 0 0 0-4-6" /></svg>,
  },
  {
    key: 'communication',
    match: /communicat|negotiat|present|public speak|interpersonal|writing|report/i,
    icon: <svg {...SKILL_ICON_PROPS}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  {
    key: 'design',
    match: /design|photoshop|illustrator|canva|creative|graphic|layout/i,
    icon: <svg {...SKILL_ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.6 1.5-1.3 0-.7-.5-1-.5-1.7 0-.9.8-1.5 1.7-1.5H16a4 4 0 0 0 4-4c0-4.4-3.6-8-8-8z" /><circle cx="8" cy="11" r="1" fill="currentColor" /><circle cx="12" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="11" r="1" fill="currentColor" /></svg>,
  },
  {
    key: 'finance',
    match: /account|finance|budget|bookkeep|audit|payroll|tax/i,
    icon: <svg {...SKILL_ICON_PROPS}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /><circle cx="17" cy="16" r="3" fill="none" /></svg>,
  },
  {
    key: 'office',
    match: /excel|word|powerpoint|office|data entry|encoding|typing|admin|clerical|documentation/i,
    icon: <svg {...SKILL_ICON_PROPS}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg>,
  },
  {
    key: 'tech',
    match: /javascript|python|java|sql|html|css|react|node|coding|programming|software|developer|web|database|system|network|it\b|computer/i,
    icon: <svg {...SKILL_ICON_PROPS}><path d="m9 8-4 4 4 4M15 8l4 4-4 4" /></svg>,
  },
  {
    key: 'data',
    match: /data|analytic|analysis|statistic|research/i,
    icon: <svg {...SKILL_ICON_PROPS}><path d="M4 20V10M12 20V4M20 20v-7" /></svg>,
  },
  {
    key: 'safety',
    match: /safety|first aid|clearance|certificat|compliance/i,
    icon: <svg {...SKILL_ICON_PROPS}><circle cx="12" cy="9" r="6" /><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" /></svg>,
  },
];

// Groups the applicant's free-text skills into these categories instead of
// rendering one badge per individual skill — three skills that all land in
// "tech" (JavaScript, SQL, Networking, say) used to draw the exact same
// icon three separate times, which just repeated itself rather than adding
// information. One badge per category actually present, with a small count
// bubble when more than one skill maps to it, and the full list of what's
// inside on hover.
function groupSkillsByCategory(skills) {
  const groups = new Map();
  for (const skill of skills) {
    const cat = SKILL_CATEGORIES.find((c) => c.match.test(skill));
    const key = cat?.key || 'general';
    if (!groups.has(key)) groups.set(key, { icon: cat?.icon || GENERIC_SKILL_ICON, skills: [] });
    groups.get(key).skills.push(skill);
  }
  return [...groups.values()];
}

// Icon only, no filled circle behind it — the solid red badge was a step
// too far the other way (too heavy for a quick collapsed-row glance). Just
// the icon itself, colored, on nothing — this is only ever the *preview*
// now (shown collapsed, beside the label); the expanded view is
// SkillTextList below, plain readable text instead of more icons.
function SkillBadges({ skills }) {
  const groups = groupSkillsByCategory(skills);
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
      {groups.map((g) => (
        <span
          key={g.skills[0]}
          title={g.skills.join(', ')}
          aria-label={g.skills.join(', ')}
          tabIndex={0}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--action-primary-bg)', flexShrink: 0, cursor: 'default' }}
        >
          {g.icon}
          {g.skills.length > 1 && (
            <span style={{ fontSize: 9, fontWeight: 800, marginLeft: 2, opacity: 0.75 }}>
              {g.skills.length}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

// The expanded view — bulleted plain text instead of another round of
// icons, so an actual skill name is something you read directly rather
// than something you have to hover an icon to discover.
function SkillTextList({ skills }) {
  return (
    <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {skills.map((skill) => (
        <li key={skill} style={{ fontSize: 'var(--text-sm)' }}>{skill}</li>
      ))}
    </ul>
  );
}

const NUM_INPUT_STYLE = {
  width: 56, padding: '7px 8px', textAlign: 'center', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)',
  background: 'var(--surface-field)', border: 'none', borderRadius: 8, color: 'var(--text-primary)',
};

const DATE_INPUT_STYLE = {
  width: 116, padding: '7px 6px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)',
  background: 'var(--surface-field)', border: 'none', borderRadius: 8, color: 'var(--text-primary)',
};

// Mirrors buildPipeline's stage definitions in reports.js exactly — the
// PipelineBar count HR clicked and the list they land on here must agree.
const STAGE_LABELS = {
  screened: 'Initial Screening',
  interviewed: 'Interview',
  decided: 'Decided',
  // Deliberately covers BOTH decision points (submitted -> interview_stage/
  // declined, and interview_stage -> advanced/declined) — the old "Applicant
  // Video Screening Queue" widget on HrPersonnelDashboard.jsx only ever
  // surfaced the second one, so anyone still waiting on their first
  // decision never showed up in any "queue" at all.
  pending: 'Awaiting Your Decision',
  // Mirror reports.js's getPersonnelOverview kpis exactly — these back the
  // two clickable KPI cards on HrPersonnelDashboard.jsx that don't map onto
  // any of the stages above, so the count on the card and the list it lands
  // on always agree.
  'video-pending': 'Video Interview Pending',
  'passed-screening': 'Passed Initial Screening',
};

function scoreFor(candidate, scoreType) {
  if (scoreType === 'resume') return candidate.resumeScore;
  if (scoreType === 'interview') return candidate.interviewScore;
  return candidate.totalScore;
}

// Works off the lightweight cross-job summary (reports.js's `scored`) —
// resumeScore/interviewCompleted/status already carry everything this needs,
// no per-application detail fetch required just to filter by stage.
function matchesStage(s, stage) {
  if (!stage || stage === 'applications') return true;
  if (stage === 'screened') return s.resumeScore != null;
  if (stage === 'interviewed') return s.interviewCompleted;
  if (stage === 'decided') return s.status === 'advanced' || s.status === 'declined';
  // Same condition as reports.js's `videoPending` KPI: advanced into the
  // interview stage but hasn't finished recording all 3 answers yet.
  if (stage === 'video-pending') return s.status === 'interview_stage' && !s.interviewCompleted;
  // Same condition as reports.js's `passedScreening` KPI: anything past the
  // very first "just submitted, nobody's looked yet" state.
  if (stage === 'passed-screening') return s.status !== 'submitted';
  if (stage === 'pending') {
    return (
      (s.status === 'submitted' && s.resumeScore != null)
      || (s.status === 'interview_stage' && s.interviewCompleted)
      // Advanced but no personal interview on the calendar yet — not an
      // Advance/Decline call anymore, but still a real "something HR needs
      // to actually do for this person" item, so it belongs on the same
      // tab rather than needing a trip to Applicants to find it.
      || (s.status === 'advanced' && !s.scheduledInterviewAt)
    );
  }
  return true;
}

// `emphasis` — used for the Overall Score, the actual ranking number (mean
// of resume + interview, reports.js's combineScore) that the "Score Type"
// filter/sort dropdown defaults to and every table row is sorted by, but
// which previously had no badge of its own here at all, only its two
// ingredients. Rendered visually heavier + tinted so it reads as the
// headline number the other two support, not a third equal peer.
function ScoreBadge({ score, status, label, emphasis }) {
  if (score == null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', opacity: 0.5 }}>
          {status === 'error' || status === 'not-started' ? '—' : '…'}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6, textAlign: 'center' }}>{label}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
      <span style={{ fontSize: emphasis ? 'var(--text-3xl)' : 'var(--text-2xl)', fontWeight: 800, color: emphasis ? scoreColor(score) : 'var(--text-primary)' }}>{score}%</span>
      <span style={{ fontSize: 'var(--text-xs)', opacity: emphasis ? 0.75 : 0.6, textAlign: 'center', fontWeight: emphasis ? 700 : 400, color: emphasis ? 'var(--red-700)' : undefined }}>{label}</span>
    </div>
  );
}

function CriteriaChips({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {items.map((c) => (
        <span
          key={c.keyword}
          title={c.reasoning}
          style={{
            fontSize: 'var(--text-xs)', padding: '2px 10px', borderRadius: 999,
            background: c.matched ? 'var(--pink-100)' : 'var(--gray-100)',
            color: c.matched ? 'var(--red-700)' : 'var(--gray-600)', cursor: 'default',
          }}
        >
          {c.matched ? '✓ ' : ''}{c.keyword}
        </span>
      ))}
    </div>
  );
}

function AiAssessment({ evaluation, status, errorMessage, onRetry }) {
  if (evaluation) {
    return (
      <div style={{ marginTop: 12 }}>
        <strong style={{ fontSize: 'var(--text-sm)' }}>AI Assessment</strong>
        <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, marginTop: 6 }}>{evaluation.explanation}</p>
        <CriteriaChips items={evaluation.criteria_assessment} />
        <div style={{ marginTop: 10 }}><RecheckButton onClick={onRetry} title="Re-evaluate" /></div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)' }}>AI evaluation failed{errorMessage ? `: ${errorMessage}` : '.'}</p>
        <div style={{ marginTop: 6 }}><RecheckButton onClick={onRetry} title="Retry" /></div>
      </div>
    );
  }
  return <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 12 }}>AI is evaluating this applicant…</p>;
}

// A centered modal with the actual video and a close button, instead of
// opening the signed URL in a brand-new browser tab — HR used to lose their
// place entirely (scroll position, which questions were expanded) every
// time they wanted to watch one answer, since it navigated fully away from
// this page. Portal-rendered for the same reason ConfirmModal is: this can
// be reached from deep inside a few layers of accordion, each of which sits
// inside a `.fade-in-up` wrapper that would otherwise trap a `position:
// fixed` overlay.
function VideoModal({ url, onClose }) {
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,10,10,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in-up"
        style={{ position: 'relative', width: '100%', maxWidth: 640, background: '#000', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="btn-animate"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 1, width: 34, height: 34, borderRadius: '50%',
            border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></svg>
        </button>
        <video src={url} controls autoPlay style={{ width: '100%', display: 'block', maxHeight: '80vh' }} />
      </div>
    </div>,
    document.body,
  );
}

// One question's summary line for the collapsed header — real signal
// (score, or why there's nothing to score yet), not just a chevron with no
// indication of what's actually inside before you click it.
function interviewRowSummary(response, evaluation, status) {
  if (!response.video_path) {
    return response.attempt_count >= MAX_ATTEMPTS
      ? { text: 'Locked out', tone: 'var(--red-700)' }
      : { text: 'Not answered', tone: undefined };
  }
  if (evaluation) return { text: `${evaluation.evaluation_score}% · ${evaluation.sentiment_label}`, tone: undefined };
  if (status === 'error') return { text: 'Evaluation failed', tone: 'var(--red-700)' };
  return { text: 'Evaluating…', tone: undefined };
}

// Each question is its own accordion row now — was always-expanded, so an
// interview with several questions each carrying a transcript, explanation,
// and score breakdown was exactly the "too much information at once" this
// whole section (and Skills, Experience, etc. above it) got the same
// treatment for. `open`/`onToggle` are owned by InterviewSection below, one
// per question, not tied to the outer applicant-row accordion state.
function InterviewResponseRow({ response, evaluation, status, errorMessage, onRetry, onResetAttempts, onWatch, open, onToggle }) {
  const questionText = response.question_text_snapshot || response.interview_questions?.question_text;
  const summary = interviewRowSummary(response, evaluation, status);
  const rootRef = useRef(null);
  // Same "scroll the thing you just opened to the top" behavior as the
  // outer applicant-row and section accordions — a question's own detail
  // (score breakdown, explanation, transcript) can genuinely run past a
  // short viewport too, same reasoning as everywhere else this pattern is
  // used on this page.
  const handleToggle = () => {
    const willOpen = !open;
    onToggle();
    if (willOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  };
  return (
    <div ref={rootRef} style={{ border: `1.5px solid ${open ? 'var(--pink-100)' : 'var(--border-hairline)'}`, borderRadius: 10, overflow: 'hidden', background: open ? 'var(--pink-100)' : 'var(--surface-card)', marginTop: 8 }}>
      <button
        type="button"
        onClick={handleToggle}
        className="btn-animate"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: open ? 'var(--red-700)' : 'var(--text-primary)' }}>
          {questionText}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, opacity: summary.tone ? 1 : 0.65, color: summary.tone, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {summary.text}
        </span>
        <svg
          width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0, opacity: open ? 1 : 0.55 }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', background: 'var(--surface-card)' }}>
          {!response.video_path ? (
            response.attempt_count >= MAX_ATTEMPTS ? (
              <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)' }}>
                  Used all {MAX_ATTEMPTS} attempts without ever submitting a take — they're locked out of this question on their end.
                </p>
                <div onClick={() => onResetAttempts(response)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', display: 'inline-block' }}>
                  Reset Attempts (let them try again)
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Not answered yet.</p>
            )
          ) : (
            <>
              {/* Watch Answer and Re-evaluate share one row, top-right —
                  Watch Answer is now a real button (was plain underlined
                  text that read as a stray hyperlink, not an action tied to
                  this question), and Re-evaluate sits right next to it
                  instead of buried after the transcript below. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => onWatch(response.video_path)}
                  className="btn-animate"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999,
                    border: '1.5px solid var(--action-primary-bg)', background: 'transparent', color: 'var(--action-primary-bg)',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-xs)', fontWeight: 700,
                  }}
                >
                  {WATCH_ICON} Watch Answer
                </button>
                {evaluation && <RecheckButton onClick={() => onRetry(response.id)} title="Re-evaluate" />}
                {!evaluation && status === 'error' && <RecheckButton onClick={() => onRetry(response.id)} title="Retry" />}
              </div>
              {evaluation ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 'var(--text-xs)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span><strong>{evaluation.evaluation_score}%</strong> overall</span>
                    <span>Sentiment: {evaluation.sentiment_label} ({evaluation.sentiment_score})</span>
                    <span>Relevance: {evaluation.relevance_score}</span>
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', marginTop: 6, lineHeight: 1.5 }}>{evaluation.explanation}</p>
                  {evaluation.transcript && (
                    <div style={{ marginTop: 10, background: 'var(--surface-page-alt)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Applicant's Answer</div>
                      <p style={{ fontSize: 'var(--text-sm)', marginTop: 4, lineHeight: 1.6, color: 'var(--text-primary)' }}>&ldquo;{evaluation.transcript}&rdquo;</p>
                    </div>
                  )}
                </div>
              ) : status === 'error' ? (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)', marginTop: 10 }}>AI evaluation failed{errorMessage ? `: ${errorMessage}` : '.'}</p>
              ) : (
                <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 10 }}>AI is evaluating this answer…</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewSection({ responses, evaluations, evalStatus, evalErrors, onRetry, onResetAttempts, expectedCount }) {
  // Local to this one section, not the outer applicant-row expandedSections
  // Set — a question's open/closed state doesn't need to survive collapsing
  // and reopening "Video Interview" itself, and keeping it scoped here
  // means it doesn't compete with the outer accordion's own keys. A single
  // id (not a Set) on purpose — one question open at a time, opening a
  // second one closes whichever was open, same reasoning as the outer
  // applicant-row accordion (expandedId) above.
  const [openId, setOpenId] = useState(null);
  const toggleQuestion = (id) => setOpenId((prev) => (prev === id ? null : id));
  // The signed URL currently showing in VideoModal, or null when it's
  // closed. Fetched fresh per click rather than cached — these are
  // short-lived signed URLs, not something worth holding onto.
  const [watchingUrl, setWatchingUrl] = useState(null);
  const handleWatch = async (videoPath) => {
    const { data: url } = await getSignedVideoUrl(videoPath);
    if (url) setWatchingUrl(url);
  };

  if (!responses.length) {
    return <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 12 }}>No video interview started yet.</p>;
  }
  // ensureAssignedResponses (src/lib/interview.js) only ever assigns however
  // many unique questions actually exist in this role's category — if the
  // bank has fewer than HR Head's configured count, the applicant silently
  // gets a shorter interview with no signal anywhere that it was short by
  // accident rather than by design. Surfaced here instead of staying silent.
  const short = expectedCount && responses.length < expectedCount;
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Video Interview</strong>
      {short && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)', marginTop: 4 }}>
          Only {responses.length} of the configured {expectedCount} question{expectedCount === 1 ? '' : 's'} were available in this role's category — the question bank may be short.
        </p>
      )}
      {responses.map((r) => (
        <InterviewResponseRow
          key={r.id}
          response={r}
          evaluation={evaluations[r.id]}
          status={evalStatus[r.id]}
          errorMessage={evalErrors[r.id]}
          onRetry={onRetry}
          onResetAttempts={onResetAttempts}
          onWatch={handleWatch}
          open={openId === r.id}
          onToggle={() => toggleQuestion(r.id)}
        />
      ))}
      {watchingUrl && <VideoModal url={watchingUrl} onClose={() => setWatchingUrl(null)} />}
    </div>
  );
}

const COMPARE_ROW_STYLE = { padding: '10px 14px', borderTop: '1px solid var(--border-hairline)', fontSize: 'var(--text-sm)', verticalAlign: 'top' };

function ComparisonPanel({ candidates, onRemove, onClear }) {
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 24px', marginBottom: 16, overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-display)' }}>Comparing {candidates.length} Candidates</strong>
        <div onClick={onClear} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)' }}>Clear</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ ...COMPARE_ROW_STYLE, borderTop: 'none', textAlign: 'left', width: 140 }} />
            {candidates.map((c) => (
              <th key={c.id} style={{ ...COMPARE_ROW_STYLE, borderTop: 'none', textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>{c.application?.full_name || c.name}</div>
                <div onClick={() => onRemove(c.id)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 10, marginTop: 2 }}>Remove</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Resume Match</td>
            {candidates.map((c) => <td key={c.id} style={COMPARE_ROW_STYLE}>{c.resumeScore != null ? `${c.resumeScore}%` : '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Interview Match</td>
            {candidates.map((c) => <td key={c.id} style={COMPARE_ROW_STYLE}>{c.interviewScore != null ? `${c.interviewScore}%` : '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Status</td>
            {candidates.map((c) => <td key={c.id} style={COMPARE_ROW_STYLE}>{(DECISION_META[c.status] || DECISION_META.submitted).label}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Years Experience</td>
            {candidates.map((c) => <td key={c.id} style={COMPARE_ROW_STYLE}>{computeYearsOfExperience(c.application?.work_experience) ?? '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Education</td>
            {candidates.map((c) => <td key={c.id} style={COMPARE_ROW_STYLE}>{c.application?.education_level || '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Skills</td>
            {candidates.map((c) => <td key={c.id} style={COMPARE_ROW_STYLE}>{c.application?.skills?.length ? c.application.skills.join(', ') : (c.skills?.length ? c.skills.join(', ') : '—')}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Driver&rsquo;s License</td>
            {candidates.map((c) => <td key={c.id} style={COMPARE_ROW_STYLE}>{c.application?.drivers_license_type || '—'}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ExperienceList({ items }) {
  if (!items?.length) return null;
  const totalYears = computeYearsOfExperience(items);
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Work Experience</strong>
      {totalYears != null && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}> · {totalYears} yr{totalYears === 1 ? '' : 's'} total (computed)</span>}
      {items.map((e, i) => (
        <div key={i} style={{ fontSize: 'var(--text-sm)', marginTop: 6 }}>
          <div>{e.position} — {e.company} {e.startDate ? `(${e.startDate} to ${e.endDate || 'present'})` : ''}</div>
          {e.description && <div style={{ opacity: 0.8 }}>{e.description}</div>}
        </div>
      ))}
    </div>
  );
}

function EducationList({ items, level }) {
  if (!items?.length && !level) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Education</strong>
      {level && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}> · {level}</span>}
      {items?.map((e, i) => (
        <div key={i} style={{ fontSize: 'var(--text-sm)', marginTop: 6 }}>
          {e.degree} — {e.school} {e.yearGraduated ? `(${e.yearGraduated})` : ''}
        </div>
      ))}
    </div>
  );
}

function DrivingInfo({ application: a }) {
  const parts = [];
  if (a.drivers_license_type) {
    const codes = a.drivers_license_restrictions?.length ? ` (Codes: ${a.drivers_license_restrictions.join(', ')})` : '';
    parts.push(`${a.drivers_license_type} License${codes}`);
  }
  if (a.years_driving_experience != null) parts.push(`${a.years_driving_experience} yr${a.years_driving_experience === 1 ? '' : 's'} driving experience`);
  if (a.has_nbi_clearance != null) parts.push(`NBI/Police Clearance: ${a.has_nbi_clearance ? 'Yes' : 'No'}`);
  if (a.willing_shifting_schedule != null) parts.push(`Shifting Schedule: ${a.willing_shifting_schedule ? 'Willing' : 'Not willing'}`);
  if (a.has_medical_certificate != null) parts.push(`Medical/Fitness Certificate: ${a.has_medical_certificate ? 'Yes' : 'No'}`);
  if (!parts.length) return null;
  return (
    <div style={{ fontSize: 'var(--text-sm)', marginTop: 12 }}>
      <strong>Driving / Work Eligibility:</strong> {parts.join(' · ')}
    </div>
  );
}

function CertificationList({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Certifications</strong>
      {items.map((c, i) => (
        <div key={i} style={{ fontSize: 'var(--text-sm)', marginTop: 6 }}>
          {c.title} {c.issuer ? `— ${c.issuer}` : ''} {c.year ? `(${c.year})` : ''}
        </div>
      ))}
    </div>
  );
}

// Real accordion — each section is its own bordered row with the content
// nested directly beneath it, not a shared strip of small pill toggles
// sitting above one flat stack of whichever content blocks happen to be
// open. One section open at a time (isSectionOpen/toggleSection is a
// single key, not a Set) — opening Experience closes Skills if it was
// open, same as the applicant-row and interview-question accordions
// elsewhere on this page.
//
// A leading icon chip (same pink-100-circle-with-red-icon language used
// everywhere else in this app — job detail bullets, resume section
// headers) plus a red border/tint once open, instead of a flat gray-bordered
// row that read as dull regardless of state.
// `preview` — an optional glance at the content, shown inline beside the
// label itself while collapsed (e.g. Skills' icon badges), so it's visible
// without clicking anything at all. Hidden once actually open, since
// `children` shows the full version right below at that point.
function AccordionSection({ icon, open, label, count, onClick, preview, children }) {
  const rootRef = useRef(null);
  // Same "scroll the thing you just opened to the top" behavior as the
  // outer applicant-row accordion — opening Video Interview (a tall
  // section) used to leave its own content below the fold just like an
  // expanded applicant row used to, before that got the same fix. `open`
  // here is still the *previous* value at the moment of the click (props
  // haven't updated yet), so `!open` means "about to open."
  const handleClick = () => {
    const willOpen = !open;
    onClick();
    if (willOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  };
  return (
    <div ref={rootRef} style={{ border: `1.5px solid ${open ? 'var(--pink-100)' : 'var(--border-hairline)'}`, borderRadius: 10, overflow: 'hidden', background: open ? 'var(--pink-100)' : 'var(--surface-card)' }}>
      <button
        type="button"
        onClick={handleClick}
        className="btn-animate"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: open ? '#fff' : 'var(--pink-100)', color: 'var(--action-primary-bg)',
          }}>
            {icon}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: open ? 'var(--red-700)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {label}{count != null && ` (${count})`}
          </span>
        </span>
        {!open && preview && <span style={{ minWidth: 0, overflow: 'hidden' }}>{preview}</span>}
        <span style={{ flex: 1 }} />
        <svg
          width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0, opacity: open ? 1 : 0.55 }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div style={{ padding: '0 14px 14px', background: 'var(--surface-card)' }}>{children}</div>}
    </div>
  );
}

// `datetime-local` inputs need "YYYY-MM-DDTHH:mm" in the viewer's own local
// time, not a raw ISO string (which is UTC) — otherwise the prefilled value
// on "Reschedule" would silently show a different clock time than what was
// actually saved.
function toLocalInputValue(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SCHEDULE_FIELD_STYLE = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 'var(--text-md)', fontFamily: 'var(--font-ui)',
  background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)', border: 'none', borderRadius: 8, color: 'var(--text-primary)',
};

// Only these three actually have HR staff available to conduct an in-person
// interview — a free-text field let a location get typed in that nobody
// could actually staff.
const SCHEDULE_LOCATIONS = ['Baguio', 'Caloocan', 'Cubao'];
const SCHEDULE_SELECT_STYLE = { ...SCHEDULE_FIELD_STYLE, ...DROPDOWN_ARROW_STYLE, paddingRight: 40, fontWeight: 600 };

const CAL_NAV_BTN_STYLE = {
  width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'var(--surface-page-alt)', color: 'var(--text-primary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Fixed slots, not a free-typed time — an interview needs real HR staff
// physically at one of three terminals (Baguio/Caloocan/Cubao) to conduct
// it, and a free time input let one get booked for 2:13am with nothing
// stopping it. Also what makes the calendar's per-day booking count
// actually meaningful, instead of an unbounded continuum nothing can be
// compared against.
const SCHEDULE_TIME_SLOTS = [
  { value: '07:00', label: '7:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '15:00', label: '3:00 PM' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}
function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Real booking density, not a static picker — every mount re-fetches every
// application's scheduled_interview_at (company-wide, every job, not just
// this one) so "which day is already busiest" reflects the actual current
// schedule the moment HR opens this, not a guess. `excludeApplicationId`
// keeps a Reschedule from counting the applicant's own existing slot as if
// it belonged to someone else.
function useScheduleDensity(excludeApplicationId) {
  const [byDate, setByDate] = useState(null);
  useEffect(() => {
    let cancelled = false;
    listScheduledInterviewDates().then(({ data }) => {
      if (cancelled) return;
      const map = new Map();
      for (const row of data || []) {
        if (row.id === excludeApplicationId) continue;
        const key = dateKey(new Date(row.scheduled_interview_at));
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
      }
      setByDate(map);
    });
    return () => {
      cancelled = true;
    };
  }, [excludeApplicationId]);
  return byDate;
}

// Replaces the browser's own native datetime-local calendar (rendered by
// the OS, completely outside this app's control) with a real month grid HR
// can click through, each day showing how many personal interviews are already
// booked that day — the actual point of this, so a new slot can be picked
// around the existing busiest/quietest days instead of blind. Emits the
// same "YYYY-MM-DDTHH:mm" local string SchedulePanel already expected from
// the old input, so nothing downstream (onSave, the ISO conversion) had to
// change.
function InterviewCalendarPicker({ value, onChange, excludeApplicationId }) {
  const initial = value ? new Date(value) : null;
  const [viewMonth, setViewMonth] = useState(() => {
    const d = initial || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(initial ? dateKey(initial) : null);
  const [time, setTime] = useState(initial ? `${pad2(initial.getHours())}:${pad2(initial.getMinutes())}` : '');
  const byDate = useScheduleDensity(excludeApplicationId);

  const today = new Date();
  const todayKey = dateKey(today);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function emit(key, t) {
    if (key && t) onChange(`${key}T${t}`);
  }
  function pickDay(d) {
    const key = dateKey(new Date(year, month, d));
    setSelectedDate(key);
    emit(key, time);
  }
  function pickTime(t) {
    setTime(t);
    emit(selectedDate, t);
  }

  const selectedDayInfo = selectedDate ? byDate?.get(selectedDate) : null;

  return (
    <div style={{ background: 'var(--surface-field)', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))} style={CAL_NAV_BTN_STYLE} aria-label="Previous month">{CAL_PREV_ICON}</button>
        <strong style={{ fontSize: 'var(--text-sm)' }}>{viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))} style={CAL_NAV_BTN_STYLE} aria-label="Next month">{CAL_NEXT_ICON}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 2 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, opacity: 0.5, padding: '2px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (d == null) return <div key={`blank-${i}`} />;
          const cellDate = new Date(year, month, d);
          const key = dateKey(cellDate);
          const count = byDate?.get(key)?.length || 0;
          const isSelected = key === selectedDate;
          const isToday = key === todayKey;
          // Disabled/dimmed for a past day, unless it's the appointment
          // already on file — rescheduling something already booked in the
          // past should still show where it currently sits, not hide it.
          const isPast = cellDate < todayStart && !isSelected;
          return (
            <button
              key={key} type="button" onClick={() => pickDay(d)} disabled={isPast}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                width: '100%', boxSizing: 'border-box', height: 40, padding: 0, margin: 0, borderRadius: 8, fontFamily: 'var(--font-ui)',
                border: isToday && !isSelected ? '1.5px solid var(--action-primary-bg)' : 'none',
                background: isSelected ? 'var(--action-primary-bg)' : 'transparent',
                color: isSelected ? '#fff' : 'var(--text-primary)',
                opacity: isPast ? 0.3 : 1, cursor: isPast ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: isSelected || isToday ? 700 : 400 }}>{d}</span>
              {count > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, lineHeight: 1, minWidth: 14, padding: '2px 4px', borderRadius: 999,
                  background: isSelected ? 'rgba(255,255,255,0.3)' : 'var(--pink-100)',
                  color: isSelected ? '#fff' : 'var(--action-primary-bg)',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Time</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
          {SCHEDULE_TIME_SLOTS.map((slot) => {
            const isSelected = time === slot.value;
            return (
              <button
                key={slot.value} type="button" onClick={() => pickTime(slot.value)} disabled={!selectedDate}
                style={{
                  padding: '9px 2px', borderRadius: 8, border: 'none', fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap',
                  background: isSelected ? 'var(--action-primary-bg)' : 'var(--surface-page-alt)',
                  color: isSelected ? '#fff' : 'var(--text-primary)',
                  opacity: !selectedDate ? 0.5 : 1, cursor: !selectedDate ? 'not-allowed' : 'pointer',
                }}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDayInfo?.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 'var(--text-xs)', opacity: 0.7 }}>
          {selectedDayInfo.length} interview{selectedDayInfo.length === 1 ? '' : 's'} already scheduled this day:
          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
            {selectedDayInfo
              .slice()
              .sort((a, b) => new Date(a.scheduled_interview_at) - new Date(b.scheduled_interview_at))
              .map((row) => (
                <li key={row.id}>
                  {new Date(row.scheduled_interview_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} — {row.full_name}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Only ever shown for an already-advanced applicant — scheduling is
// additional detail layered on top of "Advanced," not a new pipeline stage,
// so it doesn't touch the status column at all (see scheduleInterview in
// applications.js). It's always framed as a personal (in-person) interview.
function SchedulePanel({ application: a, onSave, saving }) {
  const [editing, setEditing] = useState(!a.scheduled_interview_at);
  const [dateTime, setDateTime] = useState(a.scheduled_interview_at ? toLocalInputValue(a.scheduled_interview_at) : '');
  const [location, setLocation] = useState(a.scheduled_interview_location || '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 'sending' | 'sent' | 'error' — send-schedule-reminders is otherwise
  // cron-only, no way to see what the "your interview is tomorrow" email
  // actually looks like short of waiting on real elapsed time.
  const [testReminderStatus, setTestReminderStatus] = useState(null);
  async function handleSendTestReminder() {
    setTestReminderStatus('sending');
    const { error } = await sendTestScheduleReminder(a.id);
    setTestReminderStatus(error ? 'error' : 'sent');
    if (error) window.alert(`Could not send the test reminder: ${error.message}`);
    setTimeout(() => setTestReminderStatus(null), 4000);
  }
  // Schedule Interview isn't a native `disabled` button on purpose — that
  // swallows the click with no feedback at all. It still looks and acts
  // locked until both fields are filled, it just rejects the click with a
  // visible reason instead (same pattern as Interview.jsx's DeviceCheck
  // "Continue" button). `lockWarning` is a counter, not a boolean, so the
  // shake replays on every repeat click, not just the first.
  const [lockWarning, setLockWarning] = useState(0);
  const [lockWarningVisible, setLockWarningVisible] = useState(false);
  const lockWarningTimeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(lockWarningTimeoutRef.current), []);

  // Shown briefly right after a save actually lands (first-time or
  // reschedule), then clears itself — separate from the read-only view
  // underneath it, which just stays up permanently as the ongoing record.
  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(justSavedTimeoutRef.current), []);

  // A successful save changes `a.scheduled_interview_at` (the parent re-fetches
  // and passes the updated application back down) — that's the signal to drop
  // out of the form into the read-only confirmation view, since onSave itself
  // is fire-and-forget from this component's side, not an awaited promise.
  // Only fires the "saved" toast when this effect is the thing actually
  // closing the form (`editing` was still true going into it) — reading
  // `editing` here without declaring it as a dependency is deliberate, same
  // as the original version of this effect: it means "was I mid-edit right
  // before this timestamp changed," not "re-run whenever editing changes,"
  // which would also fire on a bare "Reschedule" click reopening the form.
  useEffect(() => {
    if (a.scheduled_interview_at && editing) {
      setEditing(false);
      setJustSaved(true);
      clearTimeout(justSavedTimeoutRef.current);
      justSavedTimeoutRef.current = setTimeout(() => setJustSaved(false), 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.scheduled_interview_at]);

  if (!editing && a.scheduled_interview_at) {
    const when = new Date(a.scheduled_interview_at).toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    return (
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
        {justSaved && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#e3f6e6', color: '#0ca30c', borderRadius: 999, padding: '5px 12px', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 10 }}>
            {ADVANCE_ICON} Changes saved
          </div>
        )}
        <strong style={{ fontSize: 'var(--text-sm)' }}>Personal Interview Scheduled</strong>
        <div style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>{when}</div>
        {a.scheduled_interview_location && <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 2 }}>{a.scheduled_interview_location}</div>}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {CALENDAR_ICON} Reschedule
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSendTestReminder} disabled={testReminderStatus === 'sending'}>
            {testReminderStatus === 'sending' ? 'Sending…' : 'Send Test Reminder'}
          </Button>
          {testReminderStatus === 'sent' && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--action-primary-bg)', fontWeight: 700 }}>Sent to {a.email}</span>}
          {testReminderStatus === 'error' && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)', fontWeight: 700 }}>Failed to send</span>}
        </div>
      </div>
    );
  }

  const ready = Boolean(dateTime) && Boolean(location);
  const lockReason = !dateTime && !location
    ? 'Pick a date, time, and location before scheduling.'
    : !dateTime
      ? 'Pick a date and time before scheduling.'
      : 'Pick a location before scheduling.';

  function handleScheduleClick() {
    if (!ready) {
      setLockWarning((n) => n + 1);
      setLockWarningVisible(true);
      clearTimeout(lockWarningTimeoutRef.current);
      lockWarningTimeoutRef.current = setTimeout(() => setLockWarningVisible(false), 4000);
      return;
    }
    setConfirmOpen(true);
  }

  const confirmWhen = dateTime
    ? new Date(dateTime).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
      <ConfirmModal
        open={confirmOpen}
        title="Confirm Interview Schedule"
        message={`Schedule ${a.full_name || 'this applicant'} for a personal interview on ${confirmWhen} at ${location}?`}
        confirmLabel={saving ? 'Saving…' : 'Confirm'}
        confirmDisabled={saving}
        onConfirm={() => {
          setConfirmOpen(false);
          onSave({ scheduledAt: new Date(dateTime).toISOString(), location });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      <strong style={{ fontSize: 'var(--text-sm)' }}>Schedule Personal Interview</strong>
      {/* width:100% + margin:auto, not just maxWidth — a fixed maxWidth
          alone left-hugs inside whatever wider container this sits in
          (the 440px ScheduleModal, or the much wider expanded-row detail
          panel), leaving a lopsided gap of unused space on the right of
          both the calendar and the button below it. Centering it instead
          keeps a sane cap on how wide the calendar grid gets while never
          looking stranded off to one side. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 360, margin: '8px auto 0' }}>
        <InterviewCalendarPicker value={dateTime} onChange={setDateTime} excludeApplicationId={a.id} />
        <select value={location} onChange={(e) => setLocation(e.target.value)} style={SCHEDULE_SELECT_STYLE}>
          {/* Not `disabled` — a disabled option renders visibly dimmed/
              grayed inside the closed select box in every major browser,
              no CSS override reaches that. Schedule Interview already
              stays locked until a real location is picked (see below), so
              leaving this reselectable costs nothing. */}
          <option value="">Select a location</option>
          {SCHEDULE_LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span key={lockWarning} className={lockWarning > 0 && !ready ? 'shake-row' : undefined} style={{ flex: 1, display: 'block' }}>
            <Button
              variant="strong" size="sm" onClick={handleScheduleClick} disabled={saving}
              style={{ width: '100%', ...(ready ? null : { opacity: 0.5 }) }}
            >
              {saving ? 'Saving…' : a.scheduled_interview_at ? 'Save Changes' : 'Schedule Interview'}
            </Button>
          </span>
          {a.scheduled_interview_at && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} style={{ flex: 1 }}>
              Cancel
            </Button>
          )}
        </div>
        {lockWarningVisible && !ready && <FormError message={lockReason} />}
      </div>
    </div>
  );
}

// Row-level "Schedule Interview" quick action's modal — same SchedulePanel
// used in the expanded detail view, just reachable without expanding the
// row and scrolling to it first. `a` loads the same way the review modal's
// does (loadDetail, fired the moment this opens).
function ScheduleModal({ s, a, onSave, saving, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,10,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in-up"
        role="dialog"
        aria-modal="true"
        aria-label={`Schedule interview for ${s.name}`}
        style={{ background: 'var(--surface-card)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', width: '100%', maxWidth: 440, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '22px 26px 4px' }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 'var(--text-lg)', margin: 0 }}>{s.name}</h2>
            <div style={{ fontSize: 'var(--text-sm)', opacity: 0.65, marginTop: 2 }}>{s.job?.title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--surface-page-alt)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {CLOSE_ICON}
          </button>
        </div>
        <div style={{ padding: '0 26px 26px' }}>
          {!a ? (
            <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6, marginTop: 12 }}>Loading applicant details…</p>
          ) : (
            <SchedulePanel application={a} onSave={onSave} saving={saving} />
          )}
        </div>
      </div>
    </div>
  );
}

const CLOSE_ICON = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></svg>;

const TOOLBAR_ICON_PROPS = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const COMPARE_ICON = <svg {...TOOLBAR_ICON_PROPS}><rect x="3" y="3" width="13" height="13" rx="2.5" /><rect x="8" y="8" width="13" height="13" rx="2.5" /></svg>;
const SELECT_ICON = <svg {...TOOLBAR_ICON_PROPS}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-4.5" /></svg>;
const EXPORT_ICON = <svg {...TOOLBAR_ICON_PROPS}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 20h16" /></svg>;

// The whole point of this modal: Advance/Decline on the Decisions tab used
// to fire straight off the row's bare score, with the actual resume/
// interview evidence a click-and-scroll away in a separate expand. This
// puts that evidence — the same AiAssessment/InterviewSection already used
// on the Applicants tab, not a re-summarized copy — directly in the path of
// the decision itself, so confirming means having actually seen it.
function DecisionReviewModal({
  s, a, toStatus, onConfirm, onCancel, onPickAction, confirming,
  evaluation, evalStat, evalErrorMsg, onRetryResume,
  interviewResponses, interviewEvaluations, interviewEvalStatus, interviewEvalErrors, onRetryInterview, onResetAttempts, expectedCount,
  positionsFilled, openPositions,
}) {
  const actionLabel = toStatus === 'declined' ? 'Decline' : toStatus === 'interview_stage' ? 'Advance to Interview' : 'Advance';
  const isDecline = toStatus === 'declined';
  const advanceTo = s.status === 'submitted' ? 'interview_stage' : 'advanced';
  const advanceLabel = s.status === 'submitted' ? 'Advance to Interview' : 'Advance';
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,10,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in-up"
        role="dialog"
        aria-modal="true"
        aria-label={`Review ${s.name}`}
        style={{ background: 'var(--surface-card)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '22px 26px 16px', borderBottom: '1px solid var(--border-hairline)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 4 }}>Review Before You Decide</div>
            <h2 style={{ fontWeight: 700, fontSize: 'var(--text-lg)', margin: 0 }}>{s.name}</h2>
            <div style={{ fontSize: 'var(--text-sm)', opacity: 0.65, marginTop: 2 }}>{s.job?.title}</div>
          </div>
          <button onClick={onCancel} aria-label="Close" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--surface-page-alt)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {CLOSE_ICON}
          </button>
        </div>

        <div style={{ padding: '18px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {toStatus === 'advanced' && positionsFilled && (
            <div style={{ background: '#fff4e0', borderRadius: 10, padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#a3690b', fontWeight: 600, marginBottom: 4 }}>
              ⚠️ All {openPositions} open position{openPositions === 1 ? '' : 's'} for this job already have an advanced candidate. Advancing another means going over that target — still your call.
            </div>
          )}
          {!a ? (
            <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>Loading applicant details…</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 20 }}>
                <ScoreBadge score={s.totalScore} label="Overall" emphasis />
                <ScoreBadge score={s.resumeScore} label="Resume" />
                <ScoreBadge score={s.interviewScore} label="Interview" />
              </div>
              {s.skills?.length > 0 && (
                <div style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>
                  <span style={{ opacity: 0.6 }}>Skills: </span>{s.skills.join(', ')}
                </div>
              )}
              <AiAssessment evaluation={evaluation} status={evalStat} errorMessage={evalErrorMsg} onRetry={onRetryResume} />
              <InterviewSection
                responses={interviewResponses}
                evaluations={interviewEvaluations}
                evalStatus={interviewEvalStatus}
                evalErrors={interviewEvalErrors}
                onRetry={onRetryInterview}
                onResetAttempts={onResetAttempts}
                expectedCount={expectedCount}
              />
            </>
          )}
        </div>

        <div style={{ padding: '16px 26px', borderTop: '1px solid var(--border-hairline)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {toStatus ? (
            <>
              <Button variant="ghost" size="md" onClick={onCancel} disabled={confirming}>Cancel</Button>
              <Button variant={isDecline ? 'outline' : 'strong'} size="md" onClick={onConfirm} disabled={confirming || !a}>
                {confirming ? 'Saving…' : <>{isDecline ? DECLINE_ICON : ADVANCE_ICON} {`Confirm ${actionLabel}`}</>}
              </Button>
            </>
          ) : (
            // No "Close" here — the circular X in the header already does
            // the exact same thing (onCancel), and having both was a
            // redundant second exit right next to the real decisions.
            (s.status === 'submitted' || s.status === 'interview_stage') && (
              <>
                <Button variant="outline" size="md" onClick={() => onPickAction('declined')} disabled={!a}>{DECLINE_ICON} Decline</Button>
                <Button variant="strong" size="md" onClick={() => onPickAction(advanceTo)} disabled={!a}>{ADVANCE_ICON} {advanceLabel}</Button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

// One candidate within a job's ranked group — Advance/Decline both open the
// review modal (handleRequestReview) instead of deciding straight from
// here, same reasoning as the modal's own comment above.
function DecisionCandidateCard({ s, rank, deciding, onRequestReview, multiSelectMode, selected, onToggleSelect, compareMode, compareSelected, compareDisabled, onToggleCompare, positionsFilled }) {
  // Only the final call (interview_stage -> advanced) actually spends a
  // position — advancing someone from submitted into the video-interview
  // stage doesn't, so the tag only applies to candidates one decision away
  // from actually filling a slot that's already gone. Purely informational
  // — Advance/Decline stay fully clickable either way, still HR's call.
  const showPositionsFilledTag = positionsFilled && s.status === 'interview_stage';
  const isTop = rank === 1;
  return (
    <div
      className="hover-lift"
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: isTop ? '18px 22px' : '14px 22px', cursor: 'pointer',
        background: isTop ? 'var(--pink-100)' : 'var(--surface-card)',
        border: isTop ? '1px solid var(--action-primary-bg)' : '1px solid var(--border-hairline)',
        borderRadius: 14, boxShadow: 'var(--shadow-card)',
      }}
      // Clicking the card itself (not one of its two buttons) opens the
      // same review modal in a neutral "just looking" mode — no toStatus
      // pre-picked, Advance/Decline offered from inside it instead. One
      // modal, one place candidate evidence lives, instead of a second,
      // separate expand-to-preview path that shows nothing in this
      // card-based layout (unlike the Applicants tab's inline row expand).
      onClick={() => onRequestReview(s.applicationId, null)}
    >
      {(multiSelectMode || compareMode) && (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={multiSelectMode ? selected : compareSelected}
            disabled={compareMode && !compareSelected && compareDisabled}
            onChange={multiSelectMode ? onToggleSelect : onToggleCompare}
            aria-label={`Select ${s.name}`}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
        </div>
      )}
      <span style={{ fontSize: isTop ? 22 : 'var(--text-sm)', fontWeight: 800, width: 30, textAlign: 'center', flexShrink: 0, color: isTop ? undefined : 'var(--text-primary)', opacity: isTop ? 1 : 0.45 }}>
        {RANK_MEDAL[rank - 1] || `#${rank}`}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{s.name}</span>
          {showPositionsFilledTag && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fff4e0', color: '#a3690b', whiteSpace: 'nowrap' }}>
              Positions already filled
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{s.email}</div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexShrink: 0 }}>
        <ScoreBadge score={s.totalScore} label="Overall" emphasis={isTop} />
        <ScoreBadge score={s.resumeScore} label="Resume" />
        <ScoreBadge score={s.interviewScore} label="Interview" />
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {s.status === 'submitted' || s.status === 'interview_stage' ? (
          <>
            <Button
              variant="strong" size="sm" disabled={deciding}
              onClick={() => onRequestReview(s.applicationId, s.status === 'submitted' ? 'interview_stage' : 'advanced')}
            >
              {ADVANCE_ICON} {s.status === 'submitted' ? 'Advance to Interview' : 'Advance'}
            </Button>
            <Button variant="outline" size="sm" disabled={deciding} onClick={() => onRequestReview(s.applicationId, 'declined')}>{DECLINE_ICON} Decline</Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// An advanced candidate who already won their Advance/Decline call — not
// ranked against anyone (there's nothing left to compare), just waiting on
// HR to put a date on the calendar for their in-person interview at Cubao.
function ScheduleCandidateCard({ s, onOpenSchedule }) {
  return (
    <div
      className="hover-lift"
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px', cursor: 'pointer',
        background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 14, boxShadow: 'var(--shadow-card)',
      }}
      onClick={() => onOpenSchedule(s.applicationId)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{s.name}</div>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{s.email}</div>
      </div>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'var(--pink-100)', color: 'var(--action-primary-bg)', whiteSpace: 'nowrap' }}>
        Advanced · Not yet scheduled
      </span>
      <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
        <Button variant="strong" size="sm" onClick={() => onOpenSchedule(s.applicationId)}>Schedule Interview</Button>
      </div>
    </div>
  );
}

export function HrApplicantsList({ nav, profile, job, stageFilter }) {
  // Which sidebar tab this actually is — "Decisions" (a pre-filtered,
  // decision-focused entry point) and "Applicants" (the full directory)
  // both render this same component, just landing on a different default
  // stage filter. Based on the original `stageFilter` prop, not the live
  // `activeStageFilter` state, so the tab stays highlighted correctly even
  // if HR clears/changes the filter once they're on the page. Declared
  // first since groupedByJob's useMemo below reads it.
  const isDecisionsTab = stageFilter === 'pending';
  const [scored, setScored] = useState(null);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState(job || null);
  const [scoreType, setScoreType] = useState('total');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [activeStageFilter, setActiveStageFilter] = useState(stageFilter || null);
  const [interviewQuestionCount, setInterviewQuestionCount] = useState(null);

  useEffect(() => { setJobFilter(job || null); }, [job]);
  useEffect(() => { setActiveStageFilter(stageFilter || null); }, [stageFilter, job]);

  const load = () => {
    getScoredApplicants().then(({ data, error: err }) => {
      if (err) setError(err.message || 'Failed to load applicants.');
      else setScored(data.scored);
    });
  };
  useEffect(load, []);
  useEffect(() => {
    getScreeningSettings().then(({ data }) => {
      if (data) setInterviewQuestionCount(data.interview_question_count);
    });
  }, []);

  // Expanded-row detail — lazy-fetched per applicationId the moment a row is
  // opened (or added to Compare), never for the whole filtered set up front.
  // The overview table above already has everything it needs from the
  // lightweight cross-job summary; only actually opening a row costs a
  // real per-applicant fetch.
  const [expandedId, setExpandedId] = useState(null);
  // One applicant expanded at a time (expandedId is a single value, not a
  // Set) — this is what lets a newly-opened row scroll itself to center: no
  // ambiguity about which row "the" open one is.
  const rowRefs = useRef({});
  // Tracks the applicant the *most recent* open click was for, read back
  // after loadDetail's async fetch resolves — plain `expandedId` would be
  // stale by then (closed over at click time), so a fast close-before-load
  // couldn't otherwise be told apart from "still the row we opened."
  const openRequestRef = useRef(null);
  const [detailLoading, setDetailLoading] = useState({});
  const [fullApplications, setFullApplications] = useState({});
  const [evaluations, setEvaluations] = useState({});
  const [evalStatus, setEvalStatus] = useState({});
  const [evalErrors, setEvalErrors] = useState({});
  const [interviewResponses, setInterviewResponses] = useState({});
  const [interviewEvaluations, setInterviewEvaluations] = useState({});
  const [interviewEvalStatus, setInterviewEvalStatus] = useState({});
  const [interviewEvalErrors, setInterviewEvalErrors] = useState({});
  const [decisionLog, setDecisionLog] = useState({});
  const [decidingId, setDecidingId] = useState(null);
  // { applicationId, toStatus } while the Decisions tab's review-before-
  // deciding modal is open — Advance/Decline there no longer fires
  // immediately off the bare score in the row; it opens this to show the
  // actual resume/interview evidence first, then confirms from inside it.
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewConfirming, setReviewConfirming] = useState(false);
  const [schedulingId, setSchedulingId] = useState(null);
  // Per-applicationId 'sending' | 'sent' | 'error', for the "Send Test
  // Reminder" buttons below — both reminder emails are otherwise cron-only
  // with no way for HR to see what they actually look like short of
  // waiting on real elapsed time.
  const [testReminderStatus, setTestReminderStatus] = useState({});
  // applicationId while the row-level "Schedule Interview" quick action's
  // modal is open — same reasoning as reviewTarget above: a personal
  // interview needs scheduling the moment someone's advanced, and that
  // used to only be reachable by expanding the row and scrolling to it.
  const [scheduleTargetId, setScheduleTargetId] = useState(null);
  // True only when this modal opened as the immediate next step after a
  // fresh Advance decision (handleConfirmReview below) — not when it's
  // reopened later from the "needs scheduling" list (ScheduleCandidateCard).
  // Closing it in that fresh-advance case without actually saving a slot
  // used to leave the applicant with zero notification at all: "Advanced"
  // no longer sends its own status-change email (see handleDecide), on the
  // assumption scheduling always happens in the same breath — so backing
  // out here needs its own fallback, or the applicant hears nothing until
  // HR happens to come back and finish scheduling them, however long that
  // takes.
  const [scheduleIsFreshAdvance, setScheduleIsFreshAdvance] = useState(false);
  // A single key (not a Set) — one section (Skills, Experience, AI
  // Assessment, etc.) open at a time per applicant, same reasoning as
  // expandedId above (one applicant row at a time) and InterviewSection's
  // own per-question openId. Only ever one applicant's sections are
  // actually on screen at once anyway (sections only render inside the
  // single expanded row), so a flat key works without needing to scope it
  // any further.
  const [openSectionKey, setOpenSectionKey] = useState(null);
  // The applicant pending a "Reopen" confirmation — null when no confirm
  // dialog is open. Branded ConfirmModal instead of window.confirm(), same
  // reasoning as every other destructive/reversal action in this app.
  const [pendingReopen, setPendingReopen] = useState(null);
  // Off by default — the select-all-the-time checkbox column was in the way
  // for the common case of just looking someone up. HR turns it on
  // deliberately via the "Select" toggle when they actually want to
  // bulk-decline a batch, and it turns itself back off (clearing whatever
  // was selected) once they're done, rather than lingering.
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeclining, setBulkDeclining] = useState(false);
  // Same idea, for building a comparison instead of a decline batch — used
  // to only be reachable by expanding a row and clicking a tiny "+ Compare"
  // link one candidate at a time. A checkbox column (like Select's) lets HR
  // check off up to 3 candidates directly from the collapsed table, no
  // expanding required, which is the actual point of comparing: eyeballing
  // several rows at once before committing to opening any of them.
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState(() => new Set());
  const [exportingCsv, setExportingCsv] = useState(false);

  const sectionKey = (id, section) => `${id}::${section}`;
  const isSectionOpen = (id, section) => openSectionKey === sectionKey(id, section);
  const toggleSection = (id, section) => setOpenSectionKey((prev) => {
    const key = sectionKey(id, section);
    return prev === key ? null : key;
  });

  // Split out of loadDetail and run on *every* expand, not just the first —
  // a re-record can happen at any point while HR is mid-session (open this
  // applicant, look at others, come back), and the rest of loadDetail's
  // fetch is gated behind a "only load once" cache (fullApplications) that
  // would otherwise leave this showing the same stale evaluation forever
  // for the rest of that session.
  async function refreshInterviewSection(applicationId) {
    const [responsesResult, interviewEvalResult] = await Promise.all([
      listResponsesForApplications([applicationId]),
      listEvaluationsForApplications([applicationId]),
    ]);
    const responses = responsesResult.data || [];
    setInterviewResponses((m) => ({ ...m, [applicationId]: responses }));
    const responseById = {};
    for (const r of responses) responseById[r.id] = r;
    const interviewEvalMap = {};
    // A re-record overwrites the same interview_responses row in place
    // (see uploadResponseVideo) — video_path/response id don't change, only
    // submitted_at moves forward. If that happened after HR already had this
    // answer evaluated, the cached row here still describes the *old* take,
    // so it's treated as stale (not displayed, and re-evaluated below)
    // rather than shown as if it still matches what's now playable.
    for (const e of interviewEvalResult.data || []) {
      const r = responseById[e.response_id];
      const stale = r?.submitted_at && new Date(r.submitted_at) > new Date(e.evaluated_at);
      if (!stale) interviewEvalMap[e.response_id] = e;
    }
    // A plain merge would only ever *add* entries — on a second expand, a
    // response that was fresh last time but is stale now would keep
    // showing its old cached evaluation (from the earlier merge) for the
    // few seconds until the re-evaluation below finishes, instead of the
    // "AI is evaluating this answer…" state it should show meanwhile. Each
    // of this application's responses is explicitly set or cleared instead.
    setInterviewEvaluations((m) => {
      const next = { ...m };
      for (const r of responses) {
        if (interviewEvalMap[r.id]) next[r.id] = interviewEvalMap[r.id];
        else delete next[r.id];
      }
      return next;
    });

    // Same safety net for any answered interview response that's either
    // never been evaluated, or whose cached evaluation was just excluded
    // above as stale — interviewEvalMap only has the fresh ones. Run
    // concurrently, not one at a time — each is an independent video+Gemini
    // call taking several seconds on its own, so evaluating e.g. 3 answers
    // sequentially meant waiting for the *sum* of all three instead of just
    // the slowest one. Each iteration only ever touches its own r.id key in
    // the state maps below, so there's no shared-state race between them.
    const missingInterviewEvals = responses.filter((r) => r.video_path && !interviewEvalMap[r.id]);
    await Promise.all(missingInterviewEvals.map(async (r) => {
      setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'evaluating' }));
      const { data, error: evalError } = await evaluateResponse(r.id);
      if (evalError) {
        setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'error' }));
        setInterviewEvalErrors((e) => ({ ...e, [r.id]: evalError }));
      } else {
        setInterviewEvaluations((m) => ({ ...m, [r.id]: data }));
        setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'done' }));
      }
    }));
  }

  async function loadDetail(applicationId) {
    const interviewRefresh = refreshInterviewSection(applicationId);
    if (fullApplications[applicationId] || detailLoading[applicationId]) {
      await interviewRefresh;
      return;
    }
    setDetailLoading((d) => ({ ...d, [applicationId]: true }));
    const [appResult, evalResult, decisionLogResult] = await Promise.all([
      getApplicationById(applicationId),
      listResumeEvaluationsForApplications([applicationId]),
      listDecisionLogForApplications([applicationId]),
    ]);
    await interviewRefresh;
    setDetailLoading((d) => ({ ...d, [applicationId]: false }));
    if (appResult.data) setFullApplications((m) => ({ ...m, [applicationId]: appResult.data }));

    const ev = evalResult.data?.[0];
    if (ev) {
      setEvaluations((m) => ({ ...m, [applicationId]: ev }));
      setEvalStatus((s) => ({ ...s, [applicationId]: 'done' }));
    }

    if (decisionLogResult.data?.[0]) setDecisionLog((m) => ({ ...m, [applicationId]: decisionLogResult.data[0] }));

    // Safety net — an application that somehow never got a resume score
    // (legacy data, a failed quick-apply copy) gets evaluated right here,
    // scoped to just this one row instead of the old page's whole-job queue.
    if (!ev) {
      setEvalStatus((s) => ({ ...s, [applicationId]: 'evaluating' }));
      const { data, error: evalError } = await evaluateApplication(applicationId);
      if (evalError) {
        setEvalStatus((s) => ({ ...s, [applicationId]: 'error' }));
        setEvalErrors((e) => ({ ...e, [applicationId]: evalError }));
      } else {
        setEvaluations((m) => ({ ...m, [applicationId]: data }));
        setEvalStatus((s) => ({ ...s, [applicationId]: 'done' }));
      }
    }
  }

  function toggleExpand(applicationId) {
    const opening = expandedId !== applicationId;
    setExpandedId(opening ? applicationId : null);
    openRequestRef.current = opening ? applicationId : null;
    if (opening) {
      // Scrolls the clicked row to the *top* of the viewport, not the
      // middle — centering the row itself was the first attempt here, but
      // the actual expanded detail panel (accordion sections, decision
      // log, etc.) renders BELOW the row and is easily 700-800px tall, so
      // centering a row near the bottom of the list still left most of
      // that content under the fold. Pinning the row to the top instead
      // gives the whole rest of the viewport to the content the applicant
      // actually clicked to see.
      //
      // The scroll waits for loadDetail to resolve, not just a couple of
      // frames — on a cold load (hard refresh, nothing cached in
      // fullApplications yet) the row initially renders with only a
      // "Loading…" placeholder while the real fetch is still in flight.
      // Scrolling on a fixed short delay measured that placeholder's much
      // shorter height, then the real content streamed in afterward and
      // pushed the row back down with no re-scroll — the exact bug where
      // it only auto-centered on the second open, once loadDetail's result
      // was already cached from the first. openRequestRef guards against a
      // fast close-then-open-elsewhere landing a stale scroll once this
      // fetch finally resolves. Double requestAnimationFrame after that,
      // not one — switching straight from one already-open applicant to
      // another collapses a potentially 700-800px detail panel and expands
      // a new one in the same tick, and a single rAF sometimes fired
      // before that reflow had actually settled.
      loadDetail(applicationId).then(() => {
        if (openRequestRef.current !== applicationId) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (openRequestRef.current !== applicationId) return;
            rowRefs.current[applicationId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
      });
    }
  }

  function toggleCompare(applicationId) {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) next.delete(applicationId);
      else if (next.size < 3) next.add(applicationId);
      return next;
    });
    loadDetail(applicationId);
  }

  function toggleSelected(applicationId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) next.delete(applicationId); else next.add(applicationId);
      return next;
    });
  }

  function toggleMultiSelectMode() {
    setMultiSelectMode((on) => !on);
    setSelectedIds(new Set());
    setCompareMode(false);
  }

  // Doesn't clear compareIds on toggle-off, unlike Select/multiSelectMode —
  // hiding the checkbox column shouldn't discard an in-progress comparison
  // the ComparisonPanel above the table is still showing.
  function toggleCompareMode() {
    setCompareMode((on) => !on);
    setMultiSelectMode(false);
  }

  async function handleRetry(applicationId) {
    setEvalStatus((s) => ({ ...s, [applicationId]: 'evaluating' }));
    const { data, error: evalError } = await evaluateApplication(applicationId);
    if (evalError) {
      setEvalStatus((s) => ({ ...s, [applicationId]: 'error' }));
      setEvalErrors((e) => ({ ...e, [applicationId]: evalError }));
    } else {
      setEvaluations((e) => ({ ...e, [applicationId]: data }));
      setEvalStatus((s) => ({ ...s, [applicationId]: 'done' }));
    }
  }

  async function handleRetryInterview(responseId) {
    setInterviewEvalStatus((s) => ({ ...s, [responseId]: 'evaluating' }));
    const { data, error: evalError } = await evaluateResponse(responseId);
    if (evalError) {
      setInterviewEvalStatus((s) => ({ ...s, [responseId]: 'error' }));
      setInterviewEvalErrors((e) => ({ ...e, [responseId]: evalError }));
    } else {
      setInterviewEvaluations((e) => ({ ...e, [responseId]: data }));
      setInterviewEvalStatus((s) => ({ ...s, [responseId]: 'done' }));
    }
  }

  async function handleResetAttempts(response) {
    if (!window.confirm(`Reset attempts for "${response.question_text_snapshot || response.interview_questions?.question_text || 'this question'}"? They'll be able to record again from their end.`)) return;
    const { data, error: resetError } = await resetInterviewAttempts(response.id);
    if (resetError) {
      window.alert(`Could not reset attempts: ${resetError.message || resetError}`);
      return;
    }
    setInterviewResponses((m) => ({
      ...m,
      [response.application_id]: (m[response.application_id] || []).map((r) => (r.id === data.id ? data : r)),
    }));
  }

  async function handleDecide(applicationId, toStatus, notifyExtra = {}) {
    setDecidingId(applicationId);
    const { error: decideError } = await updateApplicationStatus(applicationId, toStatus, profile.id);
    if (decideError) {
      window.alert(`Could not update this application: ${decideError.message}`);
      setDecidingId(null);
      return false;
    }
    // A reopen (toStatus === 'submitted') also clears the schedule columns
    // server-side now (see updateApplicationStatus) — mirrored here too, or
    // this applicant's already-loaded fullApplications entry would keep
    // showing the just-canceled appointment as still booked until something
    // else happened to re-fetch it.
    const scheduleReset = toStatus === 'submitted'
      ? { scheduled_interview_at: null, scheduled_interview_location: null, scheduled_interview_notes: null, scheduled_interview_set_by: null, scheduled_interview_set_at: null }
      : null;
    setScored((rows) => rows.map((s) => (s.applicationId === applicationId ? { ...s, status: toStatus, ...(scheduleReset ? { scheduledInterviewAt: null } : null) } : s)));
    setFullApplications((apps) => (apps[applicationId] ? { ...apps, [applicationId]: { ...apps[applicationId], status: toStatus, ...scheduleReset } } : apps));
    setDecisionLog((log) => ({
      ...log,
      [applicationId]: { status: toStatus, decided_at: new Date().toISOString(), profiles: { full_name: profile.full_name, email: profile.email } },
    }));
    setDecidingId(null);
    // "Advanced" no longer gets its own notification — it used to send a
    // vague "you've advanced, HR will reach out" email with no actual next
    // step in it, followed days later by the real, useful one once HR got
    // around to scheduling. Now Advance walks straight into scheduling (see
    // handleConfirmReview below), so the schedule notification is the only
    // one the applicant needs to see — it already carries the actual date/
    // time/location, which is the thing "advanced" alone never had.
    if (toStatus !== 'advanced') notifyApplicantStatusChange(applicationId, toStatus, notifyExtra);
    return true;
  }

  // Opens the review modal instead of deciding immediately — loadDetail is
  // the same fetch a row's own expand arrow triggers, so if HR already
  // looked at this applicant this tab session, this is instant (no
  // duplicate fetch); otherwise the modal shows a loading state until it
  // resolves.
  function handleRequestReview(applicationId, toStatus = null) {
    setReviewTarget({ applicationId, toStatus });
    loadDetail(applicationId);
  }

  async function handleConfirmReview() {
    if (!reviewTarget) return;
    setReviewConfirming(true);
    const { applicationId, toStatus } = reviewTarget;
    const ok = await handleDecide(applicationId, toStatus);
    setReviewConfirming(false);
    // Stays open on failure — handleDecide already alerted why, and the
    // applicant's still sitting right there to retry or back out of.
    if (!ok) return;
    setReviewTarget(null);
    // Advanced means scheduled — there's no separate "advanced" notification
    // anymore (see handleDecide), so go straight into picking a date/time
    // instead of leaving HR to come back and find this applicant again from
    // the "needs scheduling" list a second time.
    if (toStatus === 'advanced') handleOpenSchedule(applicationId, { freshAdvance: true });
  }

  // Switches a neutral "just reviewing" modal into confirm mode once HR
  // picks Advance/Decline from inside it — same modal, no re-fetch, since
  // `a`/evaluations are already loaded (or loading) for this applicant.
  function handlePickAction(toStatus) {
    setReviewTarget((t) => (t ? { ...t, toStatus } : t));
  }

  function handleOpenSchedule(applicationId, { freshAdvance = false } = {}) {
    setScheduleTargetId(applicationId);
    setScheduleIsFreshAdvance(freshAdvance);
    loadDetail(applicationId);
  }

  // Closing out of scheduling — whether via the X, backdrop click, or
  // (once ScheduleModal's own Cancel exists) that. If this modal opened
  // as the immediate next step after a fresh Advance and nothing actually
  // got scheduled, fall back to the plain "you've advanced" email so the
  // applicant hears SOMETHING now rather than nothing until HR happens to
  // come finish scheduling them later — see scheduleIsFreshAdvance above.
  function handleCloseSchedule() {
    if (scheduleIsFreshAdvance && !fullApplications[scheduleTargetId]?.scheduled_interview_at) {
      notifyApplicantStatusChange(scheduleTargetId, 'advanced');
    }
    setScheduleTargetId(null);
    setScheduleIsFreshAdvance(false);
  }

  async function handleScheduleInterview(applicationId, payload) {
    // Captured before the save lands — whether this applicant already had a
    // scheduled_interview_at is what tells notifyInterviewScheduled to send
    // "rescheduled" copy instead of "scheduled" (see its own comment).
    // `scored` reflects the state right up to this click, not fullApplications
    // (which this same function is about to overwrite).
    const wasAlreadyScheduled = Boolean(scored?.find((s) => s.applicationId === applicationId)?.scheduledInterviewAt);
    setSchedulingId(applicationId);
    const { data, error: scheduleError } = await scheduleInterview(applicationId, payload, profile.id);
    setSchedulingId(null);
    if (scheduleError) {
      window.alert(`Could not schedule the interview: ${scheduleError.message}`);
      return;
    }
    setFullApplications((apps) => (apps[applicationId] ? { ...apps, [applicationId]: { ...apps[applicationId], ...data } } : apps));
    // The Decisions tab's "Advanced · Not yet scheduled" cards read off the
    // lightweight `scored` list (reports.js), not fullApplications above —
    // without this, a successful schedule left that card showing stale
    // "Not yet scheduled" until a full page reload re-fetched `scored` from
    // scratch, even though the save itself had already gone through.
    setScored((rows) => (rows ? rows.map((s) => (s.applicationId === applicationId ? { ...s, scheduledInterviewAt: data.scheduled_interview_at } : s)) : rows));
    notifyInterviewScheduled(applicationId, { ...payload, isReschedule: wasAlreadyScheduled });
  }

  async function handleSendTestReminder(applicationId, kind) {
    setTestReminderStatus((s) => ({ ...s, [applicationId]: 'sending' }));
    const sendFn = kind === 'schedule' ? sendTestScheduleReminder : sendTestInterviewReminder;
    const { error } = await sendFn(applicationId);
    setTestReminderStatus((s) => ({ ...s, [applicationId]: error ? 'error' : 'sent' }));
    if (error) window.alert(`Could not send the test reminder: ${error.message}`);
    // Clears itself after a few seconds rather than sitting there
    // permanently once it's served its purpose (confirming the send).
    setTimeout(() => {
      setTestReminderStatus((s) => (s[applicationId] ? { ...s, [applicationId]: undefined } : s));
    }, 4000);
  }

  async function handleBulkDecline() {
    const targets = filtered.filter((s) => selectedIds.has(s.applicationId) && (s.status === 'submitted' || s.status === 'interview_stage'));
    if (targets.length === 0) return;
    if (!window.confirm(`Decline ${targets.length} selected applicant${targets.length === 1 ? '' : 's'}? This can't be bulk-undone.`)) return;
    setBulkDeclining(true);
    let failed = 0;
    for (const s of targets) {
      const { error: declineError } = await updateApplicationStatus(s.applicationId, 'declined', profile.id);
      if (declineError) {
        failed += 1;
        continue;
      }
      setScored((rows) => rows.map((row) => (row.applicationId === s.applicationId ? { ...row, status: 'declined' } : row)));
      setDecisionLog((log) => ({
        ...log,
        [s.applicationId]: { status: 'declined', decided_at: new Date().toISOString(), profiles: { full_name: profile.full_name, email: profile.email } },
      }));
      notifyApplicantStatusChange(s.applicationId, 'declined');
    }
    setBulkDeclining(false);
    setSelectedIds(new Set());
    if (failed > 0) window.alert(`${failed} applicant${failed === 1 ? '' : 's'} could not be updated.`);
  }

  // Only the currently filtered set gets the full per-applicant fields
  // (phone, skills, education, license, etc.) bulk-fetched, and only right
  // when Export is actually clicked — the overview table never needs them.
  async function handleExportCsv() {
    setExportingCsv(true);
    const ids = filtered.map((s) => s.applicationId);
    const { data: fullRows } = await listApplicationsByIds(ids);
    setExportingCsv(false);
    const byId = new Map((fullRows || []).map((a) => [a.id, a]));
    const headers = [
      'Full Name', 'Email', 'Phone', 'Current Location', 'Job Posting', 'Applied On', 'Decision',
      'Resume Match %', 'Interview Match %', 'Skills', 'Education Level',
      "Driver's License Type", 'Years Driving Experience', 'NBI Clearance', 'Willing Shifting Schedule', 'Medical Certificate',
    ];
    const rows = filtered.map((s) => {
      const a = byId.get(s.applicationId) || {};
      return [
        s.name,
        s.email,
        a.phone || '',
        a.current_location || '',
        s.job?.title || '',
        new Date(s.createdAt).toLocaleDateString(),
        DECISION_META[s.status]?.label || 'Awaiting Review',
        s.resumeScore ?? '',
        s.interviewScore ?? '',
        (a.skills || s.skills || []).join('; '),
        a.education_level || '',
        a.drivers_license_type || '',
        a.years_driving_experience ?? '',
        a.has_nbi_clearance == null ? '' : a.has_nbi_clearance ? 'Yes' : 'No',
        a.willing_shifting_schedule == null ? '' : a.willing_shifting_schedule ? 'Yes' : 'No',
        a.has_medical_certificate == null ? '' : a.has_medical_certificate ? 'Yes' : 'No',
      ];
    });
    const csv = buildReportCsv({
      title: 'Victory Liner Careers — Applicant Export',
      meta: [
        `Generated: ${new Date().toLocaleString()}`,
        `View: ${isDecisionsTab ? 'Decisions (Awaiting Your Decision)' : 'Applicants'}`,
        `Job Posting: ${jobFilter?.title || 'All Postings'}`,
        `Job Category: ${categoryFilter === 'all' ? 'All Categories' : categoryFilter}`,
        `Score Type: ${scoreLabel}`,
        `Score Range: ${scoreMin}% - ${scoreMax}%`,
        `Applied Date Range: ${dateFrom || 'Any'} to ${dateTo || 'Any'}`,
        `Total Applicants: ${filtered.length}`,
      ],
      headers,
      rows,
    });
    downloadCsv(`victory-liner-applicants-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const categories = useMemo(
    () => (scored ? [...new Set(scored.map((s) => s.job?.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : []),
    [scored],
  );
  const jobs = useMemo(
    () => (scored ? [...new Map(scored.filter((s) => s.job).map((s) => [s.job.id, s.job])).values()].sort((a, b) => a.title.localeCompare(b.title)) : []),
    [scored],
  );

  const filtered = useMemo(() => {
    if (!scored) return [];
    return scored
      .filter((s) => categoryFilter === 'all' || s.job?.category === categoryFilter)
      .filter((s) => !jobFilter || s.job?.id === jobFilter.id)
      .filter((s) => matchesStage(s, activeStageFilter))
      .filter((s) => {
        const score = scoreFor(s, scoreType);
        return score != null && score >= scoreMin && score <= scoreMax;
      })
      .filter((s) => {
        if (!dateFrom && !dateTo) return true;
        const appliedAt = new Date(s.createdAt).getTime();
        // End-of-day for dateTo, not midnight — otherwise "to today" would
        // exclude every application actually submitted today.
        if (dateFrom && appliedAt < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
        if (dateTo && appliedAt > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
        return true;
      })
      .sort((a, b) => {
        const diff = scoreFor(a, scoreType) - scoreFor(b, scoreType);
        return sortDir === 'asc' ? diff : -diff;
      });
  }, [scored, categoryFilter, jobFilter, activeStageFilter, scoreType, scoreMin, scoreMax, dateFrom, dateTo, sortDir]);

  // Everyone bulk-decline could actually touch, given whatever filters (job,
  // category, score range) are currently narrowing `filtered` — so setting
  // Score max to e.g. 49 first, then Select All, grabs exactly "everyone
  // currently below 50%" without hand-checking each one individually.
  const selectableIds = filtered.filter((s) => s.status === 'submitted' || s.status === 'interview_stage').map((s) => s.applicationId);

  function handleSelectAll() {
    setSelectedIds(new Set(selectableIds));
  }

  // Decisions-tab-only view — ranked groups per job posting instead of one
  // flat table, so "who's the strongest candidate for *this* opening" is
  // the thing you see, not just a mixed list sorted by score across every
  // job at once. `filtered` is already sorted by scoreFor/sortDir above,
  // and Array#sort is stable, so each group's own candidates come out of
  // this already in rank order — no separate per-group sort needed. Groups
  // themselves stay in the order their first (best-ranked) member appears
  // in that same already-sorted list.

  // Off the full `scored` set, not `filtered` — a job's "3 of 5 filled"
  // count has to stay accurate regardless of whatever score range/job/
  // category filters happen to be active, same reasoning as jobs.js's
  // listAllJobs computing this off every application, not a filtered view.
  const advancedCountByJob = useMemo(() => {
    const map = new Map();
    for (const s of scored || []) {
      if (s.status !== 'advanced') continue;
      map.set(s.jobId, (map.get(s.jobId) || 0) + 1);
    }
    return map;
  }, [scored]);

  const groupedByJob = useMemo(() => {
    if (!isDecisionsTab) return null;
    const map = new Map();
    for (const s of filtered) {
      const key = s.jobId || 'unknown';
      if (!map.has(key)) map.set(key, { job: s.job, decisionRows: [], scheduleRows: [] });
      // Two different kinds of "pending" get grouped separately within a
      // job rather than mixed into one ranked list — an advanced candidate
      // waiting on a calendar slot isn't competing for the role anymore
      // (they already won that call), so ranking them next to people still
      // being decided on would be misleading.
      const bucket = s.status === 'advanced' ? map.get(key).scheduleRows : map.get(key).decisionRows;
      bucket.push(s);
    }
    // Category order (same alphabetical convention job_categories is
    // listed in everywhere else — JobPostingForm, the public job filter),
    // not "whichever job happened to have the top-scoring candidate" —
    // that made the group order jump around unpredictably every time
    // scores changed.
    return [...map.values()]
      .filter((g) => g.decisionRows.length > 0 || g.scheduleRows.length > 0)
      .sort((a, b) => {
        const catDiff = (a.job?.category || '').localeCompare(b.job?.category || '');
        return catDiff !== 0 ? catDiff : (a.job?.title || '').localeCompare(b.job?.title || '');
      });
  }, [filtered, isDecisionsTab]);

  // Which job groups have "See All" expanded past the top-3 ranked
  // preview — per job posting id, reset implicitly whenever the filters
  // change since groupedByJob itself is recomputed (no stale expanded
  // state pointing at a group that no longer matches the filters).
  const [expandedRankGroups, setExpandedRankGroups] = useState(new Set());
  const toggleRankGroup = (jobId) => {
    setExpandedRankGroups((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const compareCandidates = [...compareIds].map((id) => {
    const s = scored?.find((row) => row.applicationId === id);
    if (!s) return null;
    return { id, name: s.name, status: s.status, resumeScore: s.resumeScore, interviewScore: s.interviewScore, skills: s.skills, application: fullApplications[id] };
  }).filter(Boolean);

  const scoreLabel = SCORE_TYPE_OPTIONS.find((o) => o.value === scoreType)?.label || 'Score';

  return (
    <HrShell active={isDecisionsTab ? 'hr-decisions' : 'hr-applicant-list'} nav={nav} profile={profile}>
      <ConfirmModal
        open={pendingReopen !== null}
        title={pendingReopen?.scheduledFor ? 'Cancel their interview and reopen?' : 'Reopen this application?'}
        message={
          pendingReopen
            ? (pendingReopen.scheduledFor
              ? `${pendingReopen.name} still has a personal interview scheduled for ${pendingReopen.scheduledFor}. Reopening will cancel that interview and send their application back to "Awaiting Review" for reconsideration from scratch.`
              : `${pendingReopen.name}'s application will go back to "Awaiting Review" for reconsideration from scratch.`)
            : ''
        }
        confirmLabel={pendingReopen?.scheduledFor ? 'Cancel Interview & Reopen' : 'Reopen'}
        cancelLabel="Cancel"
        onConfirm={() => {
          handleDecide(pendingReopen.applicationId, 'submitted', { hadSchedule: Boolean(pendingReopen.scheduledFor) });
          setPendingReopen(null);
        }}
        onCancel={() => setPendingReopen(null)}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>{isDecisionsTab ? 'Decisions' : 'Applicants'}</h1>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>
                {isDecisionsTab
                  ? 'Everyone waiting on you — an Advance/Decline call, or a personal interview to schedule — across every job.'
                  : 'Every applicant across every job posting, filterable and sortable in one place.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ActionPill
                icon={COMPARE_ICON} tone="primary" active={compareMode} onClick={toggleCompareMode}
                label={compareMode ? 'Done Comparing' : 'Compare'}
              />
              {isDecisionsTab && profile?.role === 'hr_personnel' && (
                <ActionPill
                  icon={SELECT_ICON} tone="neutral" active={multiSelectMode} onClick={toggleMultiSelectMode}
                  label={multiSelectMode ? 'Done Selecting' : 'Select'}
                />
              )}
              {filtered.length > 0 && (
                <ActionPill icon={EXPORT_ICON} tone="neutral" disabled={exportingCsv} onClick={handleExportCsv} label={exportingCsv ? 'Exporting…' : 'Export CSV'} />
              )}
            </div>
          </div>
        </Reveal>

        {(jobFilter || (activeStageFilter && activeStageFilter !== 'applications')) && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {jobFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--pink-100)', borderRadius: 10, padding: '10px 16px' }}>
                <span style={{ fontSize: 'var(--text-sm)' }}>Filtered to <strong>{jobFilter.title}</strong></span>
                <div onClick={() => setJobFilter(null)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)' }}>Clear</div>
              </div>
            )}
            {activeStageFilter && activeStageFilter !== 'applications' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--pink-100)', borderRadius: 10, padding: '10px 16px' }}>
                <span style={{ fontSize: 'var(--text-sm)' }}>Stage: <strong>{STAGE_LABELS[activeStageFilter]}</strong></span>
                {/* No Clear here on the Decisions tab — "Awaiting Your
                    Decision" is the one thing that makes this tab this tab;
                    clearing it would just turn it into another copy of
                    Applicants. Every other entry point to this stage filter
                    (the Applicants tab's own filters) keeps Clear as usual. */}
                {!isDecisionsTab && (
                  <div onClick={() => setActiveStageFilter(null)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)' }}>Clear</div>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p style={{ color: 'var(--red-700)' }}>{error}</p>}
        {!scored && !error && <p style={{ opacity: 0.7 }}>Loading applicants…</p>}

        {scored && (
          <>
            {isDecisionsTab && profile?.role === 'hr_personnel' && multiSelectMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--pink-100)', borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{selectedIds.size} selected</span>
                {selectableIds.length > 0 && (
                  <div onClick={handleSelectAll} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                    Select All ({selectableIds.length})
                  </div>
                )}
                {selectedIds.size > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleBulkDecline} disabled={bulkDeclining}>{bulkDeclining ? 'Declining…' : <>{DECLINE_ICON} Decline Selected</>}</Button>
                    <div onClick={() => setSelectedIds(new Set())} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)' }}>Clear</div>
                  </>
                )}
              </div>
            )}

            {compareCandidates.length >= 2 && (
              <ComparisonPanel candidates={compareCandidates} onRemove={toggleCompare} onClear={() => setCompareIds(new Set())} />
            )}

            <Reveal delay={0.05} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16, borderBottom: '1px solid var(--border-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, rowGap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
                  Job Posting
                  <select
                    value={jobFilter?.id || 'all'}
                    onChange={(e) => setJobFilter(e.target.value === 'all' ? null : jobs.find((j) => j.id === e.target.value) || null)}
                    style={SELECT_STYLE}
                  >
                    <option value="all">All Postings</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
                  Job Category
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={SELECT_STYLE}>
                    <option value="all">All Categories</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
                  Score Type
                  <select value={scoreType} onChange={(e) => setScoreType(e.target.value)} style={SELECT_STYLE}>
                    {SCORE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
                  Score
                  <input type="number" min={0} max={100} value={scoreMin} onChange={(e) => setScoreMin(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} style={NUM_INPUT_STYLE} />
                  to
                  <input type="number" min={0} max={100} value={scoreMax} onChange={(e) => setScoreMax(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} style={NUM_INPUT_STYLE} />
                  %
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
                  Order
                  <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} style={SELECT_STYLE}>
                    <option value="desc">Highest First</option>
                    <option value="asc">Lowest First</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
                  Applied
                  <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} style={DATE_INPUT_STYLE} />
                  to
                  <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} style={DATE_INPUT_STYLE} />
                  {(dateFrom || dateTo) && (
                    <div onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ cursor: 'pointer', color: 'var(--text-link)' }}>Clear</div>
                  )}
                </label>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', opacity: 0.55, textAlign: 'right' }}>
                {filtered.length} applicant{filtered.length === 1 ? '' : 's'}
              </div>
              </div>

              {scored.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No applicants yet.</p>
              ) : filtered.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>
                  No applicants match these filters — try widening the score range or switching score type
                  (applicants without a {scoreLabel.toLowerCase()} yet are excluded).
                </p>
              ) : isDecisionsTab ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  {groupedByJob.map(({ job: groupJob, decisionRows, scheduleRows }) => {
                    const advancedCount = advancedCountByJob.get(groupJob?.id) || 0;
                    const positionsFilled = groupJob?.open_positions > 0 && advancedCount >= groupJob.open_positions;
                    return (
                    <div key={groupJob?.id || 'unknown'}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 'var(--text-md)' }}>{groupJob?.title || 'Unknown Job'}</strong>
                        {groupJob?.open_positions ? (
                          <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{advancedCount} of {groupJob.open_positions} position{groupJob.open_positions === 1 ? '' : 's'} filled</span>
                        ) : null}
                        {positionsFilled && (
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: '#e3f6e6', color: '#0ca30c' }}>
                            Positions Filled
                          </span>
                        )}
                      </div>

                      {decisionRows.length > 0 && (() => {
                        const jobKey = groupJob?.id || 'unknown';
                        const expanded = expandedRankGroups.has(jobKey);
                        const visibleRows = expanded ? decisionRows : decisionRows.slice(0, 3);
                        const hiddenCount = decisionRows.length - visibleRows.length;
                        return (
                          <div style={{ marginBottom: scheduleRows.length > 0 ? 18 : 0 }}>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, opacity: 0.55, marginBottom: 8 }}>
                              RANKED · {decisionRows.length} awaiting your decision
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {visibleRows.map((s, i) => (
                                <DecisionCandidateCard
                                  key={s.applicationId}
                                  s={s}
                                  rank={i + 1}
                                  deciding={decidingId === s.applicationId}
                                  onRequestReview={handleRequestReview}
                                  multiSelectMode={multiSelectMode && profile?.role === 'hr_personnel'}
                                  selected={selectedIds.has(s.applicationId)}
                                  onToggleSelect={() => toggleSelected(s.applicationId)}
                                  compareMode={compareMode}
                                  compareSelected={compareIds.has(s.applicationId)}
                                  compareDisabled={compareIds.size >= 3}
                                  onToggleCompare={() => toggleCompare(s.applicationId)}
                                  positionsFilled={positionsFilled}
                                />
                              ))}
                            </div>
                            {decisionRows.length > 3 && (
                              <button
                                onClick={() => toggleRankGroup(jobKey)}
                                className="btn-animate"
                                style={{
                                  marginTop: 10, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                  fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--action-primary-bg)', padding: '4px 2px',
                                }}
                              >
                                {expanded ? 'Show Top 3 Only' : `See All ${decisionRows.length} (${hiddenCount} more)`}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {scheduleRows.length > 0 && (
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, opacity: 0.55, marginBottom: 8 }}>
                            {scheduleRows.length} need{scheduleRows.length === 1 ? 's' : ''} a personal interview scheduled
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {scheduleRows.map((s) => (
                              <ScheduleCandidateCard key={s.applicationId} s={s} onOpenSchedule={handleOpenSchedule} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                    <thead>
                      <tr>
                        {((multiSelectMode && profile?.role === 'hr_personnel') || compareMode) && <th style={{ width: 24, padding: '0 12px 10px' }} />}
                        <th style={{ width: 14, padding: '0 0 10px' }} />
                        {['Applicant', 'Job', 'Overall', 'Resume', 'Interview', 'Status', 'Applied'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', fontSize: 'var(--text-xs)', opacity: 0.6, fontWeight: 600, padding: '0 12px 10px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const status = DECISION_META[s.status] || DECISION_META.submitted;
                        const isExpanded = expandedId === s.applicationId;
                        const a = fullApplications[s.applicationId];
                        const decision = decisionLog[s.applicationId];
                        return (
                          <Fragment key={s.applicationId}>
                            <tr
                              ref={(el) => { rowRefs.current[s.applicationId] = el; }}
                              onClick={() => toggleExpand(s.applicationId)}
                              className="hover-lift"
                              style={{ cursor: 'pointer', borderTop: '1px solid var(--border-hairline)', background: isExpanded ? 'var(--surface-page-alt)' : undefined }}
                            >
                              {multiSelectMode && profile?.role === 'hr_personnel' && (
                                <td style={{ padding: '12px 12px 12px' }} onClick={(e) => e.stopPropagation()}>
                                  {(s.status === 'submitted' || s.status === 'interview_stage') && (
                                    <input type="checkbox" checked={selectedIds.has(s.applicationId)} onChange={() => toggleSelected(s.applicationId)} aria-label={`Select ${s.name}`} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                  )}
                                </td>
                              )}
                              {compareMode && (
                                <td style={{ padding: '12px 12px 12px' }} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={compareIds.has(s.applicationId)}
                                    disabled={!compareIds.has(s.applicationId) && compareIds.size >= 3}
                                    onChange={() => toggleCompare(s.applicationId)}
                                    aria-label={`Compare ${s.name}`}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                  />
                                </td>
                              )}
                              <td style={{ padding: '12px 0', fontSize: 10, opacity: 0.5 }}>
                                <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>▶</span>
                              </td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)' }}>
                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{s.email}</div>
                              </td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)' }}>
                                <div>{s.job?.title || '—'}</div>
                                {s.job?.category && <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{s.job.category}</div>}
                              </td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'total' ? 700 : 400, color: scoreColor(s.totalScore) }}>{s.totalScore != null ? `${s.totalScore}%` : '—'}</td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'resume' ? 700 : 400, color: evalStatus[s.applicationId] === 'error' ? 'var(--red-700)' : scoreColor(s.resumeScore) }}>
                                {evalStatus[s.applicationId] === 'error' ? (
                                  <span title={evalErrors[s.applicationId] || 'AI evaluation failed — expand this row to retry.'}>⚠ Failed</span>
                                ) : (
                                  s.resumeScore != null ? `${s.resumeScore}%` : '—'
                                )}
                              </td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'interview' ? 700 : 400, color: scoreColor(s.interviewScore) }}>{s.interviewScore != null ? `${s.interviewScore}%` : '—'}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>{status.label}</span>
                              </td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-xs)', opacity: 0.65, whiteSpace: 'nowrap' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${s.applicationId}-detail`}>
                                <td colSpan={8 + (((multiSelectMode && profile?.role === 'hr_personnel') || compareMode) ? 1 : 0)} style={{ padding: 0, borderTop: 'none' }}>
                                  <div style={{ padding: '4px 16px 28px 16px', background: 'var(--surface-page-alt)' }}>
                                    {!a ? (
                                      <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6, padding: '16px 0' }}>Loading applicant details…</p>
                                    ) : (
                                      <div style={{ display: 'flex', gap: 24, padding: '16px 12px 0' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                          <ScoreBadge score={s.totalScore} status={s.totalScore == null ? 'not-started' : 'done'} label="Overall Score" emphasis />
                                          <div style={{ display: 'flex', gap: 12 }}>
                                            <ScoreBadge score={evaluations[s.applicationId]?.score} status={evalStatus[s.applicationId]} label="Resume Match" />
                                            <ScoreBadge score={s.interviewScore} status={s.interviewCompleted ? 'done' : (interviewResponses[s.applicationId]?.length ? 'evaluating' : 'not-started')} label="Interview Match" />
                                          </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          {decision && (
                                            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.55, marginTop: 4 }}>
                                              Decided by {decision.profiles?.full_name || decision.profiles?.email || 'HR'} on {new Date(decision.decided_at).toLocaleDateString()}
                                            </div>
                                          )}

                                          <DrivingInfo application={a} />

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                                            {a.skills?.length > 0 && (
                                              <AccordionSection
                                                icon={SKILLS_ICON} open={isSectionOpen(s.applicationId, 'skills')} label="Skills" count={a.skills.length}
                                                onClick={() => toggleSection(s.applicationId, 'skills')}
                                                preview={<SkillBadges skills={a.skills} />}
                                              >
                                                <SkillTextList skills={a.skills} />
                                              </AccordionSection>
                                            )}
                                            {a.work_experience?.length > 0 && (
                                              <AccordionSection icon={EXPERIENCE_ICON} open={isSectionOpen(s.applicationId, 'experience')} label="Experience" count={a.work_experience.length} onClick={() => toggleSection(s.applicationId, 'experience')}>
                                                <ExperienceList items={a.work_experience} />
                                              </AccordionSection>
                                            )}
                                            {(a.education?.length > 0 || a.certifications?.length > 0) && (
                                              <AccordionSection icon={EDUCATION_ICON} open={isSectionOpen(s.applicationId, 'education')} label="Education & Certifications" onClick={() => toggleSection(s.applicationId, 'education')}>
                                                <EducationList items={a.education} level={a.education_level} />
                                                <CertificationList items={a.certifications} />
                                              </AccordionSection>
                                            )}
                                            {a.cover_note && (
                                              <AccordionSection icon={NOTE_ICON} open={isSectionOpen(s.applicationId, 'cover')} label="Cover Note" onClick={() => toggleSection(s.applicationId, 'cover')}>
                                                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, margin: 0 }}>{a.cover_note}</p>
                                              </AccordionSection>
                                            )}
                                            <AccordionSection icon={AI_ICON} open={isSectionOpen(s.applicationId, 'ai')} label="AI Assessment" onClick={() => toggleSection(s.applicationId, 'ai')}>
                                              <AiAssessment evaluation={evaluations[s.applicationId]} status={evalStatus[s.applicationId]} errorMessage={evalErrors[s.applicationId]} onRetry={() => handleRetry(s.applicationId)} />
                                            </AccordionSection>
                                            <AccordionSection icon={VIDEO_ICON} open={isSectionOpen(s.applicationId, 'interview')} label="Video Interview" onClick={() => toggleSection(s.applicationId, 'interview')}>
                                              <InterviewSection
                                                responses={interviewResponses[s.applicationId] || []}
                                                evaluations={interviewEvaluations}
                                                evalStatus={interviewEvalStatus}
                                                evalErrors={interviewEvalErrors}
                                                onRetry={handleRetryInterview}
                                                onResetAttempts={handleResetAttempts}
                                                expectedCount={interviewQuestionCount}
                                              />
                                              {a.status === 'interview_stage' && !s.interviewCompleted && (
                                                <div style={{ marginTop: 14, borderTop: '1px solid var(--border-hairline)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                                                  <Button
                                                    variant="outline" size="sm"
                                                    onClick={() => handleSendTestReminder(s.applicationId, 'interview')}
                                                    disabled={testReminderStatus[s.applicationId] === 'sending'}
                                                  >
                                                    {testReminderStatus[s.applicationId] === 'sending' ? 'Sending…' : 'Send Test "1 Day Left" Reminder'}
                                                  </Button>
                                                  {testReminderStatus[s.applicationId] === 'sent' && (
                                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--action-primary-bg)', fontWeight: 700 }}>Sent to {a.email}</span>
                                                  )}
                                                  {testReminderStatus[s.applicationId] === 'error' && (
                                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)', fontWeight: 700 }}>Failed to send</span>
                                                  )}
                                                </div>
                                              )}
                                            </AccordionSection>
                                          </div>
                                          {/* Decide actions stay outside every section toggle. Advance/Decline
                                              only live on the Decisions tab — Applicants is pure browse/
                                              reference now, so an undecided applicant just points there
                                              instead of offering the same buttons a second place. */}
                                          {(a.status === 'submitted' || a.status === 'interview_stage') && profile?.role === 'hr_personnel' && !isDecisionsTab && (
                                            <p style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16, fontSize: 'var(--text-xs)', opacity: 0.6 }}>
                                              Advance/Decline this applicant from the <strong>Decisions</strong> tab.
                                            </p>
                                          )}
                                          {a.status === 'submitted' && profile?.role === 'hr_personnel' && isDecisionsTab && (
                                            <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                                              <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, margin: '0 0 10px' }}>
                                                Advancing unlocks the video interview for this applicant.
                                              </p>
                                              <div style={{ display: 'flex', gap: 10 }}>
                                                <Button variant="strong" size="sm" onClick={() => handleDecide(s.applicationId, 'interview_stage')} disabled={decidingId === s.applicationId}>{ADVANCE_ICON} Advance to Interview</Button>
                                                <Button variant="outline" size="sm" onClick={() => handleDecide(s.applicationId, 'declined')} disabled={decidingId === s.applicationId}>{DECLINE_ICON} Decline</Button>
                                              </div>
                                            </div>
                                          )}
                                          {a.status === 'interview_stage' && profile?.role === 'hr_personnel' && isDecisionsTab && (
                                            <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                                              <div style={{ display: 'flex', gap: 10 }}>
                                                <Button variant="strong" size="sm" onClick={() => handleDecide(s.applicationId, 'advanced')} disabled={decidingId === s.applicationId}>{ADVANCE_ICON} Advance</Button>
                                                <Button variant="outline" size="sm" onClick={() => handleDecide(s.applicationId, 'declined')} disabled={decidingId === s.applicationId}>{DECLINE_ICON} Decline</Button>
                                              </div>
                                            </div>
                                          )}
                                          {a.status === 'advanced' && profile?.role === 'hr_personnel' && (
                                            <SchedulePanel
                                              application={a}
                                              onSave={(payload) => handleScheduleInterview(s.applicationId, payload)}
                                              saving={schedulingId === s.applicationId}
                                            />
                                          )}
                                          {(a.status === 'advanced' || a.status === 'declined') && profile?.role === 'hr_personnel' && (
                                            <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                                              <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, margin: '0 0 10px' }}>
                                                {a.scheduled_interview_at
                                                  ? 'Made this call by mistake? Reopening cancels their scheduled interview and resets them to “Awaiting Review” for reconsideration from scratch.'
                                                  : 'Made this call by mistake? Reopening resets them to “Awaiting Review” for reconsideration from scratch.'}
                                              </p>
                                              <Button
                                                variant="outline" size="sm"
                                                onClick={() => setPendingReopen({
                                                  applicationId: s.applicationId,
                                                  name: a.full_name,
                                                  scheduledFor: a.scheduled_interview_at
                                                    ? new Date(a.scheduled_interview_at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                                    : null,
                                                })}
                                                disabled={decidingId === s.applicationId}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                                              >
                                                {REOPEN_ICON} Reopen
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Reveal>
          </>
        )}
      </div>
      {reviewTarget && (() => {
        const reviewRow = scored?.find((row) => row.applicationId === reviewTarget.applicationId);
        if (!reviewRow) return null;
        const reviewJobOpenPositions = reviewRow.job?.open_positions;
        const reviewJobAdvancedCount = advancedCountByJob.get(reviewRow.jobId) || 0;
        const positionsFilled = reviewJobOpenPositions > 0 && reviewJobAdvancedCount >= reviewJobOpenPositions;
        return (
          <DecisionReviewModal
            s={reviewRow}
            a={fullApplications[reviewTarget.applicationId]}
            toStatus={reviewTarget.toStatus}
            positionsFilled={positionsFilled}
            openPositions={reviewJobOpenPositions}
            confirming={reviewConfirming}
            onConfirm={handleConfirmReview}
            onCancel={() => setReviewTarget(null)}
            onPickAction={handlePickAction}
            evaluation={evaluations[reviewTarget.applicationId]}
            evalStat={evalStatus[reviewTarget.applicationId]}
            evalErrorMsg={evalErrors[reviewTarget.applicationId]}
            onRetryResume={() => handleRetry(reviewTarget.applicationId)}
            interviewResponses={interviewResponses[reviewTarget.applicationId] || []}
            interviewEvaluations={interviewEvaluations}
            interviewEvalStatus={interviewEvalStatus}
            interviewEvalErrors={interviewEvalErrors}
            onRetryInterview={handleRetryInterview}
            onResetAttempts={handleResetAttempts}
            expectedCount={interviewQuestionCount}
          />
        );
      })()}
      {scheduleTargetId && (() => {
        const scheduleRow = scored?.find((row) => row.applicationId === scheduleTargetId);
        if (!scheduleRow) return null;
        return (
          <ScheduleModal
            s={scheduleRow}
            a={fullApplications[scheduleTargetId]}
            saving={schedulingId === scheduleTargetId}
            onSave={(payload) => handleScheduleInterview(scheduleTargetId, payload)}
            onClose={handleCloseSchedule}
          />
        );
      })()}
    </HrShell>
  );
}
export default HrApplicantsList;
