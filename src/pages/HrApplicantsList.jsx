// HR — "Applicants" tab: every applicant across every job posting in one
// filterable, sortable list. Complements HrApplicants.jsx (which is scoped
// to one job's full detail cards with decide/notes/interview actions) by
// giving HR a cross-job view for scanning and ranking the whole pool at
// once — click a row to jump into that applicant's job for the full detail
// view and any decisions.
import { useEffect, useMemo, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { getScoredApplicants } from '../lib/reports.js';

const SCORE_TYPE_OPTIONS = [
  { value: 'total', label: 'Resume + Interview (Combined)' },
  { value: 'resume', label: 'Resume Score Only' },
  { value: 'interview', label: 'Interview Score Only' },
];

const STATUS_META = {
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

function scoreFor(candidate, scoreType) {
  if (scoreType === 'resume') return candidate.resumeScore;
  if (scoreType === 'interview') return candidate.interviewScore;
  return candidate.totalScore;
}

export function HrApplicantsList({ nav, profile }) {
  const [scored, setScored] = useState(null);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [scoreType, setScoreType] = useState('total');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    getScoredApplicants().then(({ data, error: err }) => {
      if (err) setError(err.message || 'Failed to load applicants.');
      else setScored(data.scored);
    });
  }, []);

  const categories = useMemo(
    () => (scored ? [...new Set(scored.map((s) => s.job?.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : []),
    [scored],
  );

  const filtered = useMemo(() => {
    if (!scored) return [];
    return scored
      .filter((s) => categoryFilter === 'all' || s.job?.category === categoryFilter)
      .filter((s) => {
        const score = scoreFor(s, scoreType);
        return score != null && score >= scoreMin && score <= scoreMax;
      })
      .sort((a, b) => {
        const diff = scoreFor(a, scoreType) - scoreFor(b, scoreType);
        return sortDir === 'asc' ? diff : -diff;
      });
  }, [scored, categoryFilter, scoreType, scoreMin, scoreMax, sortDir]);

  const scoreLabel = SCORE_TYPE_OPTIONS.find((o) => o.value === scoreType)?.label || 'Score';

  return (
    <HrShell active="hr-applicant-list" nav={nav} profile={profile}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Reveal>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Applicants</h1>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>
            Every applicant across every job posting, filterable and sortable in one place.
          </p>
        </Reveal>

        {error && <p style={{ color: 'var(--red-700)' }}>{error}</p>}
        {!scored && !error && <p style={{ opacity: 0.7 }}>Loading applicants…</p>}

        {scored && (
          <Reveal delay={0.05} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingBottom: 16, borderBottom: '1px solid var(--border-hairline)' }}>
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
                <input
                  type="number" min={0} max={100} value={scoreMin}
                  onChange={(e) => setScoreMin(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  style={NUM_INPUT_STYLE}
                />
                to
                <input
                  type="number" min={0} max={100} value={scoreMax}
                  onChange={(e) => setScoreMax(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  style={NUM_INPUT_STYLE}
                />
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
                      {['Applicant', 'Job', 'Resume', 'Interview', 'Status', 'Applied'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 'var(--text-xs)', opacity: 0.6, fontWeight: 600, padding: '0 12px 10px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const status = STATUS_META[s.status] || STATUS_META.submitted;
                      return (
                        <tr
                          key={s.applicationId}
                          onClick={() => s.job && nav('hr-applicants', s.job)}
                          className="hover-lift"
                          style={{ cursor: s.job ? 'pointer' : 'default', borderTop: '1px solid var(--border-hairline)' }}
                        >
                          <td style={{ padding: '12px', fontSize: 'var(--text-sm)' }}>
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{s.email}</div>
                          </td>
                          <td style={{ padding: '12px', fontSize: 'var(--text-sm)' }}>
                            <div>{s.job?.title || '—'}</div>
                            {s.job?.category && <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{s.job.category}</div>}
                          </td>
                          <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'resume' ? 700 : 400 }}>
                            {s.resumeScore != null ? `${s.resumeScore}%` : '—'}
                          </td>
                          <td style={{ padding: '12px', fontSize: 'var(--text-sm)', fontWeight: scoreType === 'interview' ? 700 : 400 }}>
                            {s.interviewScore != null ? `${s.interviewScore}%` : '—'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>
                              {status.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: 'var(--text-xs)', opacity: 0.65, whiteSpace: 'nowrap' }}>
                            {new Date(s.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Reveal>
        )}
      </div>
    </HrShell>
  );
}
export default HrApplicantsList;
