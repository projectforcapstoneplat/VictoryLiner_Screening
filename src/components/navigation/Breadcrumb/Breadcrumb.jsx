// figma reference: "return" breadcrumb, Job-details frame
//
// Each item is either a plain string (current-page label, not clickable) or
// { label, onClick } for a navigable crumb — e.g. "Home" going back, while
// "Job Details" (the page you're already on) stays plain text. Previously
// the whole breadcrumb was wrapped in one outer onClick that navigated home
// no matter which word you clicked, including "Job Details" itself, which
// looked like a live link to the current page for no reason.
import React from 'react';
export function Breadcrumb({ items = ['Home', 'Job Details'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-ui)', fontWeight: 400, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>
      {items.map((item, i) => {
        const { label, onClick } = typeof item === 'string' ? { label: item, onClick: null } : item;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ fontSize: 'var(--text-base)', opacity: 0.6 }}>&gt;&gt;</span>}
            {onClick ? (
              <span onClick={onClick} style={{ cursor: 'pointer', opacity: 0.85 }} onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }} onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}>
                {label}
              </span>
            ) : (
              <span>{label}</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
export default Breadcrumb;
