// HR sign-in — separate, unlisted entry point (reachable via ?hr=1, no public
// link to it). HR accounts are never self-registered (see supabase/README.md);
// only an HR head can create them from the HR dashboard, so unlike SignIn.jsx
// there's no Create Account mode to slide to — just the same split-panel
// visual language (photo panel + form panel) applied to a single screen.
// Still its own distraction-free "portal" shell rather than the public
// marketing Header/Footer — no nav links, no footer address/social icons,
// nothing that belongs on a staff-only sign-in screen.
import { useEffect, useState } from 'react';
import { ThemeToggle } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { FloatingInput } from '../components/core/FloatingInput/FloatingInput.jsx';
import { EmailOtpFields } from '../components/core/EmailOtpFields/EmailOtpFields.jsx';
import { FormError } from '../components/feedback/FormError/FormError.jsx';
import { signInWithPassword, signInWithGoogle, signOut, getProfile } from '../lib/auth.js';
import { friendlyAuthError } from '../lib/authErrors.js';
import heroBase from '../assets/hero-bus-base.jpg';

const LOCK_ICON = <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;

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

// session/profile: passed down from App.jsx's own auth state, which is how
// this screen finds out what happened after a Google sign-in — that's a
// full-page redirect away and back (see signInWithGoogle in src/lib/auth.js),
// so there's no synchronous return value here to check the way handleSignIn
// gets one for the password path.
export function HrLogin({ nav, session, profile }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // 'password' or 'otp' — same alternative sign-in method as SignIn.jsx,
  // sharing the email field above it.
  const [authMethod, setAuthMethod] = useState('password');

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    const { data, error: signInError } = await signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError(friendlyAuthError(signInError.message));
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

  // EmailOtpFields already completed the actual sign-in (verifyOtp) before
  // calling this — same role/active checks as handleSignIn above, since
  // verifyOtp (unlike Google) resolves synchronously right here, no
  // redirect involved.
  const handleOtpVerified = async ({ user }) => {
    const { data: profile } = await getProfile(user.id);
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

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    const { error: oauthError } = await signInWithGoogle({ hr: true });
    if (oauthError) {
      setGoogleLoading(false);
      setError(friendlyAuthError(oauthError.message));
    }
  };

  // Runs once Google's redirect lands back here with a real session. App.jsx
  // already auto-navigates away to hr-dashboard the moment `profile` turns
  // out to actually be HR (see its own screen==='hr-login' effect) — this is
  // the rejection side of that same check, for everything else: a brand-new
  // Google sign-up (defaults to the 'applicant' role, same as the public
  // flow — HR accounts are never self-registered) or a deactivated HR
  // account. Mirrors handleSignIn's own checks above; can't reuse them
  // directly since there's no synchronous call to attach them to here.
  useEffect(() => {
    if (!session || !profile) return;
    if (profile.role === 'hr_personnel' || profile.role === 'hr_head') {
      if (!profile.is_active) {
        signOut();
        setError('This HR account has been deactivated.');
      }
      return;
    }
    signOut();
    setError('This account is not an HR account.');
  }, [session, profile]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading && authMethod === 'password') handleSignIn();
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media (max-width: 880px) {
          .hr-login-split-image { display: none !important; }
        }
      `}</style>

      <div style={{ height: 4, background: 'linear-gradient(90deg, var(--action-primary-bg), var(--red-700))', flexShrink: 0 }} />

      <div className="fade-in-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 40px' }}>
        <button
          onClick={() => nav('home')}
          className="btn-animate"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-display)', background: 'none', border: 'none', padding: 0 }}
        >
          <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--action-primary-bg)' }}>Victory Liner</span>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-primary)', opacity: 0.55 }}>Careers</span>
        </button>
        <ThemeToggle />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 60px' }}>
        <div style={{ width: '100%', maxWidth: 900 }}>
          <div
            className="hr-login-card fade-in-up"
            style={{
              background: 'var(--surface-card)', borderRadius: 24, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
              boxSizing: 'border-box', display: 'flex', alignItems: 'stretch',
            }}
          >
            <div
              className="hr-login-split-image"
              style={{
                flex: '0 0 40%', position: 'relative', minHeight: 520,
                backgroundImage: `linear-gradient(180deg, rgba(20,10,10,0.15), rgba(20,10,10,0.8)), url(${heroBase})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 36, boxSizing: 'border-box',
              }}
            >
              <div style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, lineHeight: 1.25 }}>
                Screen Smarter, Not Harder.
              </div>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-sm)', margin: '10px 0 20px' }}>
                AI-assisted resume and interview review, built for the team screening Victory Liner's next hires.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)', borderRadius: 999, padding: '8px 16px' }}>
                <span style={{ color: '#fff', fontSize: 'var(--text-xs)', fontWeight: 700 }}>🔒 Staff Access Only</span>
              </div>
            </div>

            <div style={{ flex: 1, padding: 'clamp(32px, 5vw, 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
              <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--pink-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    {LOCK_ICON}
                  </span>
                  <h1 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: 0, fontFamily: 'var(--font-display)' }}>HR Portal</h1>
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.65, margin: '6px 0 0' }}>Sign in with your staff account to continue.</p>
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="btn-animate"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    background: '#fff', color: '#3c4043', border: '1px solid var(--border-hairline)', borderRadius: 999,
                    padding: '13px 16px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit',
                    cursor: googleLoading ? 'default' : 'pointer', opacity: googleLoading ? 0.7 : 1, boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} onKeyDown={handleKeyDown}>
                  <FloatingInput id="hr-email" label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />

                  <div style={{ display: 'flex', background: 'var(--surface-page-alt)', borderRadius: 999, padding: 4, gap: 4 }}>
                    {[['password', 'Password'], ['otp', 'Email Code']].map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => { setAuthMethod(value); setError(''); }}
                        style={{
                          flex: 1, border: 'none', borderRadius: 999, padding: '9px 0', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--text-xs)', fontWeight: 700, transition: 'background 0.18s ease, color 0.18s ease',
                          background: authMethod === value ? 'var(--surface-card)' : 'transparent',
                          color: authMethod === value ? 'var(--action-primary-bg)' : 'var(--text-primary)',
                          opacity: authMethod === value ? 1 : 0.6,
                          boxShadow: authMethod === value ? 'var(--shadow-card)' : 'none',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {authMethod === 'password' ? (
                    <>
                      <FloatingInput id="hr-password" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                      <FormError message={error} />
                      <Button variant="strong" size="lg" onClick={handleSignIn} disabled={loading}>{loading ? 'Signing In…' : 'Sign In'}</Button>
                      <button
                        onClick={() => nav('hr-forgot-password')}
                        style={{ alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--action-primary-bg)', padding: 4 }}
                      >
                        Forgot Password?
                      </button>
                    </>
                  ) : (
                    <>
                      <EmailOtpFields email={email} idPrefix="hr-otp" onVerified={handleOtpVerified} onError={setError} />
                      <FormError message={error} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => nav('home')}
            className="btn-animate"
            style={{
              display: 'block', margin: '22px auto 0', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
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
