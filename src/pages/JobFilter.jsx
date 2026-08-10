// Careers job-search results — full listing with live search, category
// filtering, and real pagination (the original was a static, non-functional
// mockup: search box had no input, category had no filter, and pagination
// was hardcoded to page=1/pageCount=1 regardless of actual job count).
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Pagination } from '../components/navigation/Pagination/Pagination.jsx';
import { CategoryIcon } from '../components/icons/CategoryIcon.jsx';
import { JOB_CATEGORIES } from '../lib/jobCategories.js';
import { listPublishedJobs } from '../lib/jobs.js';
import { deadlineInfo } from '../lib/deadline.js';
import searchIconOutline from '../assets/search-icon-outline.svg';

const PER_PAGE = 6;
const ALL_CATEGORIES = 'All Categories';

function CategoryChip({ category, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-animate"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 6px', borderRadius: 999,
        border: active ? 'none' : '1px solid var(--border-hairline)',
        background: active ? 'var(--action-primary-bg)' : 'var(--surface-card)',
        color: active ? '#fff' : 'var(--text-primary)',
        fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', fontWeight: active ? 700 : 400,
        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        transition: 'background 0.18s ease, color 0.18s ease, border-color 0.18s ease',
      }}
    >
      {category !== ALL_CATEGORIES && <CategoryIcon category={category} style={{ width: 24, height: 24, background: active ? 'rgba(255,255,255,0.25)' : 'var(--pink-100)' }} />}
      {category}
    </button>
  );
}

function JobResultCard({ index, job, onView, onApply }) {
  const deadline = deadlineInfo(job.application_deadline);
  return (
    <div
      className="hover-lift fade-in-up"
      style={{
        animationDelay: `${Math.min(index, 5) * 0.08}s`,
        background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)',
        padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16, cursor: 'pointer',
      }}
      onClick={onView}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CategoryIcon category={job.category} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>{job.title}</div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65, marginTop: 4 }}>
              {[job.category, job.location, job.employment_type].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        {job.employment_type && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '5px 14px', borderRadius: 999, background: 'var(--pink-100)', color: 'var(--red-700)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {job.employment_type}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', opacity: 0.85, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {job.description}
      </p>
      <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', opacity: 0.75 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ca30c' }} />
            {job.open_positions} Open Position{job.open_positions === 1 ? '' : 's'}
          </span>
          {deadline && (
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: deadline.urgent ? 700 : 400, color: deadline.closed ? 'var(--text-primary)' : deadline.urgent ? 'var(--red-700)' : 'var(--text-primary)', opacity: deadline.closed ? 0.6 : deadline.urgent ? 1 : 0.75 }}>
              {deadline.label}
            </span>
          )}
        </div>
        <Button variant="strong" size="sm" disabled={deadline?.closed} onClick={(e) => { e.stopPropagation(); if (!deadline?.closed) onApply(); }} style={deadline?.closed ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
          {deadline?.closed ? 'Closed' : 'Apply Now'}
        </Button>
      </div>
    </div>
  );
}

function SkeletonCard({ index }) {
  return (
    <div className="fade-in-up" style={{ animationDelay: `${index * 0.06}s`, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="loading-pulse" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-page-alt)', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="loading-pulse" style={{ width: '40%', height: 16, borderRadius: 4, background: 'var(--surface-page-alt)', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
          <div className="loading-pulse" style={{ width: '60%', height: 12, borderRadius: 4, background: 'var(--surface-page-alt)', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        </div>
      </div>
      <div className="loading-pulse" style={{ width: '100%', height: 12, borderRadius: 4, background: 'var(--surface-page-alt)', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
      <div className="loading-pulse" style={{ width: '85%', height: 12, borderRadius: 4, background: 'var(--surface-page-alt)', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
    </div>
  );
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="fade-in-up" style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ width: 64, height: 64, margin: '0 auto 20px', borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)' }}>No matching positions</h3>
      <p style={{ margin: '0 0 20px', fontSize: 'var(--text-sm)', opacity: 0.7 }}>
        {hasFilters ? "Try a different keyword or category — or clear your filters to see everything we're hiring for." : "There are no open positions right now. Check back soon."}
      </p>
      {hasFilters && <Button variant="ghost" size="sm" onClick={onClear}>Clear Filters</Button>}
    </div>
  );
}

export function JobFilter({ nav }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);

  useEffect(() => {
    listPublishedJobs().then(({ data }) => {
      setJobs(data);
      setLoading(false);
    });
  }, []);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      const matchesSearch = !q || j.title.toLowerCase().includes(q) || j.category?.toLowerCase().includes(q);
      const matchesCategory = category === ALL_CATEGORIES || j.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [jobs, search, category]);

  // Any change to search/category invalidates the current page — reset so
  // the user never lands on an out-of-range empty page.
  useEffect(() => { setPage(1); }, [search, category]);

  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pagedJobs = filteredJobs.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const hasFilters = search.trim().length > 0 || category !== ALL_CATEGORIES;

  const clearFilters = () => {
    setSearch('');
    setCategory(ALL_CATEGORIES);
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header nav={nav} /></div>
      <section style={{ maxWidth: 1066, margin: '60px auto 0', padding: '0 20px' }}>
        <div className="fade-in-up">
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 8 }}>
            Careers at Victory Liner
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, fontFamily: 'var(--font-display)', flexWrap: 'wrap', marginBottom: 8 }}>
            <h1 style={{ fontWeight: 700, fontSize: 'var(--text-6xl)', margin: 0 }}>Search Results</h1>
            <span style={{ fontWeight: 400, fontSize: 'var(--text-2xl)', opacity: 0.6 }}>
              ({filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'} available)
            </span>
          </div>
          <p style={{ margin: '0 0 32px', fontSize: 'var(--text-md)', opacity: 0.7 }}>Find a role that fits your skills and start your application today.</p>
        </div>

        <div className="fade-in-up" style={{ animationDelay: '0.08s', background: 'var(--surface-search)', borderRadius: 'var(--radius-2xl)', height: 64, display: 'flex', alignItems: 'center', padding: '0 28px', boxShadow: 'var(--shadow-search-inset)', marginBottom: 20 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job title or keyword"
            style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)' }}
          />
          <img src={searchIconOutline} alt="" style={{ width: 22, opacity: 0.6 }} />
        </div>

        <div className="fade-in-up" style={{ animationDelay: '0.14s', display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 30 }}>
          <CategoryChip category={ALL_CATEGORIES} active={category === ALL_CATEGORIES} onClick={() => setCategory(ALL_CATEGORIES)} />
          {JOB_CATEGORIES.map((c) => (
            <CategoryChip key={c} category={c} active={category === c} onClick={() => setCategory(c)} />
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[0, 1, 2].map((i) => <SkeletonCard key={i} index={i} />)}
          </div>
        ) : pagedJobs.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {pagedJobs.map((j, i) => (
              <JobResultCard key={j.id} index={i} job={j} onView={() => nav('details', j)} onApply={() => nav('signin', j)} />
            ))}
          </div>
        )}

        <div style={{ margin: '30px 0', fontSize: 'var(--text-base)', color: 'var(--text-primary)', opacity: 0.75 }}>
          {loading ? 'Loading…' : `Showing ${pagedJobs.length} of ${filteredJobs.length} result${filteredJobs.length === 1 ? '' : 's'}`}
        </div>
        {!loading && <div style={{ marginBottom: 60 }}><Pagination page={currentPage} pageCount={pageCount} onChange={setPage} /></div>}
      </section>
      <Footer nav={nav} />
    </div>
  );
}
export default JobFilter;
