// figma reference: "header" glass pill nav, present on every frame
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../lib/ThemeContext.jsx';
import { signOut } from '../../../lib/auth.js';
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from '../../../lib/applicantNotifications.js';
import { getMyResume } from '../../../lib/applicantResume.js';

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
      className="app-header-icon-btn"
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

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Applicant-facing counterpart to HrShell's NotificationBell — "a new job
// matches you," written by match-job-to-resumes at the same moment it sends
// the email (see migration 0026_applicant_notifications.sql), so an
// applicant sees this even if the email never arrives. Only ever rendered
// for a signed-in applicant (see resolvedAccessory below) — HR/no-profile
// visitors never fetch or see this at all.
function NotificationBell({ applicantId, nav }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const boxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    listMyNotifications(applicantId).then(({ data }) => {
      if (!cancelled) setNotifications(data);
    });
    return () => {
      cancelled = true;
    };
  }, [applicantId]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const goToNotification = (n) => {
    setOpen(false);
    if (!n.read_at) {
      markNotificationRead(n.id);
      setNotifications((rows) => rows.map((r) => (r.id === n.id ? { ...r, read_at: new Date().toISOString() } : r)));
    }
    // job_id survives the job posting itself being deleted (set null on
    // delete) — 'matches' is always a valid landing spot either way, and
    // shows this exact job if it's still published and still qualifies.
    nav('matches');
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    markAllNotificationsRead(applicantId);
    setNotifications((rows) => rows.map((r) => (r.read_at ? r : { ...r, read_at: new Date().toISOString() })));
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="app-header-icon-btn"
        style={{
          width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
          background: 'transparent', boxShadow: 'var(--shadow-hairline)', color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, borderRadius: 9, background: 'var(--action-primary-bg)', color: '#fff',
            fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="app-header-notif-dropdown" style={{
          position: 'absolute', top: 46, right: 0, width: 300, background: 'var(--surface-card)', borderRadius: 12,
          boxShadow: '0 12px 28px rgba(0,0,0,0.22)', padding: 10, zIndex: 60, maxHeight: 360, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px 10px' }}>
            <strong style={{ fontSize: 'var(--text-sm)' }}>Notifications</strong>
            {unreadCount > 0 && (
              <span onClick={handleMarkAllRead} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-link)', cursor: 'pointer' }}>Mark all read</span>
            )}
          </div>
          {notifications.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', opacity: 0.7, margin: 0, padding: '0 8px 6px' }}>Nothing yet — we'll let you know the moment a new opening matches you.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => goToNotification(n)}
                style={{ padding: '8px 8px', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, background: n.read_at ? 'transparent' : 'var(--pink-100)' }}
              >
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: n.read_at ? 500 : 700 }}>{n.title}</span>
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{timeAgo(n.created_at)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// An applicant who signed up with email/password never types their name
// anywhere on the account itself — Create Account only ever asked for
// email/password (see SignIn.jsx) — so profiles.full_name stays null for
// them forever; their real name only exists on their standalone resume
// (applicant_resumes.full_name, filled in during ResumeForm.jsx). Without
// this, the chip falls back straight to their email, which is what was
// showing here instead of a name. Google sign-in already populates
// profiles.full_name from the Google account, so this is a no-op fetch for
// those applicants (their own full_name already wins in the name= line
// below) — only costs a query for the email/password + no-resume-yet case.
function useApplicantResumeName(profile) {
  const [resumeName, setResumeName] = useState(null);
  useEffect(() => {
    if (profile?.role !== 'applicant') return;
    let cancelled = false;
    getMyResume(profile.id).then(({ data }) => {
      if (!cancelled && data?.full_name) setResumeName(data.full_name);
    });
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);
  return resumeName;
}

// Signed-in indicator — an avatar-initial chip + icon-only sign-out button,
// sitting inside the header pill itself (via the `accessory` slot) rather
// than as a separate plain-text row floating underneath it.
function AccountChip({ profile, onSignOut }) {
  const resumeName = useApplicantResumeName(profile);
  const name = profile.full_name || resumeName || profile.email || 'Account';
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div className="app-header-chip" style={{
      display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-card)',
      borderRadius: 999, padding: '5px 6px 5px 5px', boxShadow: 'var(--shadow-hairline)',
    }}>
      <div className="app-header-chip-avatar" style={{
        width: 28, height: 28, borderRadius: '50%', background: 'var(--action-primary-bg)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--text-xs)', flexShrink: 0,
      }}>
        {initial}
      </div>
      <span className="account-chip-name" style={{
        fontSize: 'var(--text-xs)', fontWeight: 600, maxWidth: 140, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)',
      }}>
        {name}
      </span>
      <button
        onClick={onSignOut}
        title="Sign Out"
        aria-label="Sign Out"
        className="app-header-chip-signout"
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
  const resolvedAccessory = accessory ?? (profile ? (
    <div className="app-header-accessory" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {profile.role === 'applicant' && <NotificationBell applicantId={profile.id} nav={nav} />}
      <AccountChip profile={profile} onSignOut={handleSignOut} />
    </div>
  ) : null);

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
      // backdropFilter above makes this element its own stacking context —
      // without an explicit z-index here (position:relative alone isn't
      // enough once a later sibling like a page's <section> exists), the
      // notification/account dropdowns nested inside can end up painted
      // *under* normal page content that just happens to come later in the
      // DOM, despite their own z-index being high.
      // backdropFilter above makes this element its own stacking context —
      // without an explicit z-index here (position:relative alone isn't
      // enough once a later sibling like a page's <section> exists), the
      // notification/account dropdowns nested inside can end up painted
      // *under* normal page content that just happens to come later in the
      // DOM, despite their own z-index being high.
      position: 'relative',
      zIndex: 40,
    }}>
      <button
        type="button"
        className="app-header-logo"
        onClick={onLogoClick || (() => { window.location.href = '/'; })}
        aria-label="Victory Liner Careers — go to homepage"
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-display)',
          border: 'none', background: 'transparent', padding: 0, font: 'inherit', minWidth: 0, overflow: 'hidden',
        }}
      >
        <span className="app-header-logo-main" style={{ fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--action-primary-bg)', whiteSpace: 'nowrap' }}>Victory Liner</span>
        <span className="app-header-logo-badge" style={{ fontWeight: 600, fontSize: 'var(--text-xs)', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Careers</span>
      </button>

      {/* Desktop — hidden below 640px via the .app-header-nav media rule.
          Theme toggle, notification bell, and the account chip are grouped
          tightly together (their own small gap, set off by a divider) —
          they used to just be three more items in the same evenly-spaced
          row as the nav links, so with a long link list the toggle ended up
          sitting alone between two equal-width gaps with nothing visually
          tying it to the account controls right next to it. Now they read
          as one "your account" cluster instead of loose scattered icons. */}
      <nav className="app-header-nav" style={{ display: 'flex', alignItems: 'center', gap: 32, fontFamily: 'var(--font-ui)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>
        {resolvedLinks.map((l) => <NavLink key={typeof l === 'string' ? l : l.label} l={l} />)}
        <span className="app-header-divider" style={{ width: 1, height: 26, background: 'var(--border-hairline)', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <ThemeToggle />
          {resolvedAccessory}
        </div>
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
          className="app-header-icon-btn"
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
