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
import { Fragment, useEffect, useMemo, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { ActionPill } from '../components/core/ActionPill/ActionPill.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { getScoredApplicants } from '../lib/reports.js';
import {
  getApplicationById,
  listApplicationsByIds,
  updateApplicationStatus,
  listDecisionLogForApplications,
  notifyApplicantStatusChange,
  scheduleInterview,
  notifyInterviewScheduled,
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
import { buildCsv, downloadCsv } from '../lib/csvExport.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';
import { MAX_ATTEMPTS } from '../lib/interviewConstants.js';

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
  fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', padding: '7px 10px', borderRadius: 8,
  background: 'var(--surface-field)', border: 'none', color: 'var(--text-primary)',
};

const NUM_INPUT_STYLE = {
  width: 56, padding: '7px 8px', textAlign: 'center', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)',
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72,
      ...(emphasis ? { background: 'var(--pink-100)', borderRadius: 12, padding: '10px 8px' } : null),
    }}>
      <span style={{ fontSize: emphasis ? 'var(--text-3xl)' : 'var(--text-2xl)', fontWeight: 800, color: emphasis ? 'var(--action-primary-bg)' : 'var(--text-primary)' }}>{score}%</span>
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
        <div onClick={onRetry} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginTop: 8, display: 'inline-block' }}>
          Re-evaluate
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)' }}>AI evaluation failed{errorMessage ? `: ${errorMessage}` : '.'}</p>
        <div onClick={onRetry} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}>
          Retry
        </div>
      </div>
    );
  }
  return <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 12 }}>AI is evaluating this applicant…</p>;
}

async function handleWatch(videoPath) {
  const { data: url } = await getSignedVideoUrl(videoPath);
  if (url) window.open(url, '_blank', 'noopener');
}

function InterviewResponseRow({ response, evaluation, status, errorMessage, onRetry, onResetAttempts }) {
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gray-100)' }}>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{response.interview_questions?.question_text}</div>
      {!response.video_path ? (
        response.attempt_count >= MAX_ATTEMPTS ? (
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)' }}>
              Used all {MAX_ATTEMPTS} attempts without ever submitting a take — they're locked out of this question on their end.
            </p>
            <div onClick={() => onResetAttempts(response)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', display: 'inline-block' }}>
              Reset Attempts (let them try again)
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>Not answered yet.</p>
        )
      ) : (
        <>
          <div onClick={() => handleWatch(response.video_path)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}>
            ▶ Watch Answer
          </div>
          {evaluation ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 'var(--text-xs)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span><strong>{evaluation.evaluation_score}%</strong> overall</span>
                <span>Sentiment: {evaluation.sentiment_label} ({evaluation.sentiment_score})</span>
                <span>Relevance: {evaluation.relevance_score}</span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', marginTop: 6, lineHeight: 1.5 }}>{evaluation.explanation}</p>
              {evaluation.transcript && (
                <p style={{ fontSize: 'var(--text-xs)', marginTop: 4, fontStyle: 'italic', opacity: 0.7 }}>&ldquo;{evaluation.transcript}&rdquo;</p>
              )}
              <div onClick={() => onRetry(response.id)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginTop: 6, display: 'inline-block' }}>
                Re-evaluate
              </div>
            </div>
          ) : status === 'error' ? (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)' }}>AI evaluation failed{errorMessage ? `: ${errorMessage}` : '.'}</p>
              <div onClick={() => onRetry(response.id)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline' }}>Retry</div>
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 6 }}>AI is evaluating this answer…</p>
          )}
        </>
      )}
    </div>
  );
}

function InterviewSection({ responses, evaluations, evalStatus, evalErrors, onRetry, onResetAttempts, expectedCount }) {
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
        <InterviewResponseRow key={r.id} response={r} evaluation={evaluations[r.id]} status={evalStatus[r.id]} errorMessage={evalErrors[r.id]} onRetry={onRetry} onResetAttempts={onResetAttempts} />
      ))}
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

function SectionToggle({ open, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', border: 'none',
        background: open ? 'var(--pink-100)' : 'var(--surface-page-alt)', color: open ? 'var(--red-700)' : 'var(--text-primary)',
        borderRadius: 999, padding: '5px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 9, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', display: 'inline-block' }}>▶</span>
      {label}{count != null && ` (${count})`}
    </button>
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
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)',
  background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)', border: 'none', borderRadius: 6, color: 'var(--text-primary)',
};

// Only ever shown for an already-advanced applicant — scheduling is
// additional detail layered on top of "Advanced," not a new pipeline stage,
// so it doesn't touch the status column at all (see scheduleInterview in
// applications.js). It's always framed as a personal (in-person) interview.
function SchedulePanel({ application: a, onSave, saving }) {
  const [editing, setEditing] = useState(!a.scheduled_interview_at);
  const [dateTime, setDateTime] = useState(a.scheduled_interview_at ? toLocalInputValue(a.scheduled_interview_at) : '');
  const [location, setLocation] = useState(a.scheduled_interview_location || '');
  const [notes, setNotes] = useState(a.scheduled_interview_notes || '');

  // A successful save changes `a.scheduled_interview_at` (the parent re-fetches
  // and passes the updated application back down) — that's the signal to drop
  // out of the form into the read-only confirmation view, since onSave itself
  // is fire-and-forget from this component's side, not an awaited promise.
  useEffect(() => {
    if (a.scheduled_interview_at) setEditing(false);
    // Only the timestamp actually changing (a real save landing) should flip
    // this — not every re-render, or a deliberate "Reschedule" click would
    // get immediately overridden back to the read-only view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.scheduled_interview_at]);

  if (!editing && a.scheduled_interview_at) {
    const when = new Date(a.scheduled_interview_at).toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    return (
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
        <strong style={{ fontSize: 'var(--text-sm)' }}>Personal Interview Scheduled</strong>
        <div style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>{when}</div>
        {a.scheduled_interview_location && <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 2 }}>{a.scheduled_interview_location}</div>}
        {a.scheduled_interview_notes && <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4 }}>{a.scheduled_interview_notes}</div>}
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} style={{ marginTop: 10 }}>Reschedule</Button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Schedule Personal Interview</strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, maxWidth: 360 }}>
        <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} style={SCHEDULE_FIELD_STYLE} />
        <input type="text" placeholder="Location (e.g. Cubao Terminal, HR Office)" value={location} onChange={(e) => setLocation(e.target.value)} style={SCHEDULE_FIELD_STYLE} />
        <textarea placeholder="Notes for the applicant (optional) — what to bring, who to ask for, etc." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...SCHEDULE_FIELD_STYLE, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="strong" size="sm"
            onClick={() => dateTime && onSave({ scheduledAt: new Date(dateTime).toISOString(), location, notes })}
            disabled={!dateTime || saving}
          >
            {saving ? 'Saving…' : a.scheduled_interview_at ? 'Save Changes' : 'Schedule Interview'}
          </Button>
          {a.scheduled_interview_at && <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>}
        </div>
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
              <Button variant={isDecline ? 'ghost' : 'strong'} size="md" onClick={onConfirm} disabled={confirming || !a}>
                {confirming ? 'Saving…' : `Confirm ${actionLabel}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="md" onClick={onCancel}>Close</Button>
              {(s.status === 'submitted' || s.status === 'interview_stage') && (
                <>
                  <Button variant="ghost" size="md" onClick={() => onPickAction('declined')} disabled={!a}>Decline</Button>
                  <Button variant="strong" size="md" onClick={() => onPickAction(advanceTo)} disabled={!a}>{advanceLabel}</Button>
                </>
              )}
            </>
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
function DecisionCandidateCard({ s, rank, deciding, onRequestReview, multiSelectMode, selected, onToggleSelect, compareMode, compareSelected, compareDisabled, onToggleCompare }) {
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
        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{s.name}</div>
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
              {s.status === 'submitted' ? 'Advance to Interview' : 'Advance'}
            </Button>
            <Button variant="ghost" size="sm" disabled={deciding} onClick={() => onRequestReview(s.applicationId, 'declined')}>Decline</Button>
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
  // applicationId while the row-level "Schedule Interview" quick action's
  // modal is open — same reasoning as reviewTarget above: a personal
  // interview needs scheduling the moment someone's advanced, and that
  // used to only be reachable by expanding the row and scrolling to it.
  const [scheduleTargetId, setScheduleTargetId] = useState(null);
  const [expandedSections, setExpandedSections] = useState(() => new Set());
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
  const isSectionOpen = (id, section) => expandedSections.has(sectionKey(id, section));
  const toggleSection = (id, section) => setExpandedSections((prev) => {
    const key = sectionKey(id, section);
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
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
    // above as stale — interviewEvalMap only has the fresh ones.
    const missingInterviewEvals = responses.filter((r) => r.video_path && !interviewEvalMap[r.id]);
    for (const r of missingInterviewEvals) {
      setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'evaluating' }));
      const { data, error: evalError } = await evaluateResponse(r.id);
      if (evalError) {
        setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'error' }));
        setInterviewEvalErrors((e) => ({ ...e, [r.id]: evalError }));
      } else {
        setInterviewEvaluations((m) => ({ ...m, [r.id]: data }));
        setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'done' }));
      }
    }
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
    if (opening) loadDetail(applicationId);
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
    if (!window.confirm(`Reset attempts for "${response.interview_questions?.question_text || 'this question'}"? They'll be able to record again from their end.`)) return;
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

  async function handleDecide(applicationId, toStatus) {
    setDecidingId(applicationId);
    const { error: decideError } = await updateApplicationStatus(applicationId, toStatus, profile.id);
    if (decideError) {
      window.alert(`Could not update this application: ${decideError.message}`);
      setDecidingId(null);
      return false;
    }
    setScored((rows) => rows.map((s) => (s.applicationId === applicationId ? { ...s, status: toStatus } : s)));
    setFullApplications((apps) => (apps[applicationId] ? { ...apps, [applicationId]: { ...apps[applicationId], status: toStatus } } : apps));
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
    if (toStatus !== 'advanced') notifyApplicantStatusChange(applicationId, toStatus);
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
    if (toStatus === 'advanced') handleOpenSchedule(applicationId);
  }

  // Switches a neutral "just reviewing" modal into confirm mode once HR
  // picks Advance/Decline from inside it — same modal, no re-fetch, since
  // `a`/evaluations are already loaded (or loading) for this applicant.
  function handlePickAction(toStatus) {
    setReviewTarget((t) => (t ? { ...t, toStatus } : t));
  }

  function handleOpenSchedule(applicationId) {
    setScheduleTargetId(applicationId);
    loadDetail(applicationId);
  }

  async function handleScheduleInterview(applicationId, payload) {
    setSchedulingId(applicationId);
    const { data, error: scheduleError } = await scheduleInterview(applicationId, payload, profile.id);
    setSchedulingId(null);
    if (scheduleError) {
      window.alert(`Could not schedule the interview: ${scheduleError.message}`);
      return;
    }
    setFullApplications((apps) => (apps[applicationId] ? { ...apps, [applicationId]: { ...apps[applicationId], ...data } } : apps));
    notifyInterviewScheduled(applicationId, payload);
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
    downloadCsv(`applicants-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(headers, rows));
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
      .sort((a, b) => {
        const diff = scoreFor(a, scoreType) - scoreFor(b, scoreType);
        return sortDir === 'asc' ? diff : -diff;
      });
  }, [scored, categoryFilter, jobFilter, activeStageFilter, scoreType, scoreMin, scoreMax, sortDir]);

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
            {isDecisionsTab && profile?.role === 'hr_personnel' && selectedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--pink-100)', borderRadius: 10, padding: '10px 16px' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{selectedIds.size} selected</span>
                <Button variant="ghost" size="sm" onClick={handleBulkDecline} disabled={bulkDeclining}>{bulkDeclining ? 'Declining…' : 'Decline Selected'}</Button>
                <div onClick={() => setSelectedIds(new Set())} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)' }}>Clear</div>
              </div>
            )}

            {compareCandidates.length >= 2 && (
              <ComparisonPanel candidates={compareCandidates} onRemove={toggleCompare} onClear={() => setCompareIds(new Set())} />
            )}

            <Reveal delay={0.05} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingBottom: 16, borderBottom: '1px solid var(--border-hairline)' }}>
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
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.55, marginLeft: 'auto' }}>
                  {filtered.length} applicant{filtered.length === 1 ? '' : 's'}
                </span>
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
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'total' ? 700 : 400, color: scoreType === 'total' ? 'var(--action-primary-bg)' : undefined }}>{s.totalScore != null ? `${s.totalScore}%` : '—'}</td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'resume' ? 700 : 400 }}>{s.resumeScore != null ? `${s.resumeScore}%` : '—'}</td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'interview' ? 700 : 400 }}>{s.interviewScore != null ? `${s.interviewScore}%` : '—'}</td>
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

                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                                            {a.skills?.length > 0 && <SectionToggle open={isSectionOpen(s.applicationId, 'skills')} label="Skills" count={a.skills.length} onClick={() => toggleSection(s.applicationId, 'skills')} />}
                                            {a.work_experience?.length > 0 && <SectionToggle open={isSectionOpen(s.applicationId, 'experience')} label="Experience" count={a.work_experience.length} onClick={() => toggleSection(s.applicationId, 'experience')} />}
                                            {(a.education?.length > 0 || a.certifications?.length > 0) && <SectionToggle open={isSectionOpen(s.applicationId, 'education')} label="Education & Certifications" onClick={() => toggleSection(s.applicationId, 'education')} />}
                                            {a.cover_note && <SectionToggle open={isSectionOpen(s.applicationId, 'cover')} label="Cover Note" onClick={() => toggleSection(s.applicationId, 'cover')} />}
                                            <SectionToggle open={isSectionOpen(s.applicationId, 'ai')} label="AI Assessment" onClick={() => toggleSection(s.applicationId, 'ai')} />
                                            <SectionToggle open={isSectionOpen(s.applicationId, 'interview')} label="Video Interview" onClick={() => toggleSection(s.applicationId, 'interview')} />
                                          </div>

                                          {isSectionOpen(s.applicationId, 'skills') && a.skills?.length > 0 && <div style={{ fontSize: 'var(--text-sm)', marginTop: 12 }}>{a.skills.join(', ')}</div>}
                                          {isSectionOpen(s.applicationId, 'experience') && <ExperienceList items={a.work_experience} />}
                                          {isSectionOpen(s.applicationId, 'education') && (
                                            <>
                                              <EducationList items={a.education} level={a.education_level} />
                                              <CertificationList items={a.certifications} />
                                            </>
                                          )}
                                          {isSectionOpen(s.applicationId, 'cover') && a.cover_note && (
                                            <div style={{ marginTop: 12 }}><p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, margin: 0 }}>{a.cover_note}</p></div>
                                          )}
                                          {isSectionOpen(s.applicationId, 'ai') && (
                                            <AiAssessment evaluation={evaluations[s.applicationId]} status={evalStatus[s.applicationId]} errorMessage={evalErrors[s.applicationId]} onRetry={() => handleRetry(s.applicationId)} />
                                          )}
                                          {isSectionOpen(s.applicationId, 'interview') && (
                                            <InterviewSection
                                              responses={interviewResponses[s.applicationId] || []}
                                              evaluations={interviewEvaluations}
                                              evalStatus={interviewEvalStatus}
                                              evalErrors={interviewEvalErrors}
                                              onRetry={handleRetryInterview}
                                              onResetAttempts={handleResetAttempts}
                                              expectedCount={interviewQuestionCount}
                                            />
                                          )}
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
                                                <Button variant="strong" size="sm" onClick={() => handleDecide(s.applicationId, 'interview_stage')} disabled={decidingId === s.applicationId}>Advance to Interview</Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDecide(s.applicationId, 'declined')} disabled={decidingId === s.applicationId}>Decline</Button>
                                              </div>
                                            </div>
                                          )}
                                          {a.status === 'interview_stage' && profile?.role === 'hr_personnel' && isDecisionsTab && (
                                            <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                                              <div style={{ display: 'flex', gap: 10 }}>
                                                <Button variant="strong" size="sm" onClick={() => handleDecide(s.applicationId, 'advanced')} disabled={decidingId === s.applicationId}>Advance</Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDecide(s.applicationId, 'declined')} disabled={decidingId === s.applicationId}>Decline</Button>
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
                                                Made this call by mistake? Reopening resets them to &ldquo;Awaiting Review&rdquo; for reconsideration from scratch.
                                              </p>
                                              <Button
                                                variant="ghost" size="sm"
                                                onClick={() => window.confirm(`Reopen ${a.full_name}'s application? It will go back to "Awaiting Review".`) && handleDecide(s.applicationId, 'submitted')}
                                                disabled={decidingId === s.applicationId}
                                              >
                                                Reopen
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
            onClose={() => setScheduleTargetId(null)}
          />
        );
      })()}
    </HrShell>
  );
}
export default HrApplicantsList;
