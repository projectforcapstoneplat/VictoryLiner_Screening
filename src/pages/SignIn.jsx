// Sign-in — recreation of the Figma "application" frame
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { FormError } from '../components/feedback/FormError/FormError.jsx';
import { signInWithPassword, signInWithGoogle } from '../lib/auth.js';
import { friendlyAuthError } from '../lib/authErrors.js';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.3 18.9 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.1 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C40.9 36.5 44 30.8 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function SignIn({ job, nav, redirectTo }) {
  const j = job || { title: 'Bus Conductor' };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error: signInError } = await signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(friendlyAuthError(signInError.message));
      return;
    }
    if (job) {
      nav('apply', job);
      return;
    }
    nav(redirectTo || 'home');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    const { error: oauthError } = await signInWithGoogle({
      screen: job ? 'apply' : redirectTo,
      jobId: job?.id,
    });
    // Only reached on failure — success navigates the whole page away to
    // Google before this promise would otherwise resolve.
    if (oauthError) {
      setGoogleLoading(false);
      setError(friendlyAuthError(oauthError.message));
    }
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}>
        {job && (
          <>
            <div onClick={() => nav('details', j)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>&larr; Back to Job Posting</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 400, marginBottom: 30 }}>{j.title}</div>
            <div style={{ marginBottom: 50, padding: '0 clamp(8px, 4vw, 40px)' }}><Stepper current={0} /></div>
          </>
        )}
        <div style={{ background: 'var(--surface-card)', borderRadius: 4, padding: '60px 80px', maxWidth: 900, boxSizing: 'border-box', margin: job ? '0 auto' : '40px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }} className="auth-card">
          <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 20px' }}>Sign In</h2>
          <div style={{ width: '100%', maxWidth: 525, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: '#fff', color: '#3c4043', border: '1px solid var(--border-hairline)', borderRadius: 4,
                padding: '11px 16px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit',
                cursor: googleLoading ? 'default' : 'pointer', opacity: googleLoading ? 0.7 : 1,
              }}
            >
              <GoogleIcon />
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-primary)', opacity: 0.5, fontSize: 'var(--text-xs)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
              OR
              <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            </div>
            <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Password:" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <FormError message={error} />
            <Button variant="strong" size="lg" onClick={handleSignIn} disabled={loading}>{loading ? 'Signing In…' : 'Sign In'}</Button>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <span>Don't have an account yet? <a href="#" onClick={(e) => { e.preventDefault(); nav('create', job); }} style={{ color: 'var(--text-link)' }}>Create Account</a></span>
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
