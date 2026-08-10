// Dropdown, styled to match Input's field look.
import React from 'react';
export function Select({ label, value, onChange, options, placeholder = 'Select…', style, ...rest }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)', ...style }}>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>}
      <select value={value} onChange={onChange} {...rest} style={{
        height: 49, width: '100%', boxSizing: 'border-box', padding: '0 18px',
        background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
        border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
      }}>
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}
export default Select;
