// A branded stand-in for window.confirm() — the native dialog renders as
// the browser/OS's own plain system chrome (no way to style it, ever, in
// any environment — that's not a localhost-vs-production difference), which
// stood out badly against the rest of this app's design. Confirm-style only
// (two buttons, no text input) since that's the only thing window.confirm()
// itself was ever used for here.
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button.jsx';

export function ConfirmModal({
  open, title, message, children, confirmLabel = 'Continue', cancelLabel = 'Cancel', confirmDisabled = false, onConfirmBlocked, maxWidth = 420, onConfirm, onCancel,
}) {
  if (!open) return null;
  // Rendered into document.body via a portal rather than wherever this
  // component happens to sit in the tree — this has repeatedly (RepeatableSection,
  // ResumeForm's upload-consent modal, JobPostingForm's criteria Remove
  // confirm) gotten nested inside a `.fade-in-up` animated ancestor.
  // `animation-fill-mode: both` leaves a lingering `transform` on that
  // ancestor even after the animation finishes, which creates a new
  // containing block for any `position: fixed` descendant — so instead of
  // covering the real viewport, the modal renders clipped/mispositioned
  // relative to that small animated wrapper, often invisible entirely. A
  // portal sidesteps the whole class of bug once, here, instead of every
  // caller having to remember to render its own ConfirmModal as a sibling
  // outside whatever animated wrapper it's working inside.
  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in-up"
        style={{
          background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          padding: 28, maxWidth, width: '100%', maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        {title && <strong style={{ fontSize: 'var(--text-lg)', display: 'block', marginBottom: 10 }}>{title}</strong>}
        {message && <p style={{ fontSize: 'var(--text-sm)', opacity: 0.8, lineHeight: 1.6, margin: children ? '0 0 16px' : '0 0 22px' }}>{message}</p>}
        {/* Extra content between the message and the button row — e.g. a
            consent checkbox that gates confirmDisabled. Optional so every
            existing plain confirm/cancel caller is unaffected. */}
        {children && <div style={{ marginBottom: 22 }}>{children}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="outline" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          {/* Native `disabled` unless the caller supplies onConfirmBlocked —
              a truly disabled button swallows the click entirely, so there's
              no way to tell someone *why* nothing happened (e.g. a required
              consent checkbox left unticked). Passing onConfirmBlocked keeps
              the button genuinely clickable (still visually dimmed) and lets
              the caller react to that specific click — a shake, a hint,
              whatever fits — instead of the click just vanishing. Callers
              that don't need that (e.g. a plain "Saving…" disable) are
              unaffected: same native-disabled behavior as before. */}
          <Button
            variant="strong" size="sm"
            onClick={confirmDisabled && onConfirmBlocked ? onConfirmBlocked : onConfirm}
            disabled={confirmDisabled && !onConfirmBlocked}
            style={confirmDisabled && onConfirmBlocked ? { opacity: 0.5 } : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
export default ConfirmModal;
