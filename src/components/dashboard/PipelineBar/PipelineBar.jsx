// Compact "stages" bar for one job's recruitment pipeline — 4 independently
// scaled segments (not a stacked/parts-of-whole bar, since each stage is a
// narrowing subset of the one before it: Applications -> Screened ->
// Interviewed -> Decided). Colors reuse the same validated status hues as
// the sentiment breakdown elsewhere, so "in progress vs resolved" reads
// consistently across the dashboard.
//
// Each stage is clickable when `job`+`nav` are given (and it has at least
// one candidate) — jumps straight to the Applicants table, pre-filtered to
// this job and this stage. `stageFilter`'s matchesStage in
// HrApplicantsList.jsx must define the exact same "which candidates count as
// this stage" logic as buildPipeline in reports.js, or the number shown here
// and the list HR lands on would disagree.
const STAGES = [
  { key: 'applications', label: 'Applications', color: 'var(--action-primary-bg)' },
  { key: 'screened', label: 'Initial Screening', color: '#fab219' },
  { key: 'interviewed', label: 'Interview', color: '#0ca30c' },
  { key: 'decided', label: 'Decided', color: 'var(--gray-500)' },
];

export function PipelineBar({ pipeline, job, nav }) {
  const max = pipeline.applications || 1;
  const clickable = !!(job && nav);

  const goToStage = (stageKey) => {
    if (!clickable || !pipeline[stageKey]) return;
    nav('hr-applicant-list', job, { stageFilter: stageKey });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 12 }}>
        {STAGES.map((s) => {
          const active = clickable && pipeline[s.key] > 0;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${pipeline[s.key]}${active ? ' — click to view' : ''}`}
              onClick={() => goToStage(s.key)}
              style={{
                width: `${Math.max((pipeline[s.key] / max) * 100, pipeline[s.key] > 0 ? 3 : 0)}%`, background: s.color, borderRadius: 3,
                cursor: active ? 'pointer' : 'default',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {STAGES.map((s) => {
          const active = clickable && pipeline[s.key] > 0;
          return (
            <div
              key={s.key}
              onClick={() => goToStage(s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-xs)', opacity: 0.75, cursor: active ? 'pointer' : 'default' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ textDecoration: active ? 'underline' : 'none' }}>{s.label}</span> <strong style={{ opacity: 1 }}>{pipeline[s.key]}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default PipelineBar;
