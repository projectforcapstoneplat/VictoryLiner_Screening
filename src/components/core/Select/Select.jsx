// Dropdown, styled to match Input's field look.
import React from 'react';
// `placeholderSelectable` — the placeholder option is disabled (can't be
// re-selected) by default, which is correct for a required field (e.g. Job
// Category on JobPostingForm.jsx — you shouldn't be able to leave it back on
// "Select a category"). A *filter* dropdown (HrDashboard.jsx's Category /
// Station filters) is the opposite: "" is a perfectly valid, meaningful
// state ("show all"), and needs to be reachable again after picking a real
// value — so those pass this flag to leave the option enabled.
export function Select({ label, value, onChange, options, placeholder = 'Select…', placeholderSelectable = false, style, ...rest }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)', ...style }}>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>}
      <select value={value} onChange={onChange} {...rest} style={{
        height: 49, width: '100%', boxSizing: 'border-box', padding: '0 18px',
        background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
        border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
      }}>
        <option value="" disabled={!placeholderSelectable}>{placeholder}</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}
export default Select;
