// HR dashboard — list job postings, manage their status, jump to create/edit.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { signOut } from '../lib/auth.js';
import { listAllJobs, deleteJob, setJobStatus } from '../lib/jobs.js';
import logo from '../assets/logo.png';

const STATUS_LABEL = { draft: 'Draft', published: 'Published', closed: 'Closed' };

export function HrDashboard({ nav, profile }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    listAllJobs().then(({ data }) => {
      setJobs(data);
      setLoading(false);
    });
  };

  useEffect(reload, []);

  const handleSignOut = async () => {
    await signOut();
    nav('home');
  };

  const handleDelete = async (job) => {
    if (!window.confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    await deleteJob(job.id);
    reload();
  };

  const handleStatus = async (job, status) => {
    await setJobStatus(job.id, status);
    reload();
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header logo={logo} links={[]} /></div>
      <section style={{ maxWidth: 1066, margin: '60px auto 0', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h1 style={{ fontWeight: 600, fontSize: 'var(--text-4xl)', margin: 0 }}>HR Dashboard</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)' }}>{profile?.full_name || profile?.email} ({profile?.role})</span>
            {profile?.role === 'hr_head' && (
              <Button variant="ghost" size="sm" onClick={() => nav('hr-accounts')}>Manage HR Personnel</Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '20px 0' }}>
          <Button variant="strong" size="sm" onClick={() => nav('hr-job-form', null)}>+ New Job Posting</Button>
        </div>
        {loading ? (
          <p>Loading job postings…</p>
        ) : jobs.length === 0 ? (
          <p>No job postings yet. Create one to get started.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {jobs.map((j) => (
              <div key={j.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
                <div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 'var(--text-lg)' }}>{j.title}</strong>
                    <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--text-primary)', opacity: 0.7 }}>{STATUS_LABEL[j.status]}</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8 }}>{j.category} · {j.open_positions} open position{j.open_positions === 1 ? '' : 's'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="ghost" size="sm" onClick={() => nav('hr-applicants', j)}>View Applicants</Button>
                  <Button variant="ghost" size="sm" onClick={() => nav('hr-job-form', j)}>Edit</Button>
                  {j.status !== 'published' && <Button variant="ghost" size="sm" onClick={() => handleStatus(j, 'published')}>Publish</Button>}
                  {j.status === 'published' && <Button variant="ghost" size="sm" onClick={() => handleStatus(j, 'closed')}>Close</Button>}
                  {j.status === 'closed' && <Button variant="ghost" size="sm" onClick={() => handleStatus(j, 'draft')}>Reopen as Draft</Button>}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(j)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
export default HrDashboard;
