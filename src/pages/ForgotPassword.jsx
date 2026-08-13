// Requests a password-reset email — the actual reset happens on
// ResetPassword.jsx once the applicant clicks the link Supabase sends them.
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { requestPasswordReset } from '../lib/auth.js';

export function ForgotPassword({ nav, variant = 'applicant' }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const backScreen = variant === 'hr' ? 'hr-login' : 'signin';
  const backLabel = variant === 'hr' ? 'Back to HR Portal' : 'Back to Sign In';

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setError('');
    setLoading(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}>
        <div onClick={() => nav(backScreen)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>&larr; {backLabel}</div>
        <div style={{ background: 'var(--surface-card)', borderRadius: 4, padding: '60px 80px', maxWidth: 900, boxSizing: 'border-box', margin: '30px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }} className="auth-card">
          <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 4px' }}>Reset Your Password</h2>
          {sent ? (
            <div style={{ width: '100%', maxWidth: 525, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 'var(--text-sm)' }}>
                If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. Check your inbox (and spam folder).
              </p>
              <Button variant="strong" size="lg" onClick={() => nav(backScreen)}>{backLabel}</Button>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: 525, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <p style={{ fontSize: 'var(--text-sm)', opacity: 0.75, margin: 0 }}>
                Enter the email address on your account and we'll send you a link to reset your password.
              </p>
              <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
              <Button variant="strong" size="lg" onClick={handleSubmit} disabled={loading}>{loading ? 'Sending…' : 'Send Reset Link'}</Button>
            </div>
          )}
        </div>
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default ForgotPassword;
