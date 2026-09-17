// Stat tile used across both HR dashboards. Trend is only ever a real
// week-over-week comparison computed from actual timestamps (see
// src/lib/reports.js weekTrend) — never a placeholder number.
import { useCountUp } from '../../../lib/useCountUp.js';

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

// `compact` shrinks padding/icon/number size for pages that need every KPI
// row to cost less vertical space (HrPersonnelDashboard's one-screen, no-
// scroll layout) — opt-in so HrHeadDashboard's own usage is unaffected.
// `onClick` (optional) makes the whole tile a real button — e.g. jumping
// straight to the Applicants list pre-filtered to whatever this number is
// actually counting, instead of just being a static readout.
export function KpiCard({ icon, accent = 'red', label, value, trend, compact = false, onClick }) {
  const { bg, fg } = ACCENTS[accent];
  // Counts up from 0 the moment the card mounts — by the time this renders,
  // the dashboard's data fetch has already resolved (see the `{report && ...}`
  // gate in HrHeadDashboard/HrPersonnelDashboard), so `value` is always the
  // real final number, never a placeholder mid-count.
  const displayValue = useCountUp(value, true);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className="hover-lift"
      style={{
        background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)',
        padding: compact ? '14px 16px' : '20px 22px', display: 'flex', flexDirection: 'column', gap: compact ? 8 : 14, minWidth: 0,
        border: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', width: '100%',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <div style={{ width: compact ? 28 : 36, height: compact ? 28 : 36, borderRadius: 10, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: compact ? 'var(--text-2xl)' : 'var(--text-4xl)' }}>{displayValue}</span>
        {trend && (
          <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 3 }}>
            <TrendArrow direction={trend.direction} />{trend.label}
          </span>
        )}
      </div>
    </Tag>
  );
}
export default KpiCard;
