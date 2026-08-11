// Sign-in — recreation of the Figma "application" frame
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { signInWithPassword } from '../lib/auth.js';

export function SignIn({ job, nav, redirectTo }) {
  const j = job || { title: 'Bus Conductor' };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error: signInError } = await signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    if (job) {
      nav('apply', job);
      return;
    }
    nav(redirectTo || 'home');
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}>
        <div onClick={() => nav('details', j)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>&larr; Back to Job Posting</div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 400, marginBottom: 30 }}>{j.title}</div>
        <div style={{ marginBottom: 50, padding: '0 40px' }}><Stepper current={0} /></div>
        <div style={{ background: 'var(--surface-card)', borderRadius: 4, padding: '60px 80px', maxWidth: 900, boxSizing: 'border-box', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }} className="auth-card">
          <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 20px' }}>Sign In</h2>
          <div style={{ width: '100%', maxWidth: 525, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Password:" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
            <Button variant="strong" size="lg" onClick={handleSignIn} disabled={loading}>{loading ? 'Signing In…' : 'Sign In'}</Button>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <span>Don't have an account yet? <a href="#" onClick={(e) => { e.preventDefault(); nav('create', j); }} style={{ color: 'var(--text-link)' }}>Create Account</a></span>
              <a href="#" onClick={(e) => { e.preventDefault(); nav('forgot-password'); }} style={{ color: 'var(--text-link)' }}>Forgot Password?</a>
            </div>
          </div>
        </div>
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default SignIn;
