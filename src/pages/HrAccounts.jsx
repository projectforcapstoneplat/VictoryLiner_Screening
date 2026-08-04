// HR head only — create HR personnel accounts and toggle them active/inactive.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { listHrPersonnel, setHrPersonnelActive, createHrAccount } from '../lib/hrAccounts.js';
import logo from '../assets/logo.png';

export function HrAccounts({ nav }) {
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
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header logo={logo} links={[]} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
        <div onClick={() => nav('hr-dashboard')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginBottom: 20 }}>&larr; Back to Dashboard</div>
        <h1 style={{ fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 30px' }}>Manage HR Personnel</h1>

        <div style={{ background: 'var(--off-white-100)', borderRadius: 4, padding: '30px 40px', marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      </section>
    </div>
  );
}
export default HrAccounts;
