// A branded stand-in for window.confirm() — the native dialog renders as
// the browser/OS's own plain system chrome (no way to style it, ever, in
// any environment — that's not a localhost-vs-production difference), which
// stood out badly against the rest of this app's design. Confirm-style only
// (two buttons, no text input) since that's the only thing window.confirm()
// itself was ever used for here.
import { Button } from '../Button/Button.jsx';

export function ConfirmModal({ open, title, message, confirmLabel = 'Continue', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,10,10,0.55)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in-up"
        style={{
          background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          padding: 28, maxWidth: 420, width: '100%',
        }}
      >
        {title && <strong style={{ fontSize: 'var(--text-lg)', display: 'block', marginBottom: 10 }}>{title}</strong>}
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.8, lineHeight: 1.6, margin: '0 0 22px' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="outline" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="strong" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
export default ConfirmModal;
