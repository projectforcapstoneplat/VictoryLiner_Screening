// Compact "stages" bar for one job's recruitment pipeline — 4 independently
// scaled segments (not a stacked/parts-of-whole bar, since each stage is a
// narrowing subset of the one before it: Applications -> Screened ->
// Interviewed -> Decided). Colors reuse the same validated status hues as
// the sentiment breakdown elsewhere, so "in progress vs resolved" reads
// consistently across the dashboard.
const STAGES = [
  { key: 'applications', label: 'Applications', color: 'var(--action-primary-bg)' },
  { key: 'screened', label: 'Initial Screening', color: '#fab219' },
  { key: 'interviewed', label: 'Interview', color: '#0ca30c' },
  { key: 'decided', label: 'Decided', color: 'var(--gray-500)' },
];

export function PipelineBar({ pipeline }) {
  const max = pipeline.applications || 1;
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 12 }}>
        {STAGES.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${pipeline[s.key]}`}
            style={{ width: `${Math.max((pipeline[s.key] / max) * 100, pipeline[s.key] > 0 ? 3 : 0)}%`, background: s.color, borderRadius: 3 }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {STAGES.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-xs)', opacity: 0.75 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            {s.label} <strong style={{ opacity: 1 }}>{pipeline[s.key]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
export default PipelineBar;
