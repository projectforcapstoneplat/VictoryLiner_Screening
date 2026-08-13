// HR head only — create HR personnel accounts and toggle them active/inactive.
import { useEffect, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { listHrPersonnel, setHrPersonnelActive, createHrAccount } from '../lib/hrAccounts.js';
import { listJobCategories, createJobCategory, deleteJobCategory } from '../lib/jobCategories.js';

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
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '30px 40px', marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>Job Categories</h2>
      <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, margin: 0 }}>
        Used for job posting categories and the interview question bank. Removing one here only affects future postings — it doesn&rsquo;t touch anything already using that category.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Input label="New Category:" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Fleet Planning" />
        <Button variant="strong" size="sm" onClick={handleAdd} disabled={saving || !draft.trim()} style={{ alignSelf: 'flex-end' }}>{saving ? 'Adding…' : 'Add'}</Button>
      </div>
      {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
      {loading ? (
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.6 }}>Loading categories…</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', padding: '6px 8px 6px 14px', borderRadius: 999, background: 'var(--surface-page-alt)' }}>
              {c.name}
              <span onClick={() => handleDelete(c)} title={`Remove ${c.name}`} style={{ cursor: 'pointer', color: 'var(--red-700)', fontWeight: 700, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>×</span>
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

  return (
    <HrShell active="hr-accounts" nav={nav} profile={profile}>
      <div style={{ maxWidth: 900 }}>
        <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 30px', fontFamily: 'var(--font-display)' }}>HR Personnel</h1>

        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '30px 40px', marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>Add HR Personnel</h2>
          <div style={{ display: 'flex', gap: 16 }}>
            <Input label="Full Name:" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input label="Email:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Input label="Temporary Password:" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
          <div>
            <Button variant="strong" size="sm" onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create Account'}</Button>
          </div>
        </div>

        <JobCategoriesCard />

        {loading ? (
          <p>Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <p>No HR personnel accounts yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {accounts.map((a) => (
              <div key={a.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{a.full_name || a.email}</strong>
                  <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8 }}>{a.email} · {a.is_active ? 'Active' : 'Deactivated'}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(a)}>{a.is_active ? 'Deactivate' : 'Reactivate'}</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </HrShell>
  );
}
export default HrAccounts;
