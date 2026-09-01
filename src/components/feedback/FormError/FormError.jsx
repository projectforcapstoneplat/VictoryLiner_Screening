// Animated, iconed error banner for auth/account forms — replaces bare red
// text (easy to miss, reads as an afterthought) with something that actually
// draws the eye toward what went wrong. The `.form-error` class (see
// styles.css) fades/drops in and settles with a small shake, and is included
// in the app's prefers-reduced-motion disable list like every other
// animation here.
export function FormError({ message, action }) {
  if (!message) return null;
  return (
    <div
      className="form-error"
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', boxSizing: 'border-box',
        background: 'var(--pink-100)', color: 'var(--red-700)', borderRadius: 10, padding: '12px 14px',
        fontSize: 'var(--text-sm)', lineHeight: 1.45, flexWrap: 'wrap',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
      {action}
    </div>
  );
}
export default FormError;
