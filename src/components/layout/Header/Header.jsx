// figma reference: "header" glass pill nav, present on every frame
import React from 'react';
export function Header({ links = ['Contact Us', 'About Us'], logo = './assets/logo.png' }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      height: 86, padding: '0 40px', borderRadius: 'var(--radius-md)',
      background: 'rgba(255,255,255,0.7)', boxShadow: 'var(--shadow-glass-header)', boxSizing: 'border-box',
    }}>
      <img src={logo} alt="Victory Liner" onClick={() => window.location.href = '/'} style={{cursor:"pointer", height: 45 }} />
      <nav style={{ display: 'flex', gap: 40, fontFamily: 'var(--font-ui)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>
        {links.map((l) => <a key={l} href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{l}</a>)}
      </nav>
    </header>
  );
}
export default Header;
