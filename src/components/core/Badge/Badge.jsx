// figma reference: "Job Category" pill, Job-details frame
import React from 'react';
export function Badge({ children = 'Job Category' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '8px 32px', borderRadius: 'var(--radius-2xl)',
      background: 'var(--pink-300)', color: 'var(--text-accent)',
      fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 'var(--text-2xl)',
      textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}
export default Badge;
