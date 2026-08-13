// HR — applicants list for a single job posting.
import { useEffect, useMemo, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { listApplicationsForJob, updateApplicationStatus, listDecisionLogForApplications, resetApplicantPassword, notifyApplicantStatusChange } from '../lib/applications.js';
import { listNotesForApplications, addNote, deleteNote } from '../lib/applicationNotes.js';
import { computeYearsOfExperience } from '../lib/experience.js';
import { listEvaluationsForJob, evaluateApplication } from '../lib/resumeEvaluation.js';
import {
  listResponsesForApplications,
  listEvaluationsForApplications,
  evaluateResponse,
  getSignedVideoUrl,
} from '../lib/interviewEvaluation.js';
import { buildCsv, downloadCsv } from '../lib/csvExport.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';

const DECISION_META = {
  submitted: { label: 'Awaiting Review', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' },
  interview_stage: { label: 'Interview Stage', bg: '#fff4e0', fg: '#c98500' },
  advanced: { label: 'Advanced', bg: '#e3f6e6', fg: '#0ca30c' },
  declined: { label: 'Declined', bg: 'var(--pink-100)', fg: 'var(--red-700)' },
};

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
            fontSize: 'var(--text-xs)',
            padding: '2px 10px',
            borderRadius: 999,
            background: c.matched ? 'var(--pink-100)' : 'var(--gray-100)',
            color: c.matched ? 'var(--red-700)' : 'var(--gray-600)',
            cursor: 'default',
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
        <div
          onClick={onRetry}
          style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginTop: 8, display: 'inline-block' }}
        >
          Re-evaluate
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)' }}>AI evaluation failed{errorMessage ? `: ${errorMessage}` : '.'}</p>
        <div
          onClick={onRetry}
          style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}
        >
          Retry
        </div>
      </div>
    );
  }
  return (
    <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 12 }}>AI is evaluating this applicant…</p>
  );
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
          <div
            onClick={() => handleWatch(response.video_path)}
            style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}
          >
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
              <div
                onClick={() => onRetry(response.id)}
                style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginTop: 6, display: 'inline-block' }}
              >
                Re-evaluate
              </div>
            </div>
          ) : status === 'error' ? (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-700)' }}>AI evaluation failed{errorMessage ? `: ${errorMessage}` : '.'}</p>
              <div
                onClick={() => onRetry(response.id)}
                style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
              >
                Retry
              </div>
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
        <InterviewResponseRow
          key={r.id}
          response={r}
          evaluation={evaluations[r.id]}
          status={evalStatus[r.id]}
          errorMessage={evalErrors[r.id]}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}

// Internal-only — never shown to the applicant. Free-text observations HR
// staff leave for each other on a candidate (e.g. "called, no answer").
function NotesSection({ notes, draft, onDraftChange, onAdd, onDelete, saving, currentUserId }) {
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Internal Notes</strong>
      <p style={{ fontSize: 'var(--text-xs)', opacity: 0.55, margin: '2px 0 8px' }}>Only visible to HR — never shown to the applicant.</p>
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ background: 'var(--surface-page-alt)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{n.profiles?.full_name || n.profiles?.email || 'HR'}</span>
                <span style={{ fontSize: 10, opacity: 0.55, flexShrink: 0 }}>{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{n.note}</p>
              {n.author_id === currentUserId && (
                <div onClick={() => onDelete(n.id)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 10, marginTop: 4, display: 'inline-block' }}>
                  Delete
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Add a note for other HR staff…"
          rows={2}
          style={{
            flex: 1, padding: '8px 10px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', resize: 'vertical',
            background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)', border: 'none', borderRadius: 6, color: 'var(--text-primary)',
          }}
        />
        <Button variant="ghost" size="sm" onClick={onAdd} disabled={saving || !draft.trim()}>{saving ? 'Saving…' : 'Add'}</Button>
      </div>
    </div>
  );
}

const COMPARE_ROW_STYLE = { padding: '10px 14px', borderTop: '1px solid var(--border-hairline)', fontSize: 'var(--text-sm)', verticalAlign: 'top' };

// Side-by-side view for 2-3 candidates at once (see compareIds/toggleCompare
// below) — reviewing full cards one at a time makes it easy to lose track
// of how candidates stack up against each other on the same criteria.
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
              <th key={c.application.id} style={{ ...COMPARE_ROW_STYLE, borderTop: 'none', textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>{c.application.full_name}</div>
                <div onClick={() => onRemove(c.application.id)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 10, marginTop: 2 }}>Remove</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Resume Match</td>
            {candidates.map((c) => <td key={c.application.id} style={COMPARE_ROW_STYLE}>{c.evaluation?.score != null ? `${c.evaluation.score}%` : '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Interview Match</td>
            {candidates.map((c) => <td key={c.application.id} style={COMPARE_ROW_STYLE}>{c.interviewScore != null ? `${c.interviewScore}%` : '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Status</td>
            {candidates.map((c) => <td key={c.application.id} style={COMPARE_ROW_STYLE}>{(DECISION_META[c.application.status] || DECISION_META.submitted).label}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Years Experience</td>
            {candidates.map((c) => <td key={c.application.id} style={COMPARE_ROW_STYLE}>{computeYearsOfExperience(c.application.work_experience) ?? '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Education</td>
            {candidates.map((c) => <td key={c.application.id} style={COMPARE_ROW_STYLE}>{c.application.education_level || '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Skills</td>
            {candidates.map((c) => <td key={c.application.id} style={COMPARE_ROW_STYLE}>{c.application.skills?.length ? c.application.skills.join(', ') : '—'}</td>)}
          </tr>
          <tr>
            <td style={{ ...COMPARE_ROW_STYLE, opacity: 0.6 }}>Driver&rsquo;s License</td>
            {candidates.map((c) => <td key={c.application.id} style={COMPARE_ROW_STYLE}>{c.application.drivers_license_type || '—'}</td>)}
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

export function HrApplicants({ job, nav, profile }) {
  const [applications, setApplications] = useState([]);
  const [decidingId, setDecidingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [evaluations, setEvaluations] = useState({});
  const [evalStatus, setEvalStatus] = useState({});
  const [evalErrors, setEvalErrors] = useState({});
  const [loading, setLoading] = useState(true);

  const [interviewResponses, setInterviewResponses] = useState({}); // applicationId -> [response, ...]
  const [interviewEvaluations, setInterviewEvaluations] = useState({}); // responseId -> evaluation
  const [interviewEvalStatus, setInterviewEvalStatus] = useState({}); // responseId -> 'evaluating' | 'error'
  const [interviewEvalErrors, setInterviewEvalErrors] = useState({});
  const [decisionLog, setDecisionLog] = useState({}); // applicationId -> most recent decision log entry
  const [notes, setNotes] = useState({}); // applicationId -> [note, ...] most-recent-first
  const [noteDrafts, setNoteDrafts] = useState({}); // applicationId -> in-progress textarea value
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [minResumeMatchPercent, setMinResumeMatchPercent] = useState(50);
  // Collapsed by default — with a lot of applicants, always-expanded cards
  // (skills, experience, AI assessment, interview answers, decide buttons)
  // meant a huge amount of scrolling just to scan names and scores.
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpanded = (id) => setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Bulk decline — for closing out a posting without clicking Decline one
  // card at a time. Deliberately decline-only: bulk-advancing is a much
  // higher-stakes mistake to make at scale, so that stays a per-candidate
  // decision. Works across a mix of 'submitted' and 'interview_stage'
  // selections since each call uses that applicant's own current status.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeclining, setBulkDeclining] = useState(false);
  const toggleSelected = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Separate from selectedIds (bulk-decline) — comparing candidates is a
  // read-only, any-status, any-role action, not tied to making a decision.
  // Capped at 3 so the side-by-side table stays readable.
  const [compareIds, setCompareIds] = useState(() => new Set());
  const toggleCompare = (id) => setCompareIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else if (next.size < 3) next.add(id);
    return next;
  });

  useEffect(() => {
    getScreeningSettings().then(({ data }) => {
      if (data) setMinResumeMatchPercent(data.min_resume_match_percent);
    });
  }, []);

  // This job posting can override the system-wide minimum with its own
  // value (src/pages/JobPostingForm.jsx) — null means "use the default".
  const effectiveMinPercent = job?.min_resume_match_percent ?? minResumeMatchPercent;

  useEffect(() => {
    if (!job?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [appsResult, evalResult] = await Promise.all([listApplicationsForJob(job.id), listEvaluationsForJob(job.id)]);
      if (cancelled) return;
      setApplications(appsResult.data);
      const map = {};
      for (const e of evalResult.data) map[e.application_id] = e;
      setEvaluations(map);

      const appIds = appsResult.data.map((a) => a.id);
      const [responsesResult, interviewEvalResult, decisionLogResult, notesResult] = await Promise.all([
        listResponsesForApplications(appIds),
        listEvaluationsForApplications(appIds),
        listDecisionLogForApplications(appIds),
        listNotesForApplications(appIds),
      ]);
      if (cancelled) return;
      const byApplication = {};
      for (const r of responsesResult.data) {
        (byApplication[r.application_id] ||= []).push(r);
      }
      setInterviewResponses(byApplication);
      const interviewEvalMap = {};
      for (const e of interviewEvalResult.data) interviewEvalMap[e.response_id] = e;
      setInterviewEvaluations(interviewEvalMap);

      // Rows are already ordered most-recent-first, so the first one seen
      // per application is the current decision's log entry.
      const decisionMap = {};
      for (const d of decisionLogResult.data) {
        if (!decisionMap[d.application_id]) decisionMap[d.application_id] = d;
      }
      setDecisionLog(decisionMap);

      const notesMap = {};
      for (const n of notesResult.data) {
        (notesMap[n.application_id] ||= []).push(n);
      }
      setNotes(notesMap);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [job]);

  // Auto-evaluate any applicant that doesn't have a saved AI assessment yet.
  // Run one at a time (not Promise.all) to stay under Gemini's free-tier rate
  // limits when a job has many applicants.
  useEffect(() => {
    if (loading) return;
    const missing = applications.filter((a) => !evaluations[a.id] && evalStatus[a.id] !== 'evaluating' && evalStatus[a.id] !== 'error');
    if (missing.length === 0) return;
    let cancelled = false;

    async function runQueue() {
      for (const a of missing) {
        if (cancelled) return;
        setEvalStatus((s) => ({ ...s, [a.id]: 'evaluating' }));
        const { data, error } = await evaluateApplication(a.id);
        if (cancelled) return;
        if (error) {
          setEvalStatus((s) => ({ ...s, [a.id]: 'error' }));
          setEvalErrors((e) => ({ ...e, [a.id]: error }));
        } else {
          setEvaluations((e) => ({ ...e, [a.id]: data }));
          setEvalStatus((s) => ({ ...s, [a.id]: 'done' }));
        }
      }
    }
    runQueue();
    return () => {
      cancelled = true;
    };
    // Only re-run when the application list itself changes (job switch, initial load) —
    // evaluations/evalStatus updates are read via functional setState above, not deps here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications, loading]);

  async function handleRetry(applicationId) {
    setEvalStatus((s) => ({ ...s, [applicationId]: 'evaluating' }));
    const { data, error } = await evaluateApplication(applicationId);
    if (error) {
      setEvalStatus((s) => ({ ...s, [applicationId]: 'error' }));
      setEvalErrors((e) => ({ ...e, [applicationId]: error }));
    } else {
      setEvaluations((e) => ({ ...e, [applicationId]: data }));
      setEvalStatus((s) => ({ ...s, [applicationId]: 'done' }));
    }
  }

  // Auto-evaluate any recorded interview answer that doesn't have a saved AI
  // assessment yet — same one-at-a-time queue as the resume evaluations above.
  useEffect(() => {
    if (loading) return;
    const allResponses = Object.values(interviewResponses).flat();
    const missing = allResponses.filter(
      (r) => r.video_path && !interviewEvaluations[r.id] && interviewEvalStatus[r.id] !== 'evaluating' && interviewEvalStatus[r.id] !== 'error',
    );
    if (missing.length === 0) return;
    let cancelled = false;

    async function runQueue() {
      for (const r of missing) {
        if (cancelled) return;
        setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'evaluating' }));
        const { data, error } = await evaluateResponse(r.id);
        if (cancelled) return;
        if (error) {
          setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'error' }));
          setInterviewEvalErrors((e) => ({ ...e, [r.id]: error }));
        } else {
          setInterviewEvaluations((e) => ({ ...e, [r.id]: data }));
          setInterviewEvalStatus((s) => ({ ...s, [r.id]: 'done' }));
        }
      }
    }
    runQueue();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewResponses, loading]);

  async function handleRetryInterview(responseId) {
    setInterviewEvalStatus((s) => ({ ...s, [responseId]: 'evaluating' }));
    const { data, error } = await evaluateResponse(responseId);
    if (error) {
      setInterviewEvalStatus((s) => ({ ...s, [responseId]: 'error' }));
      setInterviewEvalErrors((e) => ({ ...e, [responseId]: error }));
    } else {
      setInterviewEvaluations((e) => ({ ...e, [responseId]: data }));
      setInterviewEvalStatus((s) => ({ ...s, [responseId]: 'done' }));
    }
  }

  async function handleAddNote(applicationId) {
    const text = (noteDrafts[applicationId] || '').trim();
    if (!text) return;
    setSavingNoteId(applicationId);
    const { data, error } = await addNote(applicationId, profile.id, text);
    setSavingNoteId(null);
    if (error) {
      window.alert(`Could not save note: ${error.message}`);
      return;
    }
    setNotes((n) => ({ ...n, [applicationId]: [data, ...(n[applicationId] || [])] }));
    setNoteDrafts((d) => ({ ...d, [applicationId]: '' }));
  }

  async function handleDeleteNote(applicationId, noteId) {
    if (!window.confirm('Delete this note?')) return;
    const { error } = await deleteNote(noteId);
    if (error) {
      window.alert(`Could not delete note: ${error.message}`);
      return;
    }
    setNotes((n) => ({ ...n, [applicationId]: (n[applicationId] || []).filter((note) => note.id !== noteId) }));
  }

  function handleExportCsv() {
    const headers = [
      'Full Name', 'Email', 'Phone', 'Current Location', 'Applied On', 'Decision',
      'Resume Match %', 'Interview Match %', 'Skills', 'Education Level',
      "Driver's License Type", 'Years Driving Experience', 'NBI Clearance', 'Willing Shifting Schedule', 'Medical Certificate',
    ];
    const rows = ranked.map(({ application: a, evaluation, interviewScore }) => [
      a.full_name,
      a.email,
      a.phone || '',
      a.current_location || '',
      new Date(a.created_at).toLocaleDateString(),
      DECISION_META[a.status]?.label || 'Awaiting Review',
      evaluation?.score ?? '',
      interviewScore ?? '',
      (a.skills || []).join('; '),
      a.education_level || '',
      a.drivers_license_type || '',
      a.years_driving_experience ?? '',
      a.has_nbi_clearance == null ? '' : a.has_nbi_clearance ? 'Yes' : 'No',
      a.willing_shifting_schedule == null ? '' : a.willing_shifting_schedule ? 'Yes' : 'No',
      a.has_medical_certificate == null ? '' : a.has_medical_certificate ? 'Yes' : 'No',
    ]);
    const safeJobTitle = job.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    downloadCsv(`applicants-${safeJobTitle}-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(headers, rows));
  }

  async function handleResetPassword(applicantId, applicantName) {
    if (!window.confirm(`Generate a new temporary password for ${applicantName}? Their old password will stop working immediately.`)) {
      return;
    }
    setResettingId(applicantId);
    const { data, error } = await resetApplicantPassword(applicantId);
    setResettingId(null);
    if (error) {
      window.alert(`Could not reset password: ${error.message}`);
      return;
    }
    window.alert(
      `Temporary password for ${applicantName}:\n\n${data.password}\n\nShare this with them directly (phone, in person, etc.) — it won't be shown again. They can sign in with it right away.`,
    );
  }

  async function handleDecide(applicationId, toStatus) {
    setDecidingId(applicationId);
    const { error } = await updateApplicationStatus(applicationId, toStatus, profile.id);
    if (error) {
      window.alert(`Could not update this application: ${error.message}`);
      setDecidingId(null);
      return;
    }
    setApplications((apps) => apps.map((a) => (a.id === applicationId ? { ...a, status: toStatus } : a)));
    setDecisionLog((log) => ({
      ...log,
      [applicationId]: { status: toStatus, decided_at: new Date().toISOString(), profiles: { full_name: profile.full_name, email: profile.email } },
    }));
    setDecidingId(null);
    notifyApplicantStatusChange(applicationId, toStatus);
  }

  async function handleBulkDecline() {
    const targets = applications.filter((a) => selectedIds.has(a.id) && (a.status === 'submitted' || a.status === 'interview_stage'));
    if (targets.length === 0) return;
    if (!window.confirm(`Decline ${targets.length} selected applicant${targets.length === 1 ? '' : 's'}? This can't be bulk-undone.`)) return;
    setBulkDeclining(true);
    let failed = 0;
    for (const a of targets) {
      const { error } = await updateApplicationStatus(a.id, 'declined', profile.id);
      if (error) {
        failed += 1;
        continue;
      }
      setApplications((apps) => apps.map((row) => (row.id === a.id ? { ...row, status: 'declined' } : row)));
      setDecisionLog((log) => ({
        ...log,
        [a.id]: { status: 'declined', decided_at: new Date().toISOString(), profiles: { full_name: profile.full_name, email: profile.email } },
      }));
      notifyApplicantStatusChange(a.id, 'declined');
    }
    setBulkDeclining(false);
    setSelectedIds(new Set());
    if (failed > 0) {
      window.alert(`${failed} applicant${failed === 1 ? '' : 's'} could not be updated.`);
    }
  }

  // Ranked by resume match first — a preview of the full Candidate Ranking
  // module (resume + interview combined into one score) that Phase 4 builds.
  // Applicants still pending evaluation sort to the bottom rather than the top.
  const ranked = useMemo(
    () =>
      applications
        .map((a) => {
          const responses = interviewResponses[a.id] || [];
          const answered = responses.filter((r) => r.video_path);
          const answeredEvals = answered.map((r) => interviewEvaluations[r.id]).filter(Boolean);

          let interviewScore = null;
          let interviewStatus = 'not-started';
          if (answered.length > 0) {
            if (answeredEvals.length === answered.length) {
              interviewScore = Math.round(answeredEvals.reduce((sum, e) => sum + e.evaluation_score, 0) / answeredEvals.length);
              interviewStatus = 'done';
            } else if (answeredEvals.length === 0 && answered.some((r) => interviewEvalStatus[r.id] === 'error')) {
              interviewStatus = 'error';
            } else {
              interviewStatus = 'evaluating';
            }
          }

          return {
            application: a,
            evaluation: evaluations[a.id],
            status: evalStatus[a.id],
            errorMessage: evalErrors[a.id],
            interviewResponses: responses,
            interviewScore,
            interviewStatus,
          };
        })
        .sort((x, y) => (y.evaluation?.score ?? -1) - (x.evaluation?.score ?? -1)),
    [applications, evaluations, evalStatus, evalErrors, interviewResponses, interviewEvaluations, interviewEvalStatus],
  );

  const compareCandidates = ranked.filter((c) => compareIds.has(c.application.id));

  if (!job) {
    return (
      <HrShell active="hr-jobs" nav={nav} profile={profile}>
        <p>No job selected.</p>
        <Button variant="ghost" size="sm" onClick={() => nav('hr-jobs')}>Back to Job Openings</Button>
      </HrShell>
    );
  }

  return (
    <HrShell active="hr-jobs" nav={nav} profile={profile}>
      <div onClick={() => nav('hr-jobs')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginBottom: 20 }}>&larr; Back to Job Openings</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>Applicants — {job.title}</h1>
          <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginBottom: 22 }}>
            {applications.length} application{applications.length === 1 ? '' : 's'}
            {applications.length > 0 && ' · ranked by AI resume match against screening criteria'}
            {' · '}{job.min_resume_match_percent != null
              ? `${job.min_resume_match_percent}% minimum resume match for this role (custom)`
              : `${effectiveMinPercent}% minimum resume match (system default)`}
          </p>
        </div>
        {applications.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleExportCsv}>Export CSV</Button>
        )}
      </div>
      {profile?.role === 'hr_personnel' && selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--pink-100)', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{selectedIds.size} selected</span>
          <Button variant="ghost" size="sm" onClick={handleBulkDecline} disabled={bulkDeclining}>{bulkDeclining ? 'Declining…' : 'Decline Selected'}</Button>
          <div onClick={() => setSelectedIds(new Set())} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)' }}>Clear</div>
        </div>
      )}
      {compareCandidates.length >= 2 && (
        <ComparisonPanel candidates={compareCandidates} onRemove={toggleCompare} onClear={() => setCompareIds(new Set())} />
      )}
      {loading ? (
        <p>Loading applicants…</p>
      ) : applications.length === 0 ? (
        <p>No applications yet for this job.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ranked.map(({ application: a, evaluation, status, errorMessage, interviewResponses: responses, interviewScore, interviewStatus }, i) => {
            const decision = DECISION_META[a.status] || DECISION_META.submitted;
            const expanded = expandedIds.has(a.id);
            return (
              <Reveal key={a.id} delay={Math.min(i * 0.05, 0.4)} className="hover-lift hr-applicant-card" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px', display: 'flex', gap: 24 }}>
                {profile?.role === 'hr_personnel' && (a.status === 'submitted' || a.status === 'interview_stage') && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(a.id)}
                    onChange={() => toggleSelected(a.id)}
                    aria-label={`Select ${a.full_name}`}
                    style={{ width: 18, height: 18, marginTop: 4, flexShrink: 0, cursor: 'pointer' }}
                  />
                )}
                <div className="hr-applicant-card-scores" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <ScoreBadge score={evaluation?.score} status={status} label="Resume Match" />
                  <ScoreBadge score={interviewScore} status={interviewStatus} label="Interview Match" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <strong style={{ fontSize: 'var(--text-lg)' }}>{a.full_name}</strong>
                      <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8 }}>{a.email} {a.phone ? `· ${a.phone}` : ''} {a.current_location ? `· ${a.current_location}` : ''}</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>Applied {new Date(a.created_at).toLocaleDateString()}</div>
                      <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                        <div
                          onClick={() => !resettingId && handleResetPassword(a.applicant_id, a.full_name)}
                          style={{ cursor: resettingId === a.applicant_id ? 'default' : 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', display: 'inline-block', opacity: resettingId === a.applicant_id ? 0.5 : 1 }}
                        >
                          {resettingId === a.applicant_id ? 'Resetting…' : 'Reset Password'}
                        </div>
                        <div
                          onClick={() => toggleExpanded(a.id)}
                          style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', display: 'inline-block' }}
                        >
                          {expanded ? '▲ Hide Details' : '▼ Show Details'}
                        </div>
                        {(compareIds.has(a.id) || compareIds.size < 3) && (
                          <div
                            onClick={() => toggleCompare(a.id)}
                            style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', display: 'inline-block' }}
                          >
                            {compareIds.has(a.id) ? '✓ Comparing' : '+ Compare'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: decision.bg, color: decision.fg, whiteSpace: 'nowrap' }}>
                        {decision.label}
                      </span>
                      {decisionLog[a.id] && (
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.55, marginTop: 4 }}>
                          by {decisionLog[a.id].profiles?.full_name || decisionLog[a.id].profiles?.email || 'HR'} on {new Date(decisionLog[a.id].decided_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  {expanded && (
                    <>
                      {a.skills?.length > 0 && (
                        <div style={{ fontSize: 'var(--text-sm)', marginTop: 12 }}><strong>Skills:</strong> {a.skills.join(', ')}</div>
                      )}
                      <DrivingInfo application={a} />
                      <ExperienceList items={a.work_experience} />
                      <EducationList items={a.education} level={a.education_level} />
                      <CertificationList items={a.certifications} />
                      {a.cover_note && (
                        <div style={{ marginTop: 12 }}>
                          <strong style={{ fontSize: 'var(--text-sm)' }}>Cover Note</strong>
                          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, marginTop: 6 }}>{a.cover_note}</p>
                        </div>
                      )}
                      <AiAssessment evaluation={evaluation} status={status} errorMessage={errorMessage} onRetry={() => handleRetry(a.id)} />
                      <InterviewSection
                        responses={responses}
                        evaluations={interviewEvaluations}
                        evalStatus={interviewEvalStatus}
                        evalErrors={interviewEvalErrors}
                        onRetry={handleRetryInterview}
                      />
                      <NotesSection
                        notes={notes[a.id] || []}
                        draft={noteDrafts[a.id] || ''}
                        onDraftChange={(text) => setNoteDrafts((d) => ({ ...d, [a.id]: text }))}
                        onAdd={() => handleAddNote(a.id)}
                        onDelete={(noteId) => handleDeleteNote(a.id, noteId)}
                        saving={savingNoteId === a.id}
                        currentUserId={profile.id}
                      />
                      {a.status === 'submitted' && profile?.role === 'hr_personnel' && (
                        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                          <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, margin: '0 0 10px' }}>
                            Advancing unlocks the video interview for this applicant — it still also needs their resume score to reach {effectiveMinPercent}%
                            {evaluation?.score != null ? ` (currently ${evaluation.score}%)` : ' (not scored yet)'}.
                          </p>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <Button variant="strong" size="sm" onClick={() => handleDecide(a.id, 'interview_stage')} disabled={decidingId === a.id}>Advance to Interview</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDecide(a.id, 'declined')} disabled={decidingId === a.id}>Decline</Button>
                          </div>
                        </div>
                      )}
                      {a.status === 'interview_stage' && profile?.role === 'hr_personnel' && (
                        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                          {interviewStatus !== 'done' && (
                            <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, margin: '0 0 10px' }}>
                              Video interview isn&rsquo;t fully evaluated yet — you can still decide now if you&rsquo;ve seen enough.
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: 10 }}>
                            <Button variant="strong" size="sm" onClick={() => handleDecide(a.id, 'advanced')} disabled={decidingId === a.id}>Advance</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDecide(a.id, 'declined')} disabled={decidingId === a.id}>Decline</Button>
                          </div>
                        </div>
                      )}
                      {(a.status === 'advanced' || a.status === 'declined') && profile?.role === 'hr_personnel' && (
                        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                          <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, margin: '0 0 10px' }}>
                            Made this call by mistake? Reopening resets them to &ldquo;Awaiting Review&rdquo; for reconsideration from scratch.
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.confirm(`Reopen ${a.full_name}'s application? It will go back to "Awaiting Review".`) && handleDecide(a.id, 'submitted')}
                            disabled={decidingId === a.id}
                          >
                            Reopen
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
    </HrShell>
  );
}
export default HrApplicants;
