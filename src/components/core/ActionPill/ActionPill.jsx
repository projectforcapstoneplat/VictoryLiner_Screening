// Same tinted-pill-with-icon language HrDashboard.jsx already established
// for its job-card actions (View/Edit/Publish/Close) — pulled out here so
// toolbar actions elsewhere (HrApplicantsList's Compare/Select/Export CSV)
// get the same treatment instead of a plain hairline-outline button.
const TONE = {
  neutral: { bg: 'var(--surface-page-alt)', fg: 'var(--text-primary)' },
  primary: { bg: 'var(--pink-100)', fg: 'var(--action-primary-bg)' },
  positive: { bg: '#e3f6e6', fg: '#0ca30c' },
  warning: { bg: '#fff4e0', fg: '#c98500' },
  danger: { bg: '#fdecea', fg: 'var(--red-700)' },
};

// `active` (not just a tone) is its own thing: a toggle that's currently ON
// needs to read as unmistakably different from its own resting tint, not
// just a slightly different pastel — so it overrides to the same solid
// filled look Button's `strong` variant uses everywhere else in the app.
export function ActionPill({ icon, label, tone = 'neutral', active = false, onClick, disabled }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <button
      className="btn-animate"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999,
        border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700,
        fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: disabled ? 0.55 : 1,
        background: active ? 'var(--red-700)' : t.bg, color: active ? '#fff' : t.fg,
      }}
    >
      {icon}{label}
    </button>
  );
}
export default ActionPill;
