// figma reference: email/password fields, application + application-CREATE frames
import React from 'react';
export function Input({ label, type = 'text', placeholder, value, onChange, hint, style, ...rest }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)', ...style }}>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>}
      <input type={type} placeholder={placeholder} value={value} onChange={onChange} {...rest} style={{
        height: 49, width: '100%', boxSizing: 'border-box', padding: '0 18px',
        background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
        border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
      }} />
      {hint && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{hint}</span>}
    </label>
  );
}
export default Input;
