// Applicant — list of the jobs they've applied to, with a way to start
// (or resume) each one's video interview, and a plain-language status per
// application (in-app only — no email/SMS yet, see project notes).
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { listApplicationsForApplicant } from '../lib/applications.js';
import { getInterviewCompletionMap } from '../lib/interview.js';

// HR's decision (`status` column) always wins. Short of a decision, the
// applicant's own next action — finish the video interview — is more useful
// to show than a generic "submitted", since that's the one thing blocking
// them from moving forward.
function getStatusInfo(application, completion) {
  if (application.status === 'declined') {
    return { label: 'Not Selected', bg: 'var(--surface-page-alt)', fg: 'var(--gray-600)' };
  }
  if (application.status === 'advanced') {
    return { label: 'Advanced to Next Step', bg: '#e3f6e6', fg: '#0ca30c' };
  }
  // Decision not made yet — still worth letting them revisit the interview
  // (to finish it, or re-record before HR reviews it).
  const interviewComplete = completion && completion.total > 0 && completion.answered === completion.total;
  if (!interviewComplete) {
    return { label: 'Action Needed — Complete Video Interview', bg: 'var(--pink-100)', fg: 'var(--red-700)', interviewCta: 'Continue to Video Interview' };
  }
  return { label: 'Under Review', bg: 'var(--pink-100)', fg: 'var(--red-700)', interviewCta: 'Review Video Interview' };
}

export function MyApplications({ profile, nav }) {
  const [applications, setApplications] = useState([]);
  const [completionMap, setCompletionMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    listApplicationsForApplicant(profile.id).then(({ data }) => {
      setApplications(data);
      getInterviewCompletionMap(data.map((a) => a.id)).then(({ data: map }) => {
        setCompletionMap(map || {});
        setLoading(false);
      });
    });
  }, [profile]);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
        <h1 style={{ fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 8px' }}>My Applications</h1>
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginBottom: 30 }}>Track your submitted applications and complete your video interview here.</p>
        {loading ? (
          <p>Loading…</p>
        ) : applications.length === 0 ? (
          <>
            <p>You haven't applied to any jobs yet.</p>
            <Button variant="ghost" size="sm" onClick={() => nav('filter')}>Browse Openings</Button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {applications.map((a) => {
              const status = getStatusInfo(a, completionMap[a.id]);
              return (
                <div key={a.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 'var(--text-lg)' }}>{a.job_postings?.title || 'Job posting'}</strong>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>
                        {status.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginTop: 6 }}>{a.job_postings?.category}</div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>Applied {new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                  {status.interviewCta && (
                    <Button variant="strong" size="sm" onClick={() => nav('interview', a)}>{status.interviewCta}</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
export default MyApplications;
