// Dropdown, styled to match Input's field look.
import React from 'react';
// `placeholderSelectable` — the placeholder option is disabled (can't be
// re-selected) by default, which is correct for a required field (e.g. Job
// Category on JobPostingForm.jsx — you shouldn't be able to leave it back on
// "Select a category"). A *filter* dropdown (HrDashboard.jsx's Category /
// Station filters) is the opposite: "" is a perfectly valid, meaningful
// state ("show all"), and needs to be reachable again after picking a real
// value — so those pass this flag to leave the option enabled.
// Native select arrows sit flush against the edge with barely any breathing
// room and render differently per browser/OS — appearance: none drops that
// in favor of one custom SVG chevron with real spacing, identical
// everywhere. Shared by every dropdown built on this component (and mirrored
// by heavier one-off <select>s elsewhere, e.g. JobPostingForm's Weight
// dropdown, that couldn't use this component directly).
export const DROPDOWN_ARROW_STYLE = {
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 16px center',
};

// "pill" is an opt-in visual variant for a compact filter toolbar sitting
// next to pill-shaped tab/toggle buttons (e.g. HrDashboard's status tabs +
// Category/Station filters + "Closing Soon" toggle, all in one row) — the
// default variant is a tall, sharp-cornered form field meant for a proper
// multi-field form (ResumeForm, JobPostingForm) and looks jarringly
// mismatched dropped into a row of small rounded pills. Everywhere that
// doesn't pass this prop keeps the exact form-field look unchanged.
const VARIANT_STYLES = {
  field: {
    height: 49, padding: '0 40px 0 18px',
    background: 'var(--surface-field)', border: 'none', borderRadius: 0,
    fontSize: 'var(--text-sm)',
  },
  pill: {
    height: 32, padding: '0 30px 0 14px',
    background: 'transparent', border: '1px solid var(--border-hairline)', borderRadius: 999,
    fontSize: 'var(--text-xs)', fontWeight: 600,
  },
};

export function Select({ label, value, onChange, options, placeholder = 'Select…', placeholderSelectable = false, error, variant = 'field', style, ...rest }) {
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.field;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)', ...style }}>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>}
      <select value={value} onChange={onChange} {...rest} style={{
        width: '100%', boxSizing: 'border-box',
        boxShadow: error ? 'inset 0 0 0 1.5px var(--red-700)' : variant === 'field' ? 'var(--shadow-field-inset)' : 'none',
        fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', cursor: 'pointer',
        ...variantStyle,
        ...DROPDOWN_ARROW_STYLE,
        backgroundPosition: variant === 'pill' ? 'right 10px center' : DROPDOWN_ARROW_STYLE.backgroundPosition,
      }}>
        <option value="" disabled={!placeholderSelectable}>{placeholder}</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}
export default Select;
