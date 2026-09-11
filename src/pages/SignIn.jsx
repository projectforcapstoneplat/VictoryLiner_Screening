// Sign In / Create Account — one shared shell so switching between them is a
// real sliding transition (the photo panel and the form panel swap places),
// not two separate page loads that merely happen to look similar. Reached
// as two different screens from App.jsx ('signin' / 'create') — CreateAccount.jsx
// is now a thin wrapper that renders this with initialMode="create", so every
// existing nav('signin', ...) / nav('create', ...) call site keeps working
// unchanged; only the *internal* Sign In <-> Create Account toggle (the
// "Create an Account" / "Sign In Instead" buttons) uses local state instead
// of a real nav(), which is what makes the slide animatable at all — two
// different mounted pages can't tween between each other.
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { RequirementRow } from '../components/core/RequirementRow/RequirementRow.jsx';
import { FloatingInput } from '../components/core/FloatingInput/FloatingInput.jsx';
import { EmailOtpFields } from '../components/core/EmailOtpFields/EmailOtpFields.jsx';
import { FormError } from '../components/feedback/FormError/FormError.jsx';
import { signInWithPassword, signInWithGoogle, signUpApplicant } from '../lib/auth.js';
import { getPasswordChecklist, isPasswordValid } from '../lib/passwordRules.js';
import { isValidEmailFormat, isDisposableEmail } from '../lib/emailRules.js';
import { friendlyAuthError } from '../lib/authErrors.js';
import { TERMS_SECTIONS } from './Terms.jsx';
import heroBase from '../assets/hero-bus-base.jpg';

const CLOSE_ICON = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></svg>;

const ARROW_LEFT_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
const LOCK_ICON = <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
const USER_PLUS_ICON = <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M18 8v6M15 11h6" /></svg>;

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

// Shows the same content as the standalone Terms page (Terms.jsx), but as an
// in-page overlay instead of window.open()'ing a new tab/popup — a popup can
// get silently blocked by the browser, and even when it isn't, a second
// browser window is a heavier, more disruptive way to show a few paragraphs
// than a dialog that closes right back into the form the applicant was
// already filling out.
function TermsModal({ consent, onConsentChange, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,10,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in-up"
        style={{ background: 'var(--surface-card)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '26px 30px 18px', borderBottom: '1px solid var(--border-hairline)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 6 }}>Legal</div>
            <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: 0 }}>Terms of Service</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--surface-page-alt)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {CLOSE_ICON}
          </button>
        </div>
        <div style={{ padding: '20px 30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {TERMS_SECTIONS.map((s) => (
            <div key={s.h}>
              <h3 style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{s.h}</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.6, opacity: 0.8 }}>{s.body}</p>
            </div>
          ))}
        </div>
        {/* Consent lives here, right where the content it's about actually
            is — reading and agreeing happen in one place instead of the
            applicant having to close the modal, then hunt for a separate
            checkbox back in the form to actually give consent. */}
        <div style={{ padding: '18px 30px', borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', gap: 10, fontSize: 'var(--text-sm)', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={(e) => onConsentChange(e.target.checked)} style={{ marginTop: 3 }} />
            Yes, I have read and agree to the Terms and Conditions.
          </label>
          <Button variant="strong" size="md" onClick={onClose}>{consent ? 'Done' : 'Close'}</Button>
        </div>
      </div>
    </div>
  );
}

const PANEL_COPY = {
  signin: {
    heading: 'Moving People, Changing Lives.',
    body: "Sign in to pick up right where you left off — your resume, your matches, your application.",
  },
  create: {
    heading: 'Start Your Career With Us.',
    body: 'One resume, matched automatically against every open role — no re-applying from scratch for each one.',
  },
};

export function SignIn({ job, nav, redirectTo, initialMode = 'signin' }) {
  const j = job || { title: 'Bus Conductor' };
  const [mode, setMode] = useState(initialMode);

  // Sign In state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // 'password' or 'otp' — an alternative way to sign in to an account that
  // already exists, not a replacement (Create Account still sets a
  // password, same as before). Shares the email field above it rather than
  // each method having its own, so switching doesn't mean retyping it.
  const [authMethod, setAuthMethod] = useState('password');

  // Create Account state
  const [caEmail, setCaEmail] = useState('');
  const [caPassword, setCaPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [caError, setCaError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [caLoading, setCaLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const passwordChecklist = getPasswordChecklist(caPassword);
  const passwordValid = isPasswordValid(caPassword);
  const passwordsMatch = verifyPassword.length > 0 && caPassword === verifyPassword;
  const canSubmit = passwordValid && passwordsMatch && consent && caEmail.trim().length > 0;

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
      nav('details', job);
      return;
    }
    nav(redirectTo || 'home');
  };

  // Same reasoning as HrLogin.jsx's own handleKeyDown — Enter should act
  // like clicking Sign In. Only wired for the password method: the OTP
  // fields already have their own explicit Send/Verify step buttons, so
  // there's no single obvious action for a bare Enter to trigger there.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading && authMethod === 'password') handleSignIn();
  };

  // EmailOtpFields already did the actual sign-in (verifyOtp) before calling
  // this — same "where to go next" as handleSignIn above, just triggered
  // from a code instead of a password.
  const handleOtpVerified = () => {
    if (job) {
      nav('details', job);
      return;
    }
    nav(redirectTo || 'home');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    const { error: oauthError } = await signInWithGoogle({
      screen: job ? 'details' : redirectTo,
      jobId: job?.id,
    });
    if (oauthError) {
      setGoogleLoading(false);
      setError(friendlyAuthError(oauthError.message));
    }
  };

  const handleCreateAccount = async () => {
    setCaError('');
    setEmailTaken(false);
    if (!consent) {
      setCaError('Please consent to the terms and conditions to continue.');
      return;
    }
    if (!passwordValid) {
      setCaError('Password does not meet the requirements below.');
      return;
    }
    if (caPassword !== verifyPassword) {
      setCaError('Passwords do not match.');
      return;
    }
    if (!isValidEmailFormat(caEmail)) {
      setCaError('Please enter a valid email address.');
      return;
    }
    setCaLoading(true);
    if (await isDisposableEmail(caEmail)) {
      setCaLoading(false);
      setCaError('Temporary or disposable email addresses are not allowed. Please use a permanent email address.');
      return;
    }
    const { data, error: signUpError } = await signUpApplicant({ email: caEmail, password: caPassword });
    setCaLoading(false);
    if (signUpError) {
      setCaError(friendlyAuthError(signUpError.message));
      setEmailTaken(signUpError.code === 'EMAIL_TAKEN');
      return;
    }
    if (data.session) {
      nav('home');
      return;
    }
    setConfirmationSent(true);
  };

  const copy = PANEL_COPY[mode];

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <style>{`
        @media (max-width: 880px) {
          .auth-panel-image, .auth-panel-form { transform: none !important; }
        }
      `}</style>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}>
        {job && (
          <div className="fade-in-up" style={{ marginBottom: 30 }}>
            <button
              onClick={() => nav('details', j)}
              className="btn-animate"
              style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: 30,
                padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', color: 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 700,
              }}
            >
              {ARROW_LEFT_ICON} Back to Job Posting
            </button>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 400, marginBottom: 30 }}>{j.title}</div>
            <div style={{ marginBottom: 50, padding: '0 clamp(8px, 4vw, 40px)' }}><Stepper current={0} /></div>
          </div>
        )}

        <div
          className="auth-card fade-in-up"
          style={{
            background: 'var(--surface-card)', borderRadius: 24, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
            maxWidth: 1000, boxSizing: 'border-box', margin: job ? '0 auto' : '40px auto 0',
            display: 'flex', alignItems: 'stretch',
          }}
        >
          {/* Both panels always occupy the same flex slots (image first,
              form second) — switching mode never reorders the DOM, it just
              transforms each panel sideways into the other's slot. That's
              what makes this a real, continuously tweened slide instead of
              two pages that happen to look mirrored. The percentages are
              each panel's own width ratio: the image panel is 40% of the
              card, so sliding it into the form's 60%-wide slot is a 150%
              shift of *its own* width (60/40); the form panel is 60% of the
              card, so sliding it into the image's 40%-wide slot is a
              -66.7% shift of *its own* width (-40/60). */}
          <div
            className="auth-split-image auth-panel-image"
            style={{
              flex: '0 0 40%', position: 'relative', minHeight: 560,
              backgroundImage: `linear-gradient(180deg, rgba(20,10,10,0.15), rgba(20,10,10,0.75)), url(${heroBase})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 36, boxSizing: 'border-box',
              transform: mode === 'create' ? 'translateX(150%)' : 'translateX(0)',
              transition: 'transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)',
            }}
          >
            <div key={copy.heading} className="fade-in-up" style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, lineHeight: 1.25 }}>
              {copy.heading}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-sm)', margin: '10px 0 20px' }}>{copy.body}</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)', borderRadius: 999, padding: '8px 16px' }}>
              <span style={{ color: '#fff', fontSize: 'var(--text-xs)', fontWeight: 700 }}>✓ 100% Online Screening</span>
            </div>
          </div>

          <div
            className="auth-split-form auth-panel-form"
            style={{
              flex: 1, padding: 'clamp(32px, 5vw, 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box',
              transform: mode === 'create' ? 'translateX(-66.667%)' : 'translateX(0)',
              transition: 'transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)',
            }}
          >
            {/* Both mode's content stay mounted at all times, stacked in
                the same grid cell (grid sizes to the *taller* of the two,
                always) and cross-faded via opacity — the previous version
                conditionally mounted only one at a time, so the container's
                height snapped to whichever was showing the instant `mode`
                changed, on top of the horizontal slide already happening.
                A card that also silently resized mid-slide is what read as
                "inconsistent" — this keeps the card one constant height in
                both modes, no snap. */}
            <div style={{ display: 'grid', width: '100%' }}>
              <div style={{
                gridRow: 1, gridColumn: 1, width: '100%', maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22,
                opacity: mode === 'signin' ? 1 : 0, visibility: mode === 'signin' ? 'visible' : 'hidden', pointerEvents: mode === 'signin' ? 'auto' : 'none',
                transition: 'opacity 0.25s ease',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--pink-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    {LOCK_ICON}
                  </span>
                  <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: 0 }}>Welcome Back</h2>
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.65, margin: '6px 0 0' }}>Sign in to continue.</p>
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
                  <FloatingInput id="signin-email" label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

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
                      <FloatingInput id="signin-password" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      <FormError message={error} />
                      <Button variant="strong" size="lg" onClick={handleSignIn} disabled={loading}>{loading ? 'Signing In…' : 'Sign In'}</Button>
                      <button
                        onClick={() => nav('forgot-password')}
                        style={{ alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--action-primary-bg)', padding: 4 }}
                      >
                        Forgot Password?
                      </button>
                    </>
                  ) : (
                    <>
                      <EmailOtpFields email={email} idPrefix="signin-otp" onVerified={handleOtpVerified} onError={setError} />
                      <FormError message={error} />
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-primary)', opacity: 0.5, fontSize: 'var(--text-xs)' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                  New here?
                  <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                </div>
                <button
                  onClick={() => setMode('create')}
                  className="btn-animate"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', height: 49, borderRadius: 999,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700,
                    background: 'var(--pink-100)', color: 'var(--action-primary-bg)',
                  }}
                >
                  Create an Account
                </button>
              </div>
              <div style={{
                gridRow: 1, gridColumn: 1, width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22,
                opacity: mode === 'create' ? 1 : 0, visibility: mode === 'create' ? 'visible' : 'hidden', pointerEvents: mode === 'create' ? 'auto' : 'none',
                transition: 'opacity 0.25s ease',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--pink-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    {USER_PLUS_ICON}
                  </span>
                  <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: 0 }}>Create Your Account</h2>
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.65, margin: '6px 0 0' }}>Takes a minute — then we'll match you to open roles.</p>
                </div>

                {confirmationSent ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--text-sm)' }}>We sent a confirmation link to <strong>{caEmail}</strong>. Confirm your email, then sign in.</p>
                    <Button variant="strong" size="lg" onClick={() => setMode('signin')}>Go to Sign In</Button>
                  </div>
                ) : (
                  <>
                    <FloatingInput id="create-email" label="Email Address" type="email" value={caEmail} onChange={(e) => setCaEmail(e.target.value)} />
                    <FloatingInput id="create-password" label="Password" type="password" value={caPassword} onChange={(e) => setCaPassword(e.target.value)} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: -12 }}>
                      {passwordChecklist.map((r) => <RequirementRow key={r.id} passed={r.passed} label={r.label} />)}
                    </div>
                    <FloatingInput id="create-verify-password" label="Verify Password" type="password" value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)} />
                    {verifyPassword.length > 0 && (
                      <div style={{ marginTop: -12 }}>
                        <RequirementRow passed={passwordsMatch} label="Passwords match" />
                      </div>
                    )}
                    {/* Consent itself is now given inside the modal (see
                        TermsModal) — this is just the entry point plus a
                        status readout, not a second, separate checkbox for
                        the same thing. */}
                    <div>
                      <button
                        onClick={() => setShowTermsModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: consent ? '#0ca30c' : 'var(--action-primary-bg)' }}
                      >
                        {consent ? '✓ Agreed to the Terms and Conditions' : 'Read the Terms and Conditions'} &rarr;
                      </button>
                      {!consent && <p style={{ fontSize: 'var(--text-xs)', opacity: 0.6, margin: '6px 0 0' }}>You'll need to read and agree before creating an account.</p>}
                    </div>
                    <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>By clicking the "Create Account" button, you are agreeing to our Recruiting Data Privacy Notice.</p>
                    <FormError
                      message={caError}
                      action={emailTaken && (
                        <button onClick={() => setMode('signin')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, color: 'var(--red-700)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          Sign In &rarr;
                        </button>
                      )}
                    />
                    <Button variant="strong" size="lg" onClick={handleCreateAccount} disabled={caLoading || !canSubmit}>{caLoading ? 'Creating Account…' : 'Create Account'}</Button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-primary)', opacity: 0.5, fontSize: 'var(--text-xs)' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                      Already have an account?
                      <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                    </div>
                    <button
                      onClick={() => setMode('signin')}
                      className="btn-animate"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', height: 49, borderRadius: 999,
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700,
                        background: 'var(--pink-100)', color: 'var(--action-primary-bg)',
                      }}
                    >
                      Sign In Instead
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
      {showTermsModal && <TermsModal consent={consent} onConsentChange={setConsent} onClose={() => setShowTermsModal(false)} />}
    </div>
  );
}
export default SignIn;
