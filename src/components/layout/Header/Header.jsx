// figma reference: "header" glass pill nav, present on every frame
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../lib/ThemeContext.jsx';
import { signOut } from '../../../lib/auth.js';

function HamburgerIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (
        <><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></>
      ) : (
        <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
      )}
    </svg>
  );
}

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
// One link's markup, shared between the desktop inline nav and the mobile
// dropdown menu — `stacked` widens the strong/plain styling to fill a full-
// width menu row instead of sitting inline among other links.
function NavLink({ l, stacked, onNavigate }) {
  const label = typeof l === 'string' ? l : l.label;
  const onClick = typeof l === 'string' ? undefined : l.onClick;
  const handleClick = (e) => {
    e.preventDefault();
    onClick?.();
    onNavigate?.();
  };
  if (typeof l !== 'string' && l.strong) {
    return (
      <button
        onClick={handleClick}
        style={{
          border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)',
          padding: '12px 24px', background: 'var(--action-primary-bg)', color: 'var(--action-primary-text)',
          fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700,
          width: stacked ? '100%' : undefined, textAlign: stacked ? 'center' : undefined,
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <a
      href="#"
      onClick={handleClick}
      style={{ color: 'inherit', textDecoration: 'none', cursor: onClick ? 'pointer' : 'default', display: stacked ? 'block' : undefined, padding: stacked ? '10px 4px' : undefined }}
    >
      {label}
    </a>
  );
}

// Signed-in indicator — an avatar-initial chip + icon-only sign-out button,
// sitting inside the header pill itself (via the `accessory` slot) rather
// than as a separate plain-text row floating underneath it.
function AccountChip({ profile, onSignOut }) {
  const name = profile.full_name || profile.email || 'Account';
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-card)',
      borderRadius: 999, padding: '5px 6px 5px 5px', boxShadow: 'var(--shadow-hairline)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: 'var(--action-primary-bg)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--text-xs)', flexShrink: 0,
      }}>
        {initial}
      </div>
      <span style={{
        fontSize: 'var(--text-xs)', fontWeight: 600, maxWidth: 140, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)',
      }}>
        {name}
      </span>
      <button
        onClick={onSignOut}
        title="Sign Out"
        aria-label="Sign Out"
        style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
          background: 'var(--surface-page-alt)', color: 'var(--action-primary-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}

// `profile` is the one prop most pages already have in scope, so passing it
// gets a working sign-out for free without each page having to build its own
// chip + handler — a page can still override with a fully custom `accessory`
// instead. Without this, a gated screen with no other nav escape (e.g.
// ResumeForm.jsx, which bounces an incomplete resume straight back to itself)
// would have no way to sign out at all.
export function Header({ links, onLogoClick, compact = false, nav, accessory, profile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const resolvedLinks = links ?? [
    { label: 'Contact Us', onClick: nav ? () => nav('contact') : undefined },
    { label: 'About Us', onClick: nav ? () => nav('home', null, { scrollTo: 'about' }) : undefined },
  ];

  // Same ordering fix as HrShell's UserMenu: nav first, then signOut(), so a
  // gated screen doesn't re-render mid-signOut against an already-null
  // session before `screen` has caught up.
  const handleSignOut = () => {
    nav?.('home');
    signOut();
  };
  const resolvedAccessory = accessory ?? (profile ? <AccountChip profile={profile} onSignOut={handleSignOut} /> : null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => { if (headerRef.current && !headerRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <header ref={headerRef} className="app-header" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      height: compact ? 66 : 86, padding: compact ? '0 32px' : '0 40px', borderRadius: 'var(--radius-md)',
      background: 'var(--surface-glass)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: compact ? '0 8px 20px rgba(0,0,0,0.12)' : 'var(--shadow-glass-header)', boxSizing: 'border-box',
      transition: 'height 0.25s ease, padding 0.25s ease, box-shadow 0.25s ease, background 0.25s ease',
      position: 'relative',
    }}>
      <button
        type="button"
        onClick={onLogoClick || (() => { window.location.href = '/'; })}
        aria-label="Victory Liner Careers — go to homepage"
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-display)',
          border: 'none', background: 'transparent', padding: 0, font: 'inherit', minWidth: 0,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--action-primary-bg)', whiteSpace: 'nowrap' }}>Victory Liner</span>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Careers</span>
      </button>

      {/* Desktop — hidden below 640px via the .app-header-nav media rule. */}
      <nav className="app-header-nav" style={{ display: 'flex', alignItems: 'center', gap: 36, fontFamily: 'var(--font-ui)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>
        {resolvedLinks.map((l) => <NavLink key={typeof l === 'string' ? l : l.label} l={l} />)}
        <ThemeToggle />
        {resolvedAccessory}
      </nav>

      {/* Mobile — theme toggle/account chip stay visible; links collapse
          behind the hamburger instead of wrapping into a cramped grid. */}
      <div className="app-header-mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
        <ThemeToggle />
        {resolvedAccessory}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: 'transparent', boxShadow: 'var(--shadow-hairline)', color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </div>

      {menuOpen && (
        <div className="app-header-mobile-menu" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 10, zIndex: 50,
          background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: '0 16px 32px rgba(0,0,0,0.18)',
          padding: '10px 18px', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-md)', color: 'var(--text-primary)',
        }}>
          {resolvedLinks.map((l) => <NavLink key={typeof l === 'string' ? l : l.label} l={l} stacked onNavigate={() => setMenuOpen(false)} />)}
        </div>
      )}
    </header>
  );
}
export default Header;
