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
  };
  const Tag = href ? 'a' : 'button';
  return (
    <Tag href={href} type={href ? undefined : type} onClick={onClick} className={['btn-animate', className].filter(Boolean).join(' ')} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
      fontFamily: 'var(--font-ui)', fontWeight: variant === 'strong' ? 700 : 200,
      lineHeight: 1, textDecoration: 'none', boxSizing: 'border-box',
      ...sizes[size], ...variants[variant], ...style,
    }} {...rest}>{children}</Tag>
  );
}
export default Button;
