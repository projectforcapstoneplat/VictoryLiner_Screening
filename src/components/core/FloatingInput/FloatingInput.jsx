// Extracted from SignIn.jsx (was local to just that page) once HrLogin.jsx
// needed the exact same floating-label behavior — label sits centered inside
// the field at rest, like a placeholder, and floats up into a small caption
// the moment the field is focused or has something typed in it. Kept
// separate from the shared Input component (used all over the app in places
// that were never asked to change), so this is purely opt-in.
import { useState } from 'react';

const EYE_ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function FloatingInput({ label, type = 'text', value, onChange, id, autoComplete }) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const floated = focused || value.length > 0;
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        type={isPassword && revealed ? 'text' : type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        style={{
          width: '100%', boxSizing: 'border-box', height: 56, padding: `22px ${isPassword ? 46 : 16}px 6px 16px`,
          background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)', border: 'none', borderRadius: 12,
          fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
        }}
      />
      <label
        htmlFor={id}
        style={{
          position: 'absolute', left: 16, top: floated ? 9 : '50%', transform: floated ? 'none' : 'translateY(-50%)',
          fontSize: floated ? 11 : 'var(--text-sm)', fontWeight: floated ? 700 : 400,
          color: floated ? 'var(--action-primary-bg)' : 'var(--text-primary)', opacity: floated ? 1 : 0.55,
          transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: 'none',
        }}
      >
        {label}
      </label>
      {isPassword && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          style={{
            position: 'absolute', top: 0, right: 0, height: '100%', width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', opacity: 0.6, padding: 0,
          }}
        >
          {revealed ? (
            <svg {...EYE_ICON_PROPS}><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
          ) : (
            <svg {...EYE_ICON_PROPS}><path d="M3 3l18 18" /><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.2 13.2 0 0 1-3.1 3.9M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.7-.28 3.9-.75" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
          )}
        </button>
      )}
    </div>
  );
}
export default FloatingInput;
