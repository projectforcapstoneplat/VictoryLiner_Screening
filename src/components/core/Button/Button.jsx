// figma reference: Apply / Sign In / Next / Prev pill buttons across Job-details, application, homepage
import React from 'react';
export function Button({ children, variant = 'primary', size = 'md', href, onClick, type = 'button', style, className, ...rest }) {
  const sizes = {
    sm: { padding: '11px 17px', fontSize: 'var(--text-base)', minWidth: 100, height: 45 },
    md: { padding: '18px 29px', fontSize: 'var(--text-base)', minWidth: 121, height: 65.5 },
    lg: { padding: '13px 0', fontSize: 'var(--text-lg)', width: '100%', height: 55 },
  };
  const variants = {
    primary: { background: 'var(--action-primary-bg)', color: 'var(--action-primary-text)' },
    strong: { background: 'var(--red-700)', color: 'var(--off-white-300)' },
    ghost: { background: 'transparent', color: 'var(--text-primary)', boxShadow: 'var(--shadow-hairline)' },
    // A real bordered pill (not just a hairline) for a secondary action that
    // still needs to read as a deliberate choice, not an afterthought —
    // "ghost" alone (thin 200-weight text, near-invisible shadow) was too
    // faint for anything the applicant might actually need to notice, e.g.
    // re-record sitting next to a bold "Submit Answer".
    outline: { background: 'transparent', color: 'var(--action-primary-bg)', boxShadow: 'inset 0 0 0 1.5px var(--action-primary-bg)' },
  };
  const Tag = href ? 'a' : 'button';
  return (
    <Tag href={href} type={href ? undefined : type} onClick={onClick} className={['btn-animate', className].filter(Boolean).join(' ')} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
      fontFamily: 'var(--font-ui)', fontWeight: variant === 'strong' || variant === 'outline' ? 700 : 200,
      lineHeight: 1, textDecoration: 'none', boxSizing: 'border-box',
      ...sizes[size], ...variants[variant], ...style,
    }} {...rest}>{children}</Tag>
  );
}
export default Button;
