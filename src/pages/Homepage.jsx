// Careers homepage — recreation of the Figma "homepage" frame (shows the 4 most recently published jobs)
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { JobCard } from '../components/cards/JobCard/JobCard.jsx';
import { Pagination } from '../components/navigation/Pagination/Pagination.jsx';
import { listPublishedJobs } from '../lib/jobs.js';
import logo from '../assets/logo.png';
import heroBase from '../assets/hero-bus-base.jpg';
import heroHeadline from '../assets/hero-bus-2.png';
import heroStaff from '../assets/hero-bus-1.png';
import searchIconOutline from '../assets/search-icon-outline.svg';

const TERMINAL_ADDRESS = '683 Epifanio de los Santos Ave, Cubao, Quezon City, Metro Manila, Philippines';
const MAP_EMBED_SRC = `https://maps.google.com/maps?q=${encodeURIComponent(TERMINAL_ADDRESS)}&output=embed`;

export function Homepage({ nav }) {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    listPublishedJobs().then(({ data }) => setJobs(data.slice(0, 4)));
  }, []);

  return (
    <div style={{ background: 'var(--surface-page-alt)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}>
        <Header logo={logo} links={['Search & Apply', 'About Us', 'Contact Us']} />
      </div>
      <div style={{ position: 'relative', height: 560, marginTop: 40, overflow: 'hidden', background: 'var(--gray-100)' }}>
        <img src={heroBase} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
        <img src={heroHeadline} alt="Join our Victory Liner team" style={{ position: 'absolute', left: 60, top: 90, width: 480 }} />
        <img src={heroStaff} alt="Victory Liner captain and flight attendant" style={{ position: 'absolute', right: 60, bottom: 0, height: '100%', objectFit: 'contain' }} />
        <div style={{ position: 'absolute', left: 60, top: 340, width: 480 }}>
          <div style={{ background: 'var(--surface-search)', borderRadius: 'var(--radius-2xl)', height: 72, display: 'flex', alignItems: 'center', padding: '0 28px', boxShadow: 'var(--shadow-hairline)' }}>
            <span style={{ color: 'var(--text-placeholder)', fontSize: 'var(--text-l)', fontWeight: 150, flex: 1 }}>Search job title or keyword</span>
            <img src={searchIconOutline} alt="" style={{ width: 26, opacity: 0.7 }} />
          </div>
        </div>
      </div>
      <section style={{ maxWidth: 1066, margin: '60px auto 0', padding: '0 20px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 200, fontSize: 'var(--text-3xl)', textTransform: 'uppercase', color: 'var(--ink-150)', marginBottom: 8 }}>Featured Opportunities</div>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 'var(--text-5xl)', margin: '0 0 30px' }}>Shape Your Future with Us</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {jobs.map((j) => (
            <JobCard key={j.id} title={j.title} category={j.category} description={j.description} openPositions={j.open_positions} onApply={() => nav('details', j)} />
          ))}
        </div>
        <div style={{ marginTop: 30 }}><Pagination page={1} pageCount={10} onChange={() => nav('filter')} /></div>
      </section>
      <section style={{ maxWidth: 1066, margin: '80px auto', padding: '0 20px' }}>
        <div style={{ position: 'relative', width: '100%', height: 360, borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <iframe
            title="Victory Liner Cubao Terminal location"
            src={MAP_EMBED_SRC}
            width="100%"
            height="100%"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
      <Footer logo={logo} onHrLogin={() => nav('hr-login')} />
    </div>
  );
}
export default Homepage;
