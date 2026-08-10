// Contact Us — carries the terminal address + map that used to live on the
// homepage's "about" section (which is now real About Us content instead),
// plus the channels an applicant would actually use to reach HR.
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';

const TERMINAL_ADDRESS = '683 Epifanio de los Santos Ave, Cubao, Quezon City, Metro Manila, Philippines';
const MAP_EMBED_SRC = `https://maps.google.com/maps?q=${encodeURIComponent(TERMINAL_ADDRESS)}&output=embed`;

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

export function Contact({ nav }) {
  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header nav={nav} /></div>
      <section style={{ maxWidth: 1000, margin: '70px auto 0', padding: '0 20px' }}>
        <div className="fade-in-up" style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 8 }}>Get In Touch</div>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-5xl)', margin: '0 0 12px' }}>Contact Us</h1>
          <p style={{ fontSize: 'var(--text-md)', opacity: 0.7, margin: 0, maxWidth: 560 }}>
            Questions about a role or your application? Reach the Victory Liner HR team through any of the channels below.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 50 }}>
          {CHANNELS.map((c, i) => (
            <Reveal key={c.label} delay={i * 0.1} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
              <strong style={{ fontSize: 'var(--text-sm)', opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 }}>{c.label}</strong>
              <span style={{ fontSize: 'var(--text-md)', lineHeight: 1.5 }}>{c.value}</span>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15} as="h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 20px' }}>Visit Our Terminal</Reveal>
        <Reveal delay={0.2} style={{ position: 'relative', width: '100%', height: 320, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 70 }}>
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
      <Footer nav={nav} />
    </div>
  );
}
export default Contact;
