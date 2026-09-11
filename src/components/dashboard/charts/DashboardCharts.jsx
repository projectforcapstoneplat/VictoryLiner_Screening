// Shared bar-chart primitives used by both HR dashboards (HrHeadDashboard's
// system-wide reports and HrPersonnelDashboard's operational queue view) —
// pulled out so the two never drift into two slightly different-looking
// implementations of the same chart.

// A three-way proportional split (positive/neutral/negative) as one
// segmented bar plus a legend — distinct from HorizontalBarChart below
// because these three values are parts of one whole (sum to 100%), not
// independent magnitudes to compare side by side.
export function SentimentBar({ sentiment }) {
  const { positive, neutral, negative, total } = sentiment;
  if (total === 0) return <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No interview responses evaluated yet.</p>;
  const segments = [
    { key: 'positive', label: 'Positive', value: positive, color: '#0ca30c' },
    { key: 'neutral', label: 'Neutral', value: neutral, color: 'var(--gray-500)' },
    { key: 'negative', label: 'Negative', value: negative, color: '#d03b3b' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {segments.map((s) => s.value > 0 && <div key={s.key} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color, transition: 'width 0.8s ease' }} />)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {segments.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span>{s.label} ({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Generic single-series magnitude bar chart (score distribution, category
// breakdown) — kept as one flat brand-color hue since a single series never
// needs a categorical palette; order along the axis already conveys the
// score buckets' sequence, so color doesn't need to redundantly encode it.
export function HorizontalBarChart({ rows, emptyMessage }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>{emptyMessage}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }} title={`${r.label}: ${r.count} applicant${r.count === 1 ? '' : 's'}`}>
          <span style={{ fontSize: 'var(--text-xs)', width: 96, flexShrink: 0, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'var(--surface-page-alt)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${max > 0 ? (r.count / max) * 100 : 0}%`, borderRadius: 999, background: 'var(--action-primary-bg)', transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }} />
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, width: 22, textAlign: 'right', flexShrink: 0 }}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}
