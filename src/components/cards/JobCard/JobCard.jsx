// figma reference: "Job descrip container" job listing card, homepage + Job-filter frames
import React from 'react';
import { Badge } from '../../core/Badge/Badge.jsx';
export function JobCard({ title = 'Job Title', category = 'Job Category', description = 'Lorem ipsum dolor sit amet consectetur. Non maecenas nec rhoncus mauris phasellus turpis tellus posuere lacus.', openPositions = 1, onApply }) {
  return (
    <div style={{
      background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)',
      padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18, fontFamily: 'var(--font-ui)', cursor: onApply ? 'pointer' : 'default',
    }} onClick={onApply}>
      <Badge>{category}</Badge>
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>{title}</div>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5, maxWidth: 780 }}>{description}</p>
      <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 'var(--text-md)', fontWeight: 300 }}>
        <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid var(--text-primary)', display: 'inline-block' }} />
        {openPositions} Open Position{openPositions === 1 ? '' : 's'}
      </div>
    </div>
  );
}
export default JobCard;
