// figma reference: "return" breadcrumb, Job-details frame
import React from 'react';
export function Breadcrumb({ items = ['Home', 'Job Details'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-ui)', fontWeight: 400, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ fontSize: 'var(--text-base)' }}>&gt;&gt;</span>}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
export default Breadcrumb;
