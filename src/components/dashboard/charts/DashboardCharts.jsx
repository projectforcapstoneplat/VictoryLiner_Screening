// Shared bar-chart primitives used by both HR dashboards (HrHeadDashboard's
// system-wide reports and HrPersonnelDashboard's operational queue view) —
// pulled out so the two never drift into two slightly different-looking
// implementations of the same chart.

// A three-way proportional split (positive/neutral/negative) as one
// segmented bar, plus a big-number stat block per sentiment below it —
// distinct from HorizontalBarChart below because these three values are
// parts of one whole (sum to 100%), not independent magnitudes to compare
// side by side. The stat row (not just the thin bar + dot legend this used
// to be) is what actually fills a full-height dashboard card instead of
// leaving most of it blank — same big-number treatment as the "Active in
// Pipeline"/"Average Time-to-Hire" cards elsewhere on these dashboards.
export function SentimentBar({ sentiment }) {
  const { positive, neutral, negative, total } = sentiment;
  if (total === 0) return <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No interview responses evaluated yet.</p>;
  const segments = [
    { key: 'positive', label: 'Positive', value: positive, color: '#0ca30c' },
    { key: 'neutral', label: 'Neutral', value: neutral, color: 'var(--gray-500)' },
    { key: 'negative', label: 'Negative', value: negative, color: 'var(--red-700)' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {segments.map((s) => s.value > 0 && <div key={s.key} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color, transition: 'width 0.8s ease' }} />)}
      </div>
      <div style={{ display: 'flex', gap: 0, marginTop: 20 }}>
        {segments.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: 1, textAlign: 'center', padding: '0 8px',
              borderLeft: i > 0 ? '1px solid var(--border-hairline)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 'var(--text-xs)', opacity: 0.65, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-3xl)', color: s.value > 0 ? s.color : 'var(--text-primary)', opacity: s.value > 0 ? 1 : 0.35 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.55, marginTop: 2 }}>
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </div>
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
