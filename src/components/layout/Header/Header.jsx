// figma reference: "header" glass pill nav, present on every frame
import React from 'react';
import { useTheme } from '../../../lib/ThemeContext.jsx';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
        background: 'transparent', boxShadow: 'var(--shadow-hairline)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// Each link is either a plain string (inert, matches older callers) or
// { label, onClick, strong } for a real nav action — 'strong' renders it as
// a filled pill button (e.g. "Apply Now") instead of a plain text link.
// When `links` isn't given, the default Contact Us/About Us pair is wired
// through `nav` (if provided) instead of being inert placeholder text.
// `accessory` is an optional extra element (e.g. a signed-in account chip)
// rendered inside the pill itself, right after the theme toggle — this is
// the "decent place" for account state, not a separate row floating below.
export function Header({ links, onLogoClick, compact = false, nav, accessory }) {
  const resolvedLinks = links ?? [
    { label: 'Contact Us', onClick: nav ? () => nav('contact') : undefined },
    { label: 'About Us', onClick: nav ? () => nav('home', null, { scrollTo: 'about' }) : undefined },
  ];
  return (
    <header className="app-header" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      height: compact ? 66 : 86, padding: compact ? '0 32px' : '0 40px', borderRadius: 'var(--radius-md)',
      background: 'var(--surface-glass)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: compact ? '0 8px 20px rgba(0,0,0,0.12)' : 'var(--shadow-glass-header)', boxSizing: 'border-box',
      transition: 'height 0.25s ease, padding 0.25s ease, box-shadow 0.25s ease, background 0.25s ease',
    }}>
      <button
        type="button"
        onClick={onLogoClick || (() => { window.location.href = '/'; })}
        aria-label="Victory Liner Careers — go to homepage"
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-display)',
          border: 'none', background: 'transparent', padding: 0, font: 'inherit',
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--action-primary-bg)' }}>Victory Liner</span>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-primary)' }}>Careers</span>
      </button>
      <nav className="app-header-nav" style={{ display: 'flex', alignItems: 'center', gap: 36, fontFamily: 'var(--font-ui)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>
        {resolvedLinks.map((l) => {
          const label = typeof l === 'string' ? l : l.label;
          const onClick = typeof l === 'string' ? undefined : l.onClick;
          if (typeof l !== 'string' && l.strong) {
            return (
              <button
                key={label}
                onClick={onClick}
                style={{
                  border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)',
                  padding: '12px 24px', background: 'var(--action-primary-bg)', color: 'var(--action-primary-text)',
                  fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700,
                }}
              >
                {label}
              </button>
            );
          }
          return (
            <a
              key={label}
              href="#"
              onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : (e) => e.preventDefault()}
              style={{ color: 'inherit', textDecoration: 'none', cursor: onClick ? 'pointer' : 'default' }}
            >
              {label}
            </a>
          );
        })}
        <ThemeToggle />
        {accessory}
      </nav>
    </header>
  );
}
export default Header;
