// HR — applicants list for a single job posting.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { listApplicationsForJob } from '../lib/applications.js';
import logo from '../assets/logo.png';

function ExperienceList({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Work Experience</strong>
      {items.map((e, i) => (
        <div key={i} style={{ fontSize: 'var(--text-sm)', marginTop: 6 }}>
          <div>{e.position} — {e.company} {e.startDate ? `(${e.startDate} to ${e.endDate || 'present'})` : ''}</div>
          {e.description && <div style={{ opacity: 0.8 }}>{e.description}</div>}
        </div>
      ))}
    </div>
  );
}

function EducationList({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Education</strong>
      {items.map((e, i) => (
        <div key={i} style={{ fontSize: 'var(--text-sm)', marginTop: 6 }}>
          {e.degree} — {e.school} {e.yearGraduated ? `(${e.yearGraduated})` : ''}
        </div>
      ))}
    </div>
  );
}

function CertificationList({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 'var(--text-sm)' }}>Certifications</strong>
      {items.map((c, i) => (
        <div key={i} style={{ fontSize: 'var(--text-sm)', marginTop: 6 }}>
          {c.title} {c.issuer ? `— ${c.issuer}` : ''} {c.year ? `(${c.year})` : ''}
        </div>
      ))}
    </div>
  );
}

export function HrApplicants({ job, nav }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!job?.id) return;
    listApplicationsForJob(job.id).then(({ data }) => {
      setApplications(data);
      setLoading(false);
    });
  }, [job]);

  if (!job) {
    return (
      <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
        <div style={{ padding: '30px 60px 0' }}><Header logo={logo} links={[]} /></div>
        <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
          <p>No job selected.</p>
          <Button variant="ghost" size="sm" onClick={() => nav('hr-dashboard')}>Back to Dashboard</Button>
        </section>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header logo={logo} links={[]} /></div>
      <section style={{ maxWidth: 1000, margin: '60px auto', padding: '0 20px' }}>
        <div onClick={() => nav('hr-dashboard')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginBottom: 20 }}>&larr; Back to Dashboard</div>
        <h1 style={{ fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 8px' }}>Applicants — {job.title}</h1>
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginBottom: 30 }}>{applications.length} application{applications.length === 1 ? '' : 's'}</p>
        {loading ? (
          <p>Loading applicants…</p>
        ) : applications.length === 0 ? (
          <p>No applications yet for this job.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {applications.map((a) => (
              <div key={a.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px' }}>
                <strong style={{ fontSize: 'var(--text-lg)' }}>{a.full_name}</strong>
                <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8 }}>{a.email} {a.phone ? `· ${a.phone}` : ''}</div>
                <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>Applied {new Date(a.created_at).toLocaleDateString()}</div>
                {a.skills?.length > 0 && (
                  <div style={{ fontSize: 'var(--text-sm)', marginTop: 12 }}><strong>Skills:</strong> {a.skills.join(', ')}</div>
                )}
                <ExperienceList items={a.work_experience} />
                <EducationList items={a.education} />
                <CertificationList items={a.certifications} />
                {a.cover_note && (
                  <div style={{ marginTop: 12 }}>
                    <strong style={{ fontSize: 'var(--text-sm)' }}>Cover Note</strong>
                    <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, marginTop: 6 }}>{a.cover_note}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
export default HrApplicants;