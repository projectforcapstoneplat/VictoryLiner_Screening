// figma reference: "footer" dark navy footer, present on every frame
import React from 'react';
import { SocialIcon } from '../../feedback/SocialIcon/SocialIcon.jsx';

// Keyed (not label-matched) so each entry's destination is explicit and
// doesn't depend on the label text staying exactly in sync.
const DEFAULT_LINKS = [
  { key: 'openRoles', label: 'Open Roles' },
  { key: 'faq', label: 'FAQ' },
  { key: 'privacyPolicy', label: 'Privacy Policy' },
  { key: 'termsOfService', label: 'Terms of Service' },
];

function linkTarget(key, nav) {
  if (!nav) return null;
  if (key === 'openRoles') return () => nav('filter');
  if (key === 'faq') return () => nav('faq');
  if (key === 'privacyPolicy') return () => nav('privacy');
  if (key === 'termsOfService') return () => nav('terms');
  return null;
}

export function Footer({ links = DEFAULT_LINKS, nav }) {
  return (
    <footer className="app-footer" style={{ background: 'var(--surface-footer)', padding: '52px 124px', boxSizing: 'border-box', fontFamily: 'var(--font-display)', color: 'var(--text-onfooter)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--text-onfooter)' }}>Victory Liner</span>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-accent)' }}>Careers</span>
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 200, color: 'var(--text-onfooter-muted)', maxWidth: 260 }}>
            Building careers, moving the Philippines forward.
          </span>
        </div>
        <nav style={{ display: 'flex', gap: 40, fontSize: 'var(--text-lg)', fontWeight: 200 }}>
          {links.map((l) => {
            const key = typeof l === 'string' ? l : l.key;
            const label = typeof l === 'string' ? l : l.label;
            const onNav = linkTarget(key, nav);
            return (
              <a
                key={key}
                href="#"
                onClick={(e) => { e.preventDefault(); onNav?.(); }}
                style={{ color: 'var(--text-onfooter)', textDecoration: 'none', cursor: onNav ? 'pointer' : 'default' }}
              >
                {label}
              </a>
            );
          })}
        </nav>
        {/* Placeholder handle — swap for the real official Facebook page before launch. */}
        <div style={{ display: 'flex', gap: 12 }}>
          <SocialIcon icon="facebook" href="https://www.facebook.com/VictoryLinerInc" />
          <SocialIcon icon="website" href="https://www.victoryliner.com" />
        </div>
      </div>
      <div style={{ marginTop: 40, paddingTop: 24, borderTop: '0.5px solid rgba(255,255,255,0.2)', fontSize: 'var(--text-base)', fontWeight: 200, color: 'var(--text-onfooter-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>683 Epifanio de los Santos Ave, Cubao, Quezon City, Metro Manila</span>
        <span>© 2026 Victory Liner Careers. All rights reserved.</span>
      </div>
    </footer>
  );
}
export default Footer;
