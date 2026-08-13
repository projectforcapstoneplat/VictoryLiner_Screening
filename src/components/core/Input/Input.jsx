// figma reference: email/password fields, application + application-CREATE frames
import React, { useState } from 'react';

function EyeIcon({ open }) {
  return open ? (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.2 13.2 0 0 1-3.1 3.9M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.7-.28 3.9-.75" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function Input({ label, type = 'text', placeholder, value, onChange, hint, style, ...rest }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)', ...style }}>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type={isPassword && revealed ? 'text' : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          {...rest}
          style={{
            height: 49, width: '100%', boxSizing: 'border-box', padding: isPassword ? '0 46px 0 18px' : '0 18px',
            background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
            border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            tabIndex={-1}
            style={{
              position: 'absolute', top: 0, right: 0, height: 49, width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', opacity: 0.6, padding: 0,
            }}
          >
            <EyeIcon open={revealed} />
          </button>
        )}
      </div>
      {hint && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{hint}</span>}
    </label>
  );
}
export default Input;
