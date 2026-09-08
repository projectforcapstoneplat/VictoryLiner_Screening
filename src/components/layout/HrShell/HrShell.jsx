// Shared admin shell for every HR-authenticated screen — a persistent
// sidebar + branded top bar, replacing the public site's floating-pill
// header on this side of the app so it reads as its own admin product
// ("HR Command Center") rather than a restyled public page.
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../lib/ThemeContext.jsx';
import { signOut } from '../../../lib/auth.js';
import { searchHr } from '../../../lib/hrSearch.js';

const ICONS = {
  dashboard: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="14" width="8" height="7" rx="1.5" />
    </svg>
  ),
  briefcase: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  question: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.6-2.2 1.8-2.3 3.3" /><circle cx="12" cy="16.3" r="0.15" fill="currentColor" />
    </svg>
  ),
  users: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 4.7a3.5 3.5 0 0 1 0 6.6" /><path d="M20 20a6.5 6.5 0 0 0-4-6" />
    </svg>
  ),
  applicantList: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="3" /><path d="M3 20a5 5 0 0 1 10 0" />
      <path d="M15 8h6M15 12h6M15 16h4" />
    </svg>
  ),
  bell: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  search: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  headset: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13.5a9 9 0 0 1 18 0" />
      <path d="M21 14.5a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3zM3 14.5a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H3z" />
    </svg>
  ),
  chevron: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  hamburger: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  ),
  sun: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { key: 'hr-dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['hr_personnel', 'hr_head'] },
  { key: 'hr-jobs', label: 'Job Openings', icon: 'briefcase', roles: ['hr_personnel', 'hr_head'] },
  { key: 'hr-applicant-list', label: 'Applicants', icon: 'applicantList', roles: ['hr_personnel', 'hr_head'] },
  { key: 'interview-questions', label: 'Interview Questions', icon: 'question', roles: ['hr_personnel', 'hr_head'] },
  { key: 'hr-accounts', label: 'HR Personnel', icon: 'users', roles: ['hr_head'] },
];

function ChromeThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.16)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      {ICONS[isDark ? 'sun' : 'moon']}
    </button>
  );
}

function SearchBox({ nav }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setResults(null); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const timeout = setTimeout(() => {
      searchHr(query).then(({ data }) => setResults(data));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const goToJob = (job) => { setQuery(''); setResults(null); nav('hr-applicant-list', job); };
  const goToApplicant = (app) => { setQuery(''); setResults(null); if (app.job_postings) nav('hr-applicant-list', app.job_postings); };

  const hasResults = results && (results.jobs.length > 0 || results.applicants.length > 0);

  return (
    <div ref={boxRef} style={{ position: 'relative', width: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.16)', borderRadius: 999, padding: '0 14px', height: 36 }}>
        <span style={{ color: 'rgba(255,255,255,0.8)', display: 'flex' }}>{ICONS.search}</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by applicant name or job title…"
          title="Search by applicant name or job title"
          className="hr-search-input"
          style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, color: '#fff', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)' }}
        />
      </div>
      {results && (
        <div style={{
          position: 'absolute', top: 44, left: 0, right: 0, background: 'var(--surface-card)', borderRadius: 12,
          boxShadow: '0 12px 28px rgba(0,0,0,0.22)', padding: 8, zIndex: 60, maxHeight: 320, overflowY: 'auto',
        }}>
          {!hasResults ? (
            <div style={{ padding: '10px 12px', fontSize: 'var(--text-xs)', opacity: 0.6 }}>No matches for &ldquo;{query}&rdquo;.</div>
          ) : (
            <>
              {results.jobs.map((j) => (
                <div key={j.id} onClick={() => goToJob(j)} style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  <strong>{j.title}</strong> <span style={{ opacity: 0.6, fontSize: 'var(--text-xs)' }}>· Job Opening</span>
                </div>
              ))}
              {results.applicants.map((a) => (
                <div key={a.id} onClick={() => goToApplicant(a)} style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  {a.full_name} <span style={{ opacity: 0.6, fontSize: 'var(--text-xs)' }}>· Applicant for {a.job_postings?.title}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell({ notifications, nav }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const count = notifications.length;

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const goToCandidate = (n) => {
    setOpen(false);
    if (n.job) nav('hr-applicant-list', n.job);
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.16)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      >
        {ICONS.bell}
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, background: '#fff', color: 'var(--red-700)',
            fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {count}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, width: 300, background: 'var(--surface-card)', borderRadius: 12, boxShadow: '0 12px 28px rgba(0,0,0,0.22)', padding: 10, zIndex: 60, maxHeight: 360, overflowY: 'auto' }}>
          <strong style={{ fontSize: 'var(--text-sm)', display: 'block', padding: '6px 8px 10px' }}>Awaiting your review</strong>
          {count === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', opacity: 0.7, margin: 0, padding: '0 8px 6px' }}>Nothing pending — you're all caught up.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.applicationId}
                onClick={() => goToCandidate(n)}
                style={{ padding: '8px 8px', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{n.name}</span>
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>Ready for decision — {n.job?.title || 'Unknown role'}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

const ROLE_LABEL = { hr_head: 'HR Head', hr_personnel: 'HR Personnel' };

function UserMenu({ profile, nav }) {
  const [open, setOpen] = useState(false);
  // Sends HR staff back to the HR Portal sign-in, not the public marketing
  // site — signing out of an admin panel should stay in the admin world.
  // Still navigates first, *then* signs out: signOut() triggers Supabase's
  // auth listener (which clears `session` in App.jsx) as part of its own
  // async work, potentially before this function's `await` would resolve.
  // Setting `screen` synchronously first avoids a mid-signOut re-render
  // against a stale screen value.
  const handleSignOut = () => { nav('hr-login'); signOut(); };
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', color: 'var(--red-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
          {initials(profile?.full_name || profile?.email)}
        </div>
        <div className="hr-shell-header-label" style={{ textAlign: 'left' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', lineHeight: 1.2 }}>{profile?.full_name || profile?.email}</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, letterSpacing: 0.5 }}>{ROLE_LABEL[profile?.role] || profile?.role}</div>
        </div>
        <span className="hr-shell-header-label" style={{ color: 'rgba(255,255,255,0.8)', display: 'flex' }}>{ICONS.chevron}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 46, right: 0, width: 180, background: 'var(--surface-card)', borderRadius: 12, boxShadow: '0 12px 28px rgba(0,0,0,0.22)', padding: 8, zIndex: 60 }}>
          <button onClick={handleSignOut} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarLink({ item, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 'var(--text-sm)', fontWeight: isActive ? 700 : 500,
        background: isActive ? 'var(--pink-100)' : 'transparent',
        color: isActive ? 'var(--red-700)' : 'var(--text-primary)',
        borderLeft: isActive ? '3px solid var(--action-primary-bg)' : '3px solid transparent',
        opacity: isActive ? 1 : 0.75,
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>{ICONS[item.icon]}</span>
      {item.label}
    </button>
  );
}

export function HrShell({ active, nav, profile, notifications = [], children }) {
  const items = NAV_ITEMS.filter((i) => i.roles.includes(profile?.role));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Closes the mobile drawer on nav — otherwise switching pages via the
  // sidebar left it hanging open over the new screen.
  const go = (key) => { setSidebarOpen(false); nav(key); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-page-alt)', fontFamily: 'var(--font-ui)' }}>
      {sidebarOpen && (
        <div
          className="hr-shell-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 70 }}
        />
      )}
      <aside className={`hr-shell-sidebar${sidebarOpen ? ' hr-shell-sidebar-open' : ''}`} style={{ width: 232, flexShrink: 0, background: 'var(--surface-card)', borderRight: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column' }}>
        <div className="hr-shell-sidebar-close" style={{ display: 'none', justifyContent: 'flex-end', padding: '14px 14px 0' }}>
          <button onClick={() => setSidebarOpen(false)} aria-label="Close menu" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--surface-page-alt)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ICONS.close}
          </button>
        </div>
        <nav style={{ flex: 1, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item) => (
            <SidebarLink key={item.key} item={item} isActive={active === item.key} onClick={() => go(item.key)} />
          ))}
        </nav>
        <div style={{ padding: 14 }}>
          <div style={{ background: 'var(--surface-page-alt)', borderRadius: 12, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: 'var(--action-primary-bg)', display: 'flex' }}>{ICONS.headset}</span>
            <div>
              <strong style={{ fontSize: 'var(--text-sm)' }}>Need Help?</strong>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', opacity: 0.65 }}>Contact your system administrator.</p>
            </div>
            <a href="mailto:hr-admin@victoryliner.example" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--action-primary-bg)', textDecoration: 'none' }}>
              Contact Support →
            </a>
          </div>
          <div style={{ padding: '16px 4px 4px', fontSize: 'var(--text-xs)', opacity: 0.55 }}>
            <strong>Victory Liner Careers</strong>
            <div>Moving People, Changing Lives.</div>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header className="hr-shell-header" style={{
          height: 68, flexShrink: 0, background: 'linear-gradient(90deg, var(--action-primary-bg-strong), var(--action-primary-bg))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', gap: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              className="hr-shell-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              style={{ display: 'none', width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.16)', color: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {ICONS.hamburger}
            </button>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontFamily: 'var(--font-display)', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 'var(--text-md)' }}>Victory Liner</span>
              <span className="hr-shell-header-careers" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Careers</span>
            </div>
            <span className="hr-shell-header-label" style={{ color: 'rgba(255,255,255,0.5)' }}>|</span>
            <span className="hr-shell-header-label" style={{ color: '#fff', fontWeight: 500, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              HR Command Center
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <span className="hr-shell-search">
              <SearchBox nav={nav} />
            </span>
            <ChromeThemeToggle />
            <NotificationBell notifications={notifications} nav={nav} />
            <UserMenu profile={profile} nav={nav} />
          </div>
        </header>
        <main className="hr-shell-main" style={{ flex: 1, padding: '28px 32px 60px', minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
export default HrShell;
