// figma reference: "next-prev" pagination row, homepage + Job-filter frames
import React from 'react';

function Dot({ children, active, onClick }) {
  return (
    <span
      onClick={onClick}
      className="btn-animate"
      style={{
        width: 42, height: 42, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--action-primary-bg)' : 'transparent',
        color: active ? 'var(--action-primary-text)' : 'var(--text-primary)',
        fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 400, fontSize: 'var(--text-base)', cursor: 'pointer',
      }}
    >
      {children}
    </span>
  );
}

// Builds a windowed page list (first, last, current +/-1, ellipses between
// gaps) instead of a fixed [1,2,3,4,'...',pageCount] — the old fixed list
// broke for any pageCount <= 4 (e.g. pageCount=1 rendered "1 2 3 4 ... 1").
function buildPageList(page, pageCount) {
  const pages = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }
  return pages;
}

export function Pagination({ page = 1, pageCount = 1, onChange }) {
  if (pageCount <= 1) return null;
  const pages = buildPageList(page, pageCount);
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)' }}>
      <span
        onClick={() => !atStart && onChange?.(Math.max(1, page - 1))}
        className="btn-animate"
        style={{
          height: 42, padding: '0 20px', borderRadius: 'var(--radius-lg)', background: 'var(--action-primary-bg)',
          color: 'var(--action-primary-text)', display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-base)',
          cursor: atStart ? 'default' : 'pointer', opacity: atStart ? 0.4 : 1,
        }}
      >
        &lt;&nbsp;&nbsp;Prev
      </span>
      {pages.map((p, i) => (p === '…' ? (
        <span key={`gap-${i}`} style={{ padding: '0 4px', color: 'var(--text-primary)', opacity: 0.5 }}>…</span>
      ) : (
        <Dot key={p} active={p === page} onClick={() => onChange?.(p)}>{p}</Dot>
      )))}
      <span
        onClick={() => !atEnd && onChange?.(Math.min(pageCount, page + 1))}
        className="btn-animate"
        style={{
          height: 42, padding: '0 20px', borderRadius: 'var(--radius-lg)', background: 'var(--action-primary-bg)',
          color: 'var(--action-primary-text)', display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-base)',
          cursor: atEnd ? 'default' : 'pointer', opacity: atEnd ? 0.4 : 1,
        }}
      >
        Next&nbsp;&nbsp;&gt;
      </span>
    </nav>
  );
}
export default Pagination;
