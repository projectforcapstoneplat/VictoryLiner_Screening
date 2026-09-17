// Contact Us — carries the terminal address + map that used to live on the
// homepage's "about" section (which is now real About Us content instead),
// plus the channels an applicant would actually use to reach HR.
//
// No footer and no page-level scroll, same reasoning as Sign In and the
// resume wizard: reached as a quick lookup from many different places (Sign
// In, Homepage, HR pages — anywhere the shared Header's "Contact Us" link
// appears), so it should read as a self-contained panel you glance at and
// leave, not a full page with its own scroll-to-the-bottom footer. The back
// button returns to wherever it was actually opened from (see App.jsx's
// previousStateRef), not a hardcoded destination — that's the only way "Back"
// is correct regardless of which of those places it was reached from.
import { Header } from '../components/layout/Header/Header.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';

const TERMINAL_ADDRESS = '683 Epifanio de los Santos Ave, Cubao, Quezon City, Metro Manila, Philippines';
const MAP_EMBED_SRC = `https://maps.google.com/maps?q=${encodeURIComponent(TERMINAL_ADDRESS)}&output=embed`;

const ARROW_LEFT_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;

const CHANNELS = [
  {
    label: 'Careers Email', value: 'careers@victoryliner.com',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  },
  {
    label: 'HR Hotline', value: '(02) 8735-8080',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.8 2.2z" /></svg>,
  },
  {
    label: 'Main Terminal', value: TERMINAL_ADDRESS,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  },
];

export function Contact({ nav, backTo }) {
  const handleBack = () => nav(backTo?.screen || 'home', backTo?.job || null);

  return (
    <div style={{ background: 'var(--surface-page)', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', overflow: 'hidden' }}>
      <style>{`
        .contact-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--gray-400) transparent;
        }
        .contact-scroll::-webkit-scrollbar { width: 6px; }
        .contact-scroll::-webkit-scrollbar-track { background: transparent; }
        .contact-scroll::-webkit-scrollbar-thumb { background: var(--gray-400); border-radius: 999px; }
        .contact-scroll::-webkit-scrollbar-thumb:hover { background: var(--gray-500); }
      `}</style>
      <div style={{ padding: '20px 60px 0', flexShrink: 0 }} className="page-header-wrap"><Header nav={nav} /></div>
      <div className="contact-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px 32px' }}>
          <div className="fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <button
              onClick={handleBack}
              className="btn-animate"
              aria-label="Back"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%',
                border: 'none', cursor: 'pointer', background: 'var(--surface-page-alt)', color: 'var(--text-primary)', flexShrink: 0,
              }}
            >
              {ARROW_LEFT_ICON}
            </button>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 4 }}>Get In Touch</div>
              <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: 0 }}>Contact Us</h1>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-md)', opacity: 0.7, margin: '0 0 28px', maxWidth: 560 }}>
            Questions about a role or your application? Reach the Victory Liner HR team through any of the channels below.
          </p>

          <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 36 }}>
            {CHANNELS.map((c, i) => (
              <Reveal key={c.label} delay={i * 0.1} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
                <strong style={{ fontSize: 'var(--text-xs)', opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 }}>{c.label}</strong>
                <span style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{c.value}</span>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15} as="h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-2xl)', margin: '0 0 14px' }}>Visit Our Terminal</Reveal>
          <Reveal delay={0.2} style={{ position: 'relative', width: '100%', height: 260, borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <iframe
              title="Victory Liner Cubao Terminal location"
              src={MAP_EMBED_SRC}
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Reveal>
        </section>
      </div>
    </div>
  );
}
export default Contact;
