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

// Which labeled column each link falls under — every real caller uses
// DEFAULT_LINKS unchanged (checked: nothing in the app passes a custom
// `links` prop), so this stays in sync automatically. Anything with a key
// this map doesn't recognize still renders, just under a generic "Links"
// column instead of disappearing, so a future custom `links` array
// wouldn't silently lose entries.
const LINK_GROUP = {
  openRoles: 'explore',
  faq: 'explore',
  privacyPolicy: 'legal',
  termsOfService: 'legal',
};

function linkTarget(key, nav) {
  if (!nav) return null;
  if (key === 'openRoles') return () => nav('filter');
  if (key === 'faq') return () => nav('faq');
  if (key === 'privacyPolicy') return () => nav('privacy');
  if (key === 'termsOfService') return () => nav('terms');
  return null;
}

const PIN_ICON = (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);

function FooterLink({ label, onClick }) {
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick?.(); }}
      className="app-footer-link"
      style={{ color: 'var(--text-onfooter-muted)', textDecoration: 'none', cursor: onClick ? 'pointer' : 'default', fontSize: 'var(--text-sm)' }}
    >
      {label}
    </a>
  );
}

function FooterColumn({ eyebrow, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 120 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-accent)' }}>{eyebrow}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

export function Footer({ links = DEFAULT_LINKS, nav }) {
  const grouped = { explore: [], legal: [], other: [] };
  for (const l of links) {
    const key = typeof l === 'string' ? l : l.key;
    const label = typeof l === 'string' ? l : l.label;
    const group = LINK_GROUP[key] || 'other';
    grouped[group].push({ key, label, onClick: linkTarget(key, nav) });
  }

  return (
    <footer className="app-footer" style={{ background: 'var(--surface-footer)', boxSizing: 'border-box', fontFamily: 'var(--font-display)', color: 'var(--text-onfooter)' }}>
      <div className="app-footer-inner" style={{ padding: '44px 124px 0', boxSizing: 'border-box' }}>
        {/* A plain link list read as an afterthought at the bottom of a long
            page — this gives the footer an actual reason to be looked at
            (a second, standing "apply now" moment), not just legal
            boilerplate and a copyright line. */}
        <div className="app-footer-cta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap', paddingBottom: 36, borderBottom: '1px solid rgba(255,255,255,0.14)', marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Ready to drive your career forward?</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-onfooter-muted)', marginTop: 6, fontFamily: 'var(--font-ui)' }}>Browse open roles and apply 100% online, anytime.</div>
          </div>
          <button
            onClick={() => nav?.('filter')}
            className="btn-animate"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'var(--action-primary-bg)', color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            Browse Open Roles &rarr;
          </button>
        </div>

        <div className="app-footer-columns" style={{ display: 'flex', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap', paddingBottom: 36, fontFamily: 'var(--font-ui)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-display)' }}>
              <span style={{ fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--text-onfooter)' }}>Victory Liner</span>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-accent)' }}>Careers</span>
            </div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 200, color: 'var(--text-onfooter-muted)' }}>
              Building careers, moving the Philippines forward.
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--text-onfooter-muted)', marginTop: 4 }}>
              <span style={{ marginTop: 2, flexShrink: 0 }}>{PIN_ICON}</span>
              683 Epifanio de los Santos Ave, Cubao, Quezon City, Metro Manila
            </div>
          </div>

          {grouped.explore.length > 0 && (
            <FooterColumn eyebrow="Explore">
              {grouped.explore.map((l) => <FooterLink key={l.key} label={l.label} onClick={l.onClick} />)}
            </FooterColumn>
          )}
          {grouped.legal.length > 0 && (
            <FooterColumn eyebrow="Legal">
              {grouped.legal.map((l) => <FooterLink key={l.key} label={l.label} onClick={l.onClick} />)}
            </FooterColumn>
          )}
          {grouped.other.length > 0 && (
            <FooterColumn eyebrow="Links">
              {grouped.other.map((l) => <FooterLink key={l.key} label={l.label} onClick={l.onClick} />)}
            </FooterColumn>
          )}

          <FooterColumn eyebrow="Connect">
            <div style={{ display: 'flex', gap: 12 }}>
              {/* Placeholder handle — swap for the real official Facebook page before launch. */}
              <SocialIcon icon="facebook" href="https://www.facebook.com/VictoryLinerInc" />
              <SocialIcon icon="website" href="https://www.victoryliner.com" />
            </div>
          </FooterColumn>
        </div>
      </div>

      <div className="app-footer-bottom" style={{ borderTop: '0.5px solid rgba(255,255,255,0.2)', padding: '20px 124px', boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', fontWeight: 200, color: 'var(--text-onfooter-muted)' }}>
        © 2026 Victory Liner Careers. All rights reserved.
      </div>
    </footer>
  );
}
export default Footer;
