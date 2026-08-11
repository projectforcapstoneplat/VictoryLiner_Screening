// HR — applicants list for a single job posting.
import { useEffect, useMemo, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { listApplicationsForJob, updateApplicationStatus, listDecisionLogForApplications } from '../lib/applications.js';
import { computeYearsOfExperience } from '../lib/experience.js';
import { listEvaluationsForJob, evaluateApplication } from '../lib/resumeEvaluation.js';
import {
  listResponsesForApplications,
  listEvaluationsForApplications,
  evaluateResponse,
  getSignedVideoUrl,
} from '../lib/interviewEvaluation.js';
import { buildCsv, downloadCsv } from '../lib/csvExport.js';

const DECISION_META = {
  submitted: { label: 'Awaiting Review', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' },
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
  const [evaluations, setEvaluations] = useState({});
  const [evalStatus, setEvalStatus] = useState({});
  const [evalErrors, setEvalErrors] = useState({});
  const [loading, setLoading] = useState(true);

  const [interviewResponses, setInterviewResponses] = useState({}); // applicationId -> [response, ...]
  const [interviewEvaluations, setInterviewEvaluations] = useState({}); // responseId -> evaluation
  const [interviewEvalStatus, setInterviewEvalStatus] = useState({}); // responseId -> 'evaluating' | 'error'
  const [interviewEvalErrors, setInterviewEvalErrors] = useState({});
  const [decisionLog, setDecisionLog] = useState({}); // applicationId -> most recent decision log entry

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
      const [responsesResult, interviewEvalResult, decisionLogResult] = await Promise.all([
        listResponsesForApplications(appIds),
        listEvaluationsForApplications(appIds),
        listDecisionLogForApplications(appIds),
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

  async function handleDecide(applicationId, status) {
    setDecidingId(applicationId);
    const { data, error } = await updateApplicationStatus(applicationId, status, profile.id);
    if (error?.code === 'ALREADY_DECIDED') {
      window.alert(`${error.message}\n\nThis list will refresh to show the current status.`);
      setApplications((apps) => apps.map((a) => (a.id === applicationId ? { ...a, status: data?.status || a.status } : a)));
      setDecidingId(null);
      return;
    }
    setApplications((apps) => apps.map((a) => (a.id === applicationId ? { ...a, status } : a)));
    setDecisionLog((log) => ({
      ...log,
      [applicationId]: { status, decided_at: new Date().toISOString(), profiles: { full_name: profile.full_name, email: profile.email } },
    }));
    setDecidingId(null);
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
          </p>
        </div>
        {applications.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleExportCsv}>Export CSV</Button>
        )}
      </div>
      {loading ? (
        <p>Loading applicants…</p>
      ) : applications.length === 0 ? (
        <p>No applications yet for this job.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ranked.map(({ application: a, evaluation, status, errorMessage, interviewResponses: responses, interviewScore, interviewStatus }) => {
            const decision = DECISION_META[a.status] || DECISION_META.submitted;
            return (
              <div key={a.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px', display: 'flex', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <ScoreBadge score={evaluation?.score} status={status} label="Resume Match" />
                  <ScoreBadge score={interviewScore} status={interviewStatus} label="Interview Match" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <strong style={{ fontSize: 'var(--text-lg)' }}>{a.full_name}</strong>
                      <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8 }}>{a.email} {a.phone ? `· ${a.phone}` : ''} {a.current_location ? `· ${a.current_location}` : ''}</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>Applied {new Date(a.created_at).toLocaleDateString()}</div>
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
                  {a.status === 'submitted' && profile?.role === 'hr_personnel' && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 16, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
                      <Button variant="strong" size="sm" onClick={() => handleDecide(a.id, 'advanced')} disabled={decidingId === a.id}>Advance</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDecide(a.id, 'declined')} disabled={decidingId === a.id}>Decline</Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HrShell>
  );
}
export default HrApplicants;
