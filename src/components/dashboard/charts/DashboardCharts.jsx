// Shared bar-chart primitives used by both HR dashboards (HrHeadDashboard's
// system-wide reports and HrPersonnelDashboard's operational queue view) —
// pulled out so the two never drift into two slightly different-looking
// implementations of the same chart.

// A three-way proportional split (positive/neutral/negative) as a donut —
// the right chart shape for this data specifically because these three
// values are parts of one whole (sum to 100%), unlike the independent
// magnitudes HorizontalBarChart/VerticalDistributionChart compare side by
// side. Used to be a segmented bar (still just one strip, easy to misread
// as a progress/loading bar rather than a proportion) plus a stat row below
// it; the ring keeps the same "share of the whole" read a bar gave, with
// the total sitting right in the center, and the stat list next to it
// (not below) keeps the card from needing much extra vertical room.
export function SentimentBar({ sentiment }) {
  const { positive, neutral, negative, total } = sentiment;
  if (total === 0) return <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>No interview responses evaluated yet.</p>;
  const segments = [
    { key: 'positive', label: 'Positive', value: positive, color: '#0ca30c' },
    { key: 'neutral', label: 'Neutral', value: neutral, color: 'var(--gray-500)' },
    { key: 'negative', label: 'Negative', value: negative, color: 'var(--red-700)' },
  ];
  const size = 128;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let drawn = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-page-alt)" strokeWidth={stroke} />
          {segments.map((s) => {
            if (s.value === 0) return null;
            const length = (s.value / total) * circumference;
            const dashoffset = -drawn;
            drawn += length;
            return (
              <circle
                key={s.key} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={dashoffset}
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
              />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-2xl)' }}>{total}</span>
          <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Response{total === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 150 }}>
        {segments.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }} title={`${s.label}: ${s.value}`}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {s.label}
            </span>
            <span style={{ fontSize: 'var(--text-sm)' }}>
              <strong>{s.value}</strong>{' '}
              <span style={{ opacity: 0.55 }}>({total > 0 ? Math.round((s.value / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Same data shape as HorizontalBarChart (rows of {label, count}), rendered
// as columns instead — a small number of wide, short-labeled buckets (score
// distribution) reads more like an actual "distribution" as a classic bar
// chart than as a stack of horizontal progress bars, and lines up visually
// with PipelineBar's own vertical-column chart elsewhere on these
// dashboards. HorizontalBarChart stays the right shape for longer label
// sets (category names, funnel stages) where columns would crowd the axis.
export function VerticalDistributionChart({ rows, emptyMessage }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>{emptyMessage}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  const chartHeight = 88;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: chartHeight + 24 }}>
        {rows.map((r) => {
          const barHeight = r.count > 0 ? Math.max((r.count / max) * chartHeight, 4) : 2;
          return (
            <div
              key={r.label}
              title={`${r.label}: ${r.count} applicant${r.count === 1 ? '' : 's'}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
            >
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 4 }}>{r.count}</span>
              <div style={{
                width: '100%', maxWidth: 46, height: barHeight, background: 'var(--action-primary-bg)',
                borderRadius: '6px 6px 2px 2px', opacity: r.count > 0 ? 1 : 0.25, transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ flex: 1, textAlign: 'center', fontSize: 'var(--text-xs)', opacity: 0.6, lineHeight: 1.2 }}>{r.label}</div>
        ))}
      </div>
    </div>
  );
}

// Generic single-series magnitude bar chart (category breakdown, funnel
// stages) — kept as one flat brand-color hue since a single series never
// needs a categorical palette; order along the axis already conveys the
// buckets' sequence, so color doesn't need to redundantly encode it.
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
