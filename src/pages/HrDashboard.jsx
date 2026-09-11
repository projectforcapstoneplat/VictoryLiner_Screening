// "Job Openings" — list job postings, filter/search them, manage status,
// jump to create/edit. Every card surfaces the operational details HR
// actually needs at a glance (posted date, applicant count, days left to
// apply) instead of just title + open positions, and the filter bar lets HR
// narrow a long list down instead of scanning every row.
//
// No vanity summary-number row up top on purpose — those already live on
// the real Dashboard (HrPersonnelDashboard.jsx / HrHeadDashboard.jsx);
// repeating them here was redundant. The pink "closing soon" banner stays
// because it's actionable (jumps straight to a filtered view), not just a
// restated count.
import { useEffect, useMemo, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Select } from '../components/core/Select/Select.jsx';
import { listAllJobs, deleteJob, setJobStatus } from '../lib/jobs.js';
import { matchJobToAllResumes } from '../lib/resumeMatches.js';
import { listJobCategories } from '../lib/jobCategories.js';
import { STATIONS } from '../lib/jobConstants.js';
import { deadlineInfo } from '../lib/deadline.js';

const STATUS_META = {
  draft: { label: 'Draft', color: 'var(--gray-500)' },
  published: { label: 'Published', color: '#0ca30c' },
  closed: { label: 'Closed', color: 'var(--red-700)' },
};

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'closed', label: 'Closed' },
];

const ICON_PROPS = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONS = {
  users: <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 4.7a3.5 3.5 0 0 1 0 6.6" /><path d="M20 20a6.5 6.5 0 0 0-4-6" /></svg>,
  pencil: <svg {...ICON_PROPS}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  publish: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M12 16V8M8.5 11.5 12 8l3.5 3.5" /></svg>,
  pause: <svg {...ICON_PROPS}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>,
  reopen: <svg {...ICON_PROPS}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>,
  trash: <svg {...ICON_PROPS}><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></svg>,
  refresh: <svg {...ICON_PROPS}><path d="M17.5 6.5A8 8 0 0 0 4.6 9M4.6 9V4M4.6 9h4.9" /><path d="M6.5 17.5A8 8 0 0 0 19.4 15M19.4 15v5M19.4 15h-4.9" /></svg>,
  plus: <svg {...ICON_PROPS} width={16} height={16}><path d="M12 5v14M5 12h14" /></svg>,
  clearX: <svg {...ICON_PROPS} width={13} height={13}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>,
};

// Tinted pill for a card's main actions — a filled/colored surface, not the
// flat identical outline every button used to share, so View / Edit /
// Publish-or-Close actually read as different weights of importance.
const TONE = {
  neutral: { bg: 'var(--surface-page-alt)', fg: 'var(--text-primary)' },
  primary: { bg: 'var(--pink-100)', fg: 'var(--action-primary-bg)' },
  positive: { bg: '#e3f6e6', fg: '#0ca30c' },
  warning: { bg: '#fff4e0', fg: '#c98500' },
  danger: { bg: '#fdecea', fg: 'var(--red-700)' },
};

function ActionPill({ icon, label, tone = 'neutral', onClick, disabled }) {
  const t = TONE[tone];
  return (
    <button
      className="btn-animate"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999,
        border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700,
        fontFamily: 'inherit', background: t.bg, color: t.fg, opacity: disabled ? 0.55 : 1, whiteSpace: 'nowrap',
      }}
    >
      {icon}{label}
    </button>
  );
}

// Small icon-only, unlabeled circle — visually a step down from ActionPill
// on purpose, for actions that are secondary (a manual fallback, or
// destructive) rather than things HR reaches for as part of the normal flow.
function IconOnly({ icon, title, tone = 'neutral', onClick, disabled }) {
  const t = TONE[tone];
  return (
    <button
      className="btn-animate"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%',
        border: 'none', cursor: disabled ? 'default' : 'pointer', background: t.bg, color: t.fg, opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon}
    </button>
  );
}

function formatPostedDate(iso) {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// The shared deadlineInfo() label ("Apply by...") is worded for applicants
// (JobFilter.jsx / JobDetails.jsx also use it) — HR is managing the
// posting's lifespan, not applying, so the far-out case reads better as
// "Open until". The near-deadline wording ("3 days left", "Closes today")
// still reads fine from HR's side as-is, so only the calm-case label changes.
// Only shown once every open_positions slot has an "advanced" applicant
// sitting in it — the exact "condition of N positions open" flag HR asked
// for, right on the card instead of buried in the applicant list.
function PositionsFilledBadge() {
  return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#e3f6e6', color: '#0ca30c' }}>
      Positions Filled
    </span>
  );
}

function DeadlineBadge({ deadline }) {
  const info = deadlineInfo(deadline);
  if (!info) {
    return <span style={{ fontSize: 'var(--text-xs)', padding: '3px 10px', borderRadius: 999, background: 'var(--surface-page-alt)', opacity: 0.6 }}>No deadline</span>;
  }
  const label = info.closed ? 'Deadline passed' : info.urgent ? info.label : `Open until ${info.formatted}`;
  const background = info.closed ? 'var(--surface-page-alt)' : info.urgent ? '#fdecea' : 'var(--pink-100)';
  const color = info.closed ? 'var(--text-primary)' : info.urgent ? 'var(--red-700)' : 'var(--action-primary-bg)';
  return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, padding: '3px 10px', borderRadius: 999, background, color, opacity: info.closed ? 0.65 : 1 }}>
      {label}
    </span>
  );
}

export function HrDashboard({ nav, profile }) {
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recheckingId, setRecheckingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [closingSoonOnly, setClosingSoonOnly] = useState(false);

  const reload = () => {
    setLoading(true);
    listAllJobs().then(({ data }) => {
      setJobs(data);
      setLoading(false);
    });
  };

  useEffect(reload, []);
  useEffect(() => {
    listJobCategories().then(({ data }) => setCategories(data.map((c) => c.name)));
  }, []);

  const handleDelete = async (job) => {
    if (!window.confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    await deleteJob(job.id);
    reload();
  };

  const handleStatus = async (job, status) => {
    await setJobStatus(job.id, status);
    reload();
    // Fire-and-forget — scoring every applicant's resume against this one
    // job can take a while, and there's nothing on this screen for HR to
    // wait on; it happens in the background while they keep working. This
    // is the real "automatic" matching pass — it runs the instant a job
    // goes live, with no button press. Success stays silent by design (HR
    // is already mid-task by the time it finishes), but a failure here
    // means applicants silently miss the job entirely, so that case alone
    // gets surfaced — otherwise it fails with zero visible symptom.
    if (status === 'published') {
      matchJobToAllResumes(job.id).then(({ error }) => {
        if (error) window.alert(`"${job.title}" is published, but automatic applicant matching failed: ${error}\n\nUse "Re-check Matches" on this job once the issue is resolved.`);
      });
    }
  };

  // A manual fallback, not a stand-in for the automatic pass above — the
  // publish-time run already scores every applicant with a resume against a
  // newly-published job with zero clicks. The one gap: an individual
  // applicant's AI scoring call can fail (rare) with no automatic retry,
  // silently leaving them unscored for that one job. This button (styled as
  // a small icon, not a full pill, to signal "rarely needed") is the way to
  // recover from that specific edge case — safe to press any time since
  // matchJobToAllResumes only ever (re)scores applicants who don't already
  // have a row for this job.
  const handleRecheckMatches = async (job) => {
    setRecheckingId(job.id);
    const { data, error } = await matchJobToAllResumes(job.id);
    setRecheckingId(null);
    if (error) {
      window.alert(`Could not re-check matches: ${error}`);
      return;
    }
    if (data.scored === 0) {
      window.alert('Everyone with a completed resume was already scored for this job — nothing left to re-check.');
      return;
    }
    window.alert(
      `Scored ${data.scored} more applicant${data.scored === 1 ? '' : 's'} against "${job.title}."` +
      (data.notified > 0 ? ` ${data.notified} qualified and got notified by email.` : ''),
    );
  };

  const closingSoonCount = useMemo(
    () => jobs.filter((j) => j.status === 'published' && deadlineInfo(j.application_deadline)?.urgent).length,
    [jobs],
  );

  const statusCounts = useMemo(() => {
    const counts = { all: jobs.length, draft: 0, published: 0, closed: 0 };
    for (const j of jobs) counts[j.status] = (counts[j.status] || 0) + 1;
    return counts;
  }, [jobs]);

  const filteredJobs = useMemo(() => jobs.filter((j) => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (categoryFilter && j.category !== categoryFilter) return false;
    if (stationFilter && j.location !== stationFilter) return false;
    if (closingSoonOnly && !(j.status === 'published' && deadlineInfo(j.application_deadline)?.urgent)) return false;
    return true;
  }), [jobs, statusFilter, categoryFilter, stationFilter, closingSoonOnly]);

  return (
    <HrShell active="hr-jobs" nav={nav} profile={profile}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Job Openings</h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>Create, publish, and manage every posting.</p>
          </div>
          <button
            className="btn-animate"
            onClick={() => nav('hr-job-form', null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px', borderRadius: 999, border: 'none',
              cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'inherit',
              background: 'linear-gradient(135deg, var(--action-primary-bg-strong), var(--action-primary-bg))', color: '#fff',
              boxShadow: '0 8px 18px rgba(211, 47, 47, 0.28)',
            }}
          >
            {ICONS.plus} New Job Posting
          </button>
        </div>

        {closingSoonCount > 0 && (
          <div style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)', fontWeight: 600 }}>
              ⏰ {closingSoonCount} published posting{closingSoonCount === 1 ? ' is' : 's are'} closing within a week.
            </span>
            <ActionPill icon={null} label="View Them" tone="danger" onClick={() => { setStatusFilter('published'); setClosingSoonOnly(true); }} />
          </div>
        )}

        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                style={{
                  padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600,
                  border: statusFilter === tab.key ? 'none' : '1px solid var(--border-hairline)',
                  background: statusFilter === tab.key ? 'var(--action-primary-bg)' : 'transparent',
                  color: statusFilter === tab.key ? '#fff' : 'var(--text-primary)',
                }}
              >
                {tab.label} ({statusCounts[tab.key] || 0})
              </button>
            ))}
          </div>
          <div style={{ width: 180 }}>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={categories} placeholder="All Categories" placeholderSelectable />
          </div>
          <div style={{ width: 160 }}>
            <Select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} options={STATIONS} placeholder="All Stations" placeholderSelectable />
          </div>
          <button
            onClick={() => setClosingSoonOnly((v) => !v)}
            style={{
              padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600,
              border: closingSoonOnly ? 'none' : '1px solid var(--border-hairline)',
              background: closingSoonOnly ? 'var(--red-700)' : 'transparent',
              color: closingSoonOnly ? '#fff' : 'var(--text-primary)',
            }}
          >
            ⏰ Closing Soon
          </button>
          {(statusFilter !== 'all' || categoryFilter || stationFilter || closingSoonOnly) && (
            <ActionPill
              icon={ICONS.clearX}
              label="Clear Filters"
              tone="danger"
              onClick={() => { setStatusFilter('all'); setCategoryFilter(''); setStationFilter(''); setClosingSoonOnly(false); }}
            />
          )}
        </div>

        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading job postings…</p>
        ) : jobs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No job postings yet. Create one to get started.</p>
        ) : filteredJobs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No postings match these filters.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredJobs.map((j) => {
              const meta = STATUS_META[j.status];
              return (
                <div key={j.id} className="hr-job-card" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta?.color, flexShrink: 0 }} />
                      <strong style={{ fontSize: 'var(--text-lg)' }}>{j.title}</strong>
                      <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>{meta?.label}</span>
                      {j.status === 'published' && <DeadlineBadge deadline={j.application_deadline} />}
                      {j.positions_remaining === 0 && <PositionsFilledBadge />}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', opacity: 0.75, marginBottom: 6 }}>
                      {[j.category, j.location, j.employment_type].filter(Boolean).join(' · ')} · {j.advanced_count} of {j.open_positions} position{j.open_positions === 1 ? '' : 's'} filled
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 'var(--text-xs)', opacity: 0.6 }}>
                      <span>Posted {formatPostedDate(j.created_at)}</span>
                      <span>·</span>
                      <span style={{ fontWeight: j.applicant_count > 0 ? 700 : 400, color: j.applicant_count > 0 ? 'var(--action-primary-bg)' : 'inherit', opacity: j.applicant_count > 0 ? 1 : 0.6 }}>
                        {j.applicant_count} applicant{j.applicant_count === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ActionPill icon={ICONS.users} label="View Applicants" tone="primary" onClick={() => nav('hr-applicant-list', j)} />
                    <ActionPill icon={ICONS.pencil} label="Edit" tone="neutral" onClick={() => nav('hr-job-form', j)} />
                    {j.status !== 'published' && <ActionPill icon={ICONS.publish} label="Publish" tone="positive" onClick={() => handleStatus(j, 'published')} />}
                    {j.status === 'published' && <ActionPill icon={ICONS.pause} label="Close" tone="warning" onClick={() => handleStatus(j, 'closed')} />}
                    {j.status === 'closed' && <ActionPill icon={ICONS.reopen} label="Reopen as Draft" tone="neutral" onClick={() => handleStatus(j, 'draft')} />}
                    <span style={{ width: 1, height: 22, background: 'var(--border-hairline)', margin: '0 2px' }} />
                    {j.status === 'published' && (
                      <IconOnly
                        icon={ICONS.refresh}
                        tone="neutral"
                        disabled={recheckingId === j.id}
                        title="Re-check matches — manual fallback, only needed if the automatic AI scoring silently missed an applicant (rare)"
                        onClick={() => handleRecheckMatches(j)}
                      />
                    )}
                    <IconOnly icon={ICONS.trash} tone="danger" title="Delete posting" onClick={() => handleDelete(j)} />
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
