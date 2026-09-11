// HR head only — create HR personnel accounts and toggle them active/inactive.
import { useEffect, useMemo, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { listHrPersonnel, setHrPersonnelActive, createHrAccount } from '../lib/hrAccounts.js';
import { listJobCategories, createJobCategory, deleteJobCategory } from '../lib/jobCategories.js';

const ICON_PROPS = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONS = {
  personPlus: <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M18 8v6M15 11h6" /></svg>,
  tag: <svg {...ICON_PROPS}><path d="M20.6 12.6 12 21.2 2.8 12 12 2.8h8.6z" /><circle cx="16" cy="8" r="1.2" fill="var(--action-primary-bg)" /></svg>,
  users: <svg {...ICON_PROPS}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 4.7a3.5 3.5 0 0 1 0 6.6" /><path d="M20 20a6.5 6.5 0 0 0-4-6" /></svg>,
  dice: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="8" r="1" fill="currentColor" /><circle cx="8" cy="16" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>,
};

function CardHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', margin: 0, fontWeight: 700 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 'var(--text-xs)', opacity: 0.65, margin: '4px 0 0', maxWidth: 520 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '14px 20px', flex: '1 1 140px', minWidth: 120 }}>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: accent || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

function formatJoinDate(iso) {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// A quick, decent-enough temp password so HR Head doesn't have to type one
// up on the spot — mixes cases/digits/symbols, skips visually-confusable
// characters (0/O, 1/l/I) since it'll likely be read aloud or texted over.
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < 12; i += 1) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function JobCategoriesCard() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    listJobCategories().then(({ data }) => {
      setCategories(data);
      setLoading(false);
    });
  };

  useEffect(reload, []);

  const handleAdd = async () => {
    const name = draft.trim();
    if (!name) return;
    setError('');
    setSaving(true);
    const { error: createError } = await createJobCategory(name);
    setSaving(false);
    if (createError) {
      setError(createError.code === '23505' ? 'That category already exists.' : createError.message);
      return;
    }
    setDraft('');
    reload();
  };

  const handleDelete = async (category) => {
    // Existing job postings / interview question banks store the category
    // as plain text, not a foreign key — deleting it here only removes it
    // from the picker for *new* postings, it doesn't touch anything already
    // using that category name. Worth flagging so HR Head isn't surprised.
    if (!window.confirm(`Remove "${category.name}" from the category list? Job postings and interview questions already using it are unaffected — this only stops it from being picked for new ones.`)) return;
    const { error: deleteError } = await deleteJobCategory(category.id);
    if (deleteError) {
      window.alert(`Could not remove category: ${deleteError.message}`);
      return;
    }
    reload();
  };

  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: 'clamp(24px, 4vw, 40px)', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <CardHeader
        icon={ICONS.tag}
        title="Job Categories"
        subtitle="Used for job posting categories and the interview question bank. Removing one here only affects future postings — it doesn't touch anything already using that category."
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <Input label="New Category:" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Fleet Planning" />
        <Button variant="strong" size="sm" onClick={handleAdd} disabled={saving || !draft.trim()} style={{ alignSelf: 'flex-end' }}>{saving ? 'Adding…' : '+ Add'}</Button>
      </div>
      {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
      {loading ? (
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>Loading categories…</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => (
            <span key={c.id} className="btn-animate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', fontWeight: 600, padding: '7px 8px 7px 16px', borderRadius: 999, background: 'var(--pink-100)', color: 'var(--action-primary-bg)' }}>
              {c.name}
              <span onClick={() => handleDelete(c)} title={`Remove ${c.name}`} style={{ cursor: 'pointer', color: 'var(--red-700)', fontWeight: 700, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }}>×</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function HrAccounts({ nav, profile }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = () => {
    setLoading(true);
    listHrPersonnel().then(({ data }) => {
      setAccounts(data);
      setLoading(false);
    });
  };

  useEffect(reload, []);

  const handleCreate = async () => {
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setCreating(true);
    const { error: createError } = await createHrAccount({ email, password, fullName });
    setCreating(false);
    if (createError) {
      setError(createError);
      return;
    }
    setEmail('');
    setPassword('');
    setFullName('');
    reload();
  };

  const handleToggleActive = async (account) => {
    await setHrPersonnelActive(account.id, !account.is_active);
    reload();
  };

  const stats = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter((a) => a.is_active).length,
    deactivated: accounts.filter((a) => !a.is_active).length,
  }), [accounts]);

  return (
    <HrShell active="hr-accounts" nav={nav} profile={profile}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>HR Personnel</h1>
        <p style={{ margin: '0 0 20px', fontSize: 'var(--text-sm)', opacity: 0.65 }}>Manage HR staff accounts and the shared job category list.</p>

        <div className="fade-in-up" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
          <StatPill label="Total Accounts" value={stats.total} />
          <StatPill label="Active" value={stats.active} accent="#0ca30c" />
          <StatPill label="Deactivated" value={stats.deactivated} accent={stats.deactivated > 0 ? 'var(--red-700)' : undefined} />
        </div>

        <div className="fade-in-up hover-lift" style={{ animationDelay: '0.05s', background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: 'clamp(24px, 4vw, 40px)', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <CardHeader icon={ICONS.personPlus} title="Add HR Personnel" subtitle="New accounts sign in through the HR Portal — share the temporary password directly (phone, in person, etc.), not by email." />
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}><Input label="Full Name:" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div style={{ flex: '1 1 220px' }}><Input label="Email:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Input label="Temporary Password:" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button variant="ghost" size="sm" onClick={() => setPassword(generatePassword())}>{ICONS.dice} Generate</Button>
          </div>
          {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
          <div>
            <Button variant="strong" size="sm" onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create Account'}</Button>
          </div>
        </div>

        <div className="fade-in-up" style={{ animationDelay: '0.1s' }}>
          <JobCategoriesCard />
        </div>

        <div className="fade-in-up" style={{ animationDelay: '0.15s', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ICONS.users}</span>
          <h2 style={{ fontSize: 'var(--text-lg)', margin: 0, fontWeight: 700 }}>Team Members</h2>
        </div>

        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No HR personnel accounts yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {accounts.map((a, i) => (
              <div key={a.id} className="fade-in-up hr-job-card" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s`, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, background: a.is_active ? 'var(--pink-100)' : 'var(--surface-page-alt)', color: a.is_active ? 'var(--red-700)' : 'var(--text-primary)', opacity: a.is_active ? 1 : 0.55,
                  }}>
                    {initials(a.full_name || a.email)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 'var(--text-sm)' }}>{a.full_name || a.email}</strong>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>{a.email} · Joined {formatJoinDate(a.created_at)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                    background: a.is_active ? '#e3f6e6' : 'var(--surface-page-alt)', color: a.is_active ? '#0ca30c' : 'var(--gray-600)',
                  }}>
                    {a.is_active ? 'Active' : 'Deactivated'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleActive(a)}>{a.is_active ? 'Deactivate' : 'Reactivate'}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </HrShell>
  );
}
export default HrAccounts;
