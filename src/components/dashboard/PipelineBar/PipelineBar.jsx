// Compact "stages" chart for one job's recruitment pipeline — 4 independently
// scaled columns (not a stacked/parts-of-whole bar, since each stage is a
// narrowing subset of the one before it: Applications -> Screened ->
// Interviewed -> Decided). Colors reuse the same validated status hues as
// the sentiment breakdown elsewhere, so "in progress vs resolved" reads
// consistently across the dashboard.
//
// A vertical bar chart per the professor's review feedback — the original
// version was a single horizontal bar with 4 side-by-side segments, easy to
// misread as one continuous stacked bar even though each segment is actually
// its own independently-scaled count. Separate vertical columns make each
// stage's count read as its own distinct value at a glance, the way a
// standard bar chart does.
//
// Each stage is clickable when `job`+`nav` are given (and it has at least
// one candidate) — jumps straight to the Applicants table, pre-filtered to
// this job and this stage. `stageFilter`'s matchesStage in
// HrApplicantsList.jsx must define the exact same "which candidates count as
// this stage" logic as buildPipeline in reports.js, or the number shown here
// and the list HR lands on would disagree.
const STAGES = [
  { key: 'applications', label: 'Applications', axisLabel: 'Applied', color: 'var(--action-primary-bg)' },
  { key: 'screened', label: 'Initial Screening', axisLabel: 'Screened', color: '#fab219' },
  { key: 'interviewed', label: 'Interview', axisLabel: 'Interview', color: '#0ca30c' },
  { key: 'decided', label: 'Decided', axisLabel: 'Decided', color: 'var(--gray-500)' },
];

const CHART_HEIGHT = 64;

export function PipelineBar({ pipeline, job, nav }) {
  const max = pipeline.applications || 1;
  const clickable = !!(job && nav);

  const goToStage = (stageKey) => {
    if (!clickable || !pipeline[stageKey]) return;
    nav('hr-applicant-list', job, { stageFilter: stageKey });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: CHART_HEIGHT + 24 }}>
        {STAGES.map((s) => {
          const value = pipeline[s.key] || 0;
          const active = clickable && value > 0;
          const barHeight = value > 0 ? Math.max((value / max) * CHART_HEIGHT, 4) : 2;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${value}${active ? ' — click to view' : ''}`}
              onClick={() => goToStage(s.key)}
              className={active ? 'btn-animate' : undefined}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                height: '100%', cursor: active ? 'pointer' : 'default',
              }}
            >
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 4 }}>{value}</span>
              <div style={{ width: '100%', maxWidth: 32, height: barHeight, background: s.color, borderRadius: '5px 5px 2px 2px', opacity: value > 0 ? 1 : 0.3 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {STAGES.map((s) => (
          <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65, lineHeight: 1.2 }}>{s.axisLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export default PipelineBar;
