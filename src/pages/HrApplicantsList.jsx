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
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { getScoredApplicants } from '../lib/reports.js';
import {
  getApplicationById,
  listApplicationsByIds,
  updateApplicationStatus,
  listDecisionLogForApplications,
  resetApplicantPassword,
  notifyApplicantStatusChange,
} from '../lib/applications.js';
import { computeYearsOfExperience } from '../lib/experience.js';
import { listResumeEvaluationsForApplications, evaluateApplication } from '../lib/resumeEvaluation.js';
import {
  listResponsesForApplications,
  listEvaluationsForApplications,
  evaluateResponse,
  getSignedVideoUrl,
} from '../lib/interviewEvaluation.js';
import { buildCsv, downloadCsv } from '../lib/csvExport.js';

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
  return true;
}

function ScoreBadge({ score, status, label }) {
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
      <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{score}%</span>
      <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6, textAlign: 'center' }}>{label}</span>
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

function InterviewResponseRow({ response, evaluation, status, errorMessage, onRetry }) {
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gray-100)' }}>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{response.interview_questions?.question_text}</div>
      {!response.video_path ? (
        <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>Not answered yet.</p>
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

function InterviewSection({ responses, evaluations, evalStatus, evalErrors, onRetry }) {
  if (!responses.length) {
    return <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 12 }}>No video interview started yet.</p>;
  }
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Video Interview</strong>
      {responses.map((r) => (
        <InterviewResponseRow key={r.id} response={r} evaluation={evaluations[r.id]} status={evalStatus[r.id]} errorMessage={evalErrors[r.id]} onRetry={onRetry} />
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

export function HrApplicantsList({ nav, profile, job, stageFilter }) {
  const [scored, setScored] = useState(null);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState(job || null);
  const [scoreType, setScoreType] = useState('total');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [sortDir, setSortDir] = useState('desc');
  const [activeStageFilter, setActiveStageFilter] = useState(stageFilter || null);

  useEffect(() => { setJobFilter(job || null); }, [job]);
  useEffect(() => { setActiveStageFilter(stageFilter || null); }, [stageFilter, job]);

  const load = () => {
    getScoredApplicants().then(({ data, error: err }) => {
      if (err) setError(err.message || 'Failed to load applicants.');
      else setScored(data.scored);
    });
  };
  useEffect(load, []);

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
  const [resettingId, setResettingId] = useState(null);
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  // Off by default — the select-all-the-time checkbox column was in the way
  // for the common case of just looking someone up. HR turns it on
  // deliberately via the "Select" toggle when they actually want to
  // bulk-decline a batch, and it turns itself back off (clearing whatever
  // was selected) once they're done, rather than lingering.
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeclining, setBulkDeclining] = useState(false);
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

  async function loadDetail(applicationId) {
    if (fullApplications[applicationId] || detailLoading[applicationId]) return;
    setDetailLoading((d) => ({ ...d, [applicationId]: true }));
    const [appResult, evalResult, responsesResult, interviewEvalResult, decisionLogResult] = await Promise.all([
      getApplicationById(applicationId),
      listResumeEvaluationsForApplications([applicationId]),
      listResponsesForApplications([applicationId]),
      listEvaluationsForApplications([applicationId]),
      listDecisionLogForApplications([applicationId]),
    ]);
    setDetailLoading((d) => ({ ...d, [applicationId]: false }));
    if (appResult.data) setFullApplications((m) => ({ ...m, [applicationId]: appResult.data }));

    const ev = evalResult.data?.[0];
    if (ev) {
      setEvaluations((m) => ({ ...m, [applicationId]: ev }));
      setEvalStatus((s) => ({ ...s, [applicationId]: 'done' }));
    }

    const responses = responsesResult.data || [];
    setInterviewResponses((m) => ({ ...m, [applicationId]: responses }));
    const interviewEvalMap = {};
    for (const e of interviewEvalResult.data || []) interviewEvalMap[e.response_id] = e;
    setInterviewEvaluations((m) => ({ ...m, ...interviewEvalMap }));

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

    // Same safety net for any answered-but-unevaluated interview response.
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

  async function handleResetPassword(applicantId, applicantName) {
    if (!window.confirm(`Generate a new temporary password for ${applicantName}? Their old password will stop working immediately.`)) return;
    setResettingId(applicantId);
    const { data, error: resetError } = await resetApplicantPassword(applicantId);
    setResettingId(null);
    if (resetError) {
      window.alert(`Could not reset password: ${resetError.message}`);
      return;
    }
    window.alert(
      `Temporary password for ${applicantName}:\n\n${data.password}\n\nShare this with them directly (phone, in person, etc.) — it won't be shown again. They can sign in with it right away.`,
    );
  }

  async function handleDecide(applicationId, toStatus) {
    setDecidingId(applicationId);
    const { error: decideError } = await updateApplicationStatus(applicationId, toStatus, profile.id);
    if (decideError) {
      window.alert(`Could not update this application: ${decideError.message}`);
      setDecidingId(null);
      return;
    }
    setScored((rows) => rows.map((s) => (s.applicationId === applicationId ? { ...s, status: toStatus } : s)));
    setFullApplications((apps) => (apps[applicationId] ? { ...apps, [applicationId]: { ...apps[applicationId], status: toStatus } } : apps));
    setDecisionLog((log) => ({
      ...log,
      [applicationId]: { status: toStatus, decided_at: new Date().toISOString(), profiles: { full_name: profile.full_name, email: profile.email } },
    }));
    setDecidingId(null);
    notifyApplicantStatusChange(applicationId, toStatus);
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

  const compareCandidates = [...compareIds].map((id) => {
    const s = scored?.find((row) => row.applicationId === id);
    if (!s) return null;
    return { id, name: s.name, status: s.status, resumeScore: s.resumeScore, interviewScore: s.interviewScore, skills: s.skills, application: fullApplications[id] };
  }).filter(Boolean);

  const scoreLabel = SCORE_TYPE_OPTIONS.find((o) => o.value === scoreType)?.label || 'Score';

  return (
    <HrShell active="hr-applicant-list" nav={nav} profile={profile}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Applicants</h1>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>Every applicant across every job posting, filterable and sortable in one place.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {profile?.role === 'hr_personnel' && (
                <Button variant={multiSelectMode ? 'strong' : 'ghost'} size="sm" onClick={toggleMultiSelectMode}>
                  {multiSelectMode ? 'Done Selecting' : 'Select'}
                </Button>
              )}
              {filtered.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleExportCsv} disabled={exportingCsv}>{exportingCsv ? 'Exporting…' : 'Export CSV'}</Button>
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
                <div onClick={() => setActiveStageFilter(null)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)' }}>Clear</div>
              </div>
            )}
          </div>
        )}

        {error && <p style={{ color: 'var(--red-700)' }}>{error}</p>}
        {!scored && !error && <p style={{ opacity: 0.7 }}>Loading applicants…</p>}

        {scored && (
          <>
            {profile?.role === 'hr_personnel' && selectedIds.size > 0 && (
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
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                    <thead>
                      <tr>
                        {multiSelectMode && profile?.role === 'hr_personnel' && <th style={{ width: 24, padding: '0 12px 10px' }} />}
                        <th style={{ width: 14, padding: '0 0 10px' }} />
                        {['Applicant', 'Job', 'Resume', 'Interview', 'Status', 'Applied'].map((h) => (
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
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'resume' ? 700 : 400 }}>{s.resumeScore != null ? `${s.resumeScore}%` : '—'}</td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'interview' ? 700 : 400 }}>{s.interviewScore != null ? `${s.interviewScore}%` : '—'}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>{status.label}</span>
                              </td>
                              <td style={{ padding: '12px', fontSize: 'var(--text-xs)', opacity: 0.65, whiteSpace: 'nowrap' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${s.applicationId}-detail`}>
                                <td colSpan={multiSelectMode && profile?.role === 'hr_personnel' ? 8 : 7} style={{ padding: 0, borderTop: 'none' }}>
                                  <div style={{ padding: '4px 16px 28px 16px', background: 'var(--surface-page-alt)' }}>
                                    {!a ? (
                                      <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6, padding: '16px 0' }}>Loading applicant details…</p>
                                    ) : (
                                      <div style={{ display: 'flex', gap: 24, padding: '16px 12px 0' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                          <ScoreBadge score={evaluations[s.applicationId]?.score} status={evalStatus[s.applicationId]} label="Resume Match" />
                                          <ScoreBadge score={s.interviewScore} status={s.interviewCompleted ? 'done' : (interviewResponses[s.applicationId]?.length ? 'evaluating' : 'not-started')} label="Interview Match" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: 'flex', gap: 14, marginTop: 2 }}>
                                            <div
                                              onClick={() => !resettingId && handleResetPassword(a.applicant_id, a.full_name)}
                                              style={{ cursor: resettingId === a.applicant_id ? 'default' : 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', display: 'inline-block', opacity: resettingId === a.applicant_id ? 0.5 : 1 }}
                                            >
                                              {resettingId === a.applicant_id ? 'Resetting…' : 'Reset Password'}
                                            </div>
                                            {(compareIds.has(s.applicationId) || compareIds.size < 3) && (
                                              <div onClick={() => toggleCompare(s.applicationId)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', display: 'inline-block' }}>
                                                {compareIds.has(s.applicationId) ? '✓ Comparing' : '+ Compare'}
                                              </div>
                                            )}
                                          </div>
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
                                            />
                                          )}
                                          {/* Decide actions stay outside every section toggle. */}
                                          {a.status === 'submitted' && profile?.role === 'hr_personnel' && (
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
                                          {a.status === 'interview_stage' && profile?.role === 'hr_personnel' && (
                                            <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                                              <div style={{ display: 'flex', gap: 10 }}>
                                                <Button variant="strong" size="sm" onClick={() => handleDecide(s.applicationId, 'advanced')} disabled={decidingId === s.applicationId}>Advance</Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDecide(s.applicationId, 'declined')} disabled={decidingId === s.applicationId}>Decline</Button>
                                              </div>
                                            </div>
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
    </HrShell>
  );
}
export default HrApplicantsList;
