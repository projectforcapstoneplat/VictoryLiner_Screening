// Stat tile used across both HR dashboards. Trend is only ever a real
// week-over-week comparison computed from actual timestamps (see
// src/lib/reports.js weekTrend) — never a placeholder number.
const ACCENTS = {
  red: { bg: 'var(--pink-100)', fg: 'var(--action-primary-bg)' },
  amber: { bg: '#fdf0da', fg: '#c98500' },
  green: { bg: '#e3f6e6', fg: '#0ca30c' },
  violet: { bg: '#ece7fa', fg: '#6d4fc7' },
};

function TrendArrow({ direction }) {
  if (direction === 'up') return <span aria-hidden>▲</span>;
  if (direction === 'down') return <span aria-hidden>▼</span>;
  return <span aria-hidden>–</span>;
}

export function KpiCard({ icon, accent = 'red', label, value, trend }) {
  const { bg, fg } = ACCENTS[accent];
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-4xl)' }}>{value}</span>
        {trend && (
          <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 3 }}>
            <TrendArrow direction={trend.direction} />{trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
export default KpiCard;
