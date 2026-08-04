// figma reference: "footer" dark navy footer, present on every frame
import React from 'react';
import { SocialIcon } from '../../feedback/SocialIcon/SocialIcon.jsx';
export function Footer({ logo = './assets/logo.png', links = ['Search & Apply', 'Our Story', 'Terms and Conditions', 'Contact Us'], onHrLogin }) {
  return (
    <footer style={{ background: 'var(--surface-footer)', padding: '52px 124px', boxSizing: 'border-box', fontFamily: 'var(--font-display)', color: 'var(--text-onfooter)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
        <img src={logo} alt="Victory Liner" style={{ height: 56, filter: 'brightness(0) invert(1)' }} />
        <nav style={{ display: 'flex', gap: 40, fontSize: 'var(--text-lg)', fontWeight: 200 }}>
          {links.map((l) => <a key={l} href="#" style={{ color: 'var(--text-onfooter)', textDecoration: 'none' }}>{l}</a>)}
        </nav>
        <div style={{ display: 'flex', gap: 12 }}>
          <SocialIcon icon="facebook" />
          <SocialIcon icon="twitter" />
        </div>
      </div>
      <div style={{ marginTop: 40, fontSize: 'var(--text-base)', fontWeight: 200, color: 'var(--text-onfooter-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>683 Epifanio de los Santos Ave, Cubao, Quezon City, Metro Manila</span>
        <span>© 2026 Victory Liner Inc.</span>
        {onHrLogin && (
          <a href="#" onClick={(e) => { e.preventDefault(); onHrLogin(); }} style={{ color: 'var(--text-onfooter-muted)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
            HR Login
          </a>
        )}
      </div>
    </footer>
  );
}
export default Footer;
