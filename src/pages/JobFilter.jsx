// Careers job-search results — recreation of the Figma "Job filter" frame
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { JobCard } from '../components/cards/JobCard/JobCard.jsx';
import { Pagination } from '../components/navigation/Pagination/Pagination.jsx';
import { listPublishedJobs } from '../lib/jobs.js';
import logo from '../assets/logo.png';
import searchIconFilled from '../assets/search-icon-filled.svg';

export function JobFilter({ nav }) {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    listPublishedJobs().then(({ data }) => setJobs(data));
  }, []);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header logo={logo} /></div>
      <section style={{ maxWidth: 1066, margin: '60px auto 0', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, fontFamily: 'var(--font-display)', marginBottom: 30 }}>
          <h1 style={{ fontWeight: 600, fontSize: 'var(--text-6xl)', margin: 0 }}>Search Result</h1>
          <span style={{ fontWeight: 400, fontSize: 'var(--text-5xl)' }}>({jobs.length} jobs available)</span>
        </div>
        <div style={{ background: 'var(--surface-search)', borderRadius: 'var(--radius-2xl)', height: 94, display: 'flex', alignItems: 'center', padding: '0 40px', boxShadow: 'var(--shadow-search-inset)', marginBottom: 40 }}>
          <span style={{ color: 'var(--text-placeholder)', fontSize: 'var(--text-2xl)', fontWeight: 200, flex: 1 }}>Search job title or keyword</span>
          <img src={searchIconFilled} alt="" style={{ width: 28, opacity: 0.7 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {jobs.map((j) => (
            <JobCard key={j.id} title={j.title} category={j.category} description={j.description} openPositions={j.open_positions} onApply={() => nav('details', j)} />
          ))}
        </div>
        <div style={{ margin: '30px 0', fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>Showing {jobs.length} of {jobs.length} results</div>
        <div style={{ marginBottom: 60 }}><Pagination page={1} pageCount={1} /></div>
      </section>
      <Footer logo={logo} />
    </div>
  );
}
export default JobFilter;
