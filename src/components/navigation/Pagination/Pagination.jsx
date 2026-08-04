// figma reference: "next-prev" pagination row, homepage + Job-filter frames
import React from 'react';
function Dot({ children, active }) {
  return (
    <span style={{
      width: 45, height: 45, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'var(--action-primary-bg)' : 'transparent',
      color: active ? 'var(--action-primary-text)' : 'var(--text-primary)',
      fontFamily: 'var(--font-ui)', fontWeight: 200, fontSize: 'var(--text-base)', cursor: 'pointer',
    }}>{children}</span>
  );
}
export function Pagination({ page = 1, pageCount = 10, onChange }) {
  const pages = [1, 2, 3, 4, '...', pageCount];
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)' }}>
      <span onClick={() => onChange?.(Math.max(1, page - 1))} style={{
        height: 45, padding: '0 24px', borderRadius: 'var(--radius-lg)', background: 'var(--action-primary-bg)',
        color: 'var(--action-primary-text)', display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-base)', cursor: 'pointer',
      }}>&lt;&nbsp;&nbsp;&nbsp;&nbsp;Prev</span>
      {pages.map((p, i) => p === '...' ? <span key={i} style={{ padding: '0 6px', color: 'var(--text-primary)' }}>...</span> :
        <span key={i} onClick={() => onChange?.(p)}><Dot active={p === page}>{p}</Dot></span>)}
      <span onClick={() => onChange?.(Math.min(pageCount, page + 1))} style={{
        height: 45, padding: '0 24px', borderRadius: 'var(--radius-lg)', background: 'var(--action-primary-bg)',
        color: 'var(--action-primary-text)', display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-base)', cursor: 'pointer',
      }}>Next&nbsp;&nbsp;&nbsp;&nbsp;&gt;</span>
    </nav>
  );
}
export default Pagination;
