// HR sign-in — separate, unlisted entry point (reachable via ?hr=1, no public
// link to it). HR accounts are never self-registered (see supabase/README.md);
// only an HR head can create them from the HR dashboard.
// Deliberately its own distraction-free "portal" shell rather than the public
// marketing Header/Footer — no nav links, no footer address/social icons,
// nothing that belongs on a staff-only sign-in screen.
import { useState } from 'react';
import { ThemeToggle } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { signInWithPassword, signOut, getProfile } from '../lib/auth.js';

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function HrLogin({ nav }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    const { data, error: signInError } = await signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }
    const { data: profile } = await getProfile(data.user.id);
    setLoading(false);
    if (!profile || (profile.role !== 'hr_personnel' && profile.role !== 'hr_head')) {
      await signOut();
      setError('This account is not an HR account.');
      return;
    }
    if (!profile.is_active) {
      await signOut();
      setError('This HR account has been deactivated.');
      return;
    }
    nav('hr-dashboard');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleSignIn();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page-alt)', fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 3, background: 'var(--action-primary-bg)', flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 40px' }}>
        <div onClick={() => nav('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-display)' }}>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--action-primary-bg)' }}>Victory Liner</span>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-primary)', opacity: 0.55 }}>Careers</span>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{
          width: '100%', maxWidth: 400, background: 'var(--surface-card)', borderRadius: 20,
          boxShadow: 'var(--shadow-card)', padding: '44px 40px', display: 'flex', flexDirection: 'column', gap: 24,
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LockIcon />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-xl)' }}>HR Portal</h1>
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', opacity: 0.65 }}>Sign in with your staff account to continue.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onKeyDown={handleKeyDown}>
            <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            {error && (
              <div style={{ background: 'var(--pink-100)', color: 'var(--red-700)', fontSize: 'var(--text-sm)', padding: '10px 14px', borderRadius: 10 }}>
                {error}
              </div>
            )}
            <Button variant="strong" size="lg" onClick={handleSignIn} disabled={loading}>{loading ? 'Signing In…' : 'Sign In'}</Button>
          </div>

          <a
            href="#"
            onClick={(e) => { e.preventDefault(); nav('hr-forgot-password'); }}
            style={{ color: 'var(--text-link)', fontSize: 'var(--text-sm)', textAlign: 'center' }}
          >
            Forgot Password?
          </a>

          <button
            onClick={() => nav('home')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: 'var(--text-primary)', opacity: 0.55, fontSize: 'var(--text-xs)', fontFamily: 'inherit',
            }}
          >
            &larr; Back to Careers Site
          </button>
        </div>
      </div>
    </div>
  );
}
export default HrLogin;
