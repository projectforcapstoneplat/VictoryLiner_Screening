// HR sign-in — separate, unlisted entry point. HR accounts are never self-registered
// (see supabase/README.md); only an HR head can create them from the HR dashboard.
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { signInWithPassword, signOut, getProfile } from '../lib/auth.js';
import logo from '../assets/logo.png';

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

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header logo={logo} links={[]} /></div>
      <section style={{ maxWidth: 900, margin: '80px auto 0', padding: '0 20px' }}>
        <div style={{ background: 'var(--off-white-100)', borderRadius: 4, padding: '60px 80px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 20px' }}>HR Sign In</h2>
          <div style={{ width: 525, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Password:" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
            <Button variant="strong" size="lg" onClick={handleSignIn} disabled={loading}>{loading ? 'Signing In…' : 'Sign In'}</Button>
            <div onClick={() => nav('home')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', textAlign: 'center' }}>
              &larr; Back to Careers Site
            </div>
          </div>
        </div>
      </section>
      <div style={{ marginTop: 60 }}><Footer logo={logo} /></div>
    </div>
  );
}
export default HrLogin;
