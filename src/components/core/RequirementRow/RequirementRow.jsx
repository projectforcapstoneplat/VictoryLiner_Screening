// Password requirement / match indicator — used on Create Account and Reset
// Password. A filled check-circle when met (same glyph/circle treatment as
// the Stepper's completed-step marker, for a consistent "done" language
// across the app) instead of raw colored ✓/✗ text, which read as an old-
// school form-validation error rather than a calm onboarding checklist.
export function RequirementRow({ passed, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-sm)' }}>
      <span
        aria-hidden
        style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: passed ? '#0ca30c' : 'var(--surface-page-alt)', transition: 'background 0.25s ease',
        }}
      >
        {passed ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gray-500)' }} />
        )}
      </span>
      <span style={{ color: 'var(--text-primary)', opacity: passed ? 1 : 0.6, transition: 'opacity 0.25s ease' }}>{label}</span>
    </div>
  );
}
export default RequirementRow;
