// "Job Openings" — list job postings, manage their status, jump to create/edit.
import { useEffect, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { listAllJobs, deleteJob, setJobStatus } from '../lib/jobs.js';

const STATUS_META = {
  draft: { label: 'Draft', color: 'var(--gray-500)' },
  published: { label: 'Published', color: '#0ca30c' },
  closed: { label: 'Closed', color: 'var(--red-700)' },
};

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
    <HrShell active="hr-jobs" nav={nav} profile={profile}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Job Openings</h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>Create, publish, and manage every posting.</p>
          </div>
          <Button variant="strong" size="sm" onClick={() => nav('hr-job-form', null)}>+ New Job Posting</Button>
        </div>

        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading job postings…</p>
        ) : jobs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No job postings yet. Create one to get started.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {jobs.map((j) => {
              const meta = STATUS_META[j.status];
              return (
                <div key={j.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta?.color, flexShrink: 0 }} />
                      <strong style={{ fontSize: 'var(--text-lg)' }}>{j.title}</strong>
                      <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>{meta?.label}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', opacity: 0.75 }}>{j.category} · {j.open_positions} open position{j.open_positions === 1 ? '' : 's'}</div>
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
              );
            })}
          </div>
        )}
      </div>
    </HrShell>
  );
}
export default HrDashboard;
