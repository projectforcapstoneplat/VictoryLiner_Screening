// Create account — recreation of the Figma "application/CREATE" frame
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { RequirementRow } from '../components/core/RequirementRow/RequirementRow.jsx';
import { signUpApplicant } from '../lib/auth.js';
import { getPasswordChecklist, isPasswordValid } from '../lib/passwordRules.js';
import { isValidEmailFormat, isDisposableEmail } from '../lib/emailRules.js';

export function CreateAccount({ job, nav }) {
  const j = job || { title: 'Bus Conductor' };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false);
  const [error, setError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const passwordChecklist = getPasswordChecklist(password);
  const passwordValid = isPasswordValid(password);
  const passwordsMatch = verifyPassword.length > 0 && password === verifyPassword;
  const canSubmit = passwordValid && passwordsMatch && consent && email.trim().length > 0;

  const handleCreateAccount = async () => {
    setError('');
    setEmailTaken(false);
    if (!consent) {
      setError('Please consent to the terms and conditions to continue.');
      return;
    }
    if (!passwordValid) {
      setError('Password does not meet the requirements below.');
      return;
    }
    if (password !== verifyPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!isValidEmailFormat(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    if (await isDisposableEmail(email)) {
      setLoading(false);
      setError('Temporary or disposable email addresses are not allowed. Please use a permanent email address.');
      return;
    }
    const { data, error: signUpError } = await signUpApplicant({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      setEmailTaken(signUpError.code === 'EMAIL_TAKEN');
      return;
    }
    if (data.session) {
      nav('home');
      return;
    }
    setConfirmationSent(true);
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}>
        <div onClick={() => nav('signin', j)} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>&larr; Back to Sign In</div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 400, marginBottom: 30 }}>{j.title}</div>
        <div style={{ marginBottom: 50, padding: '0 clamp(8px, 4vw, 40px)' }}><Stepper current={0} /></div>
        <div style={{ background: 'var(--surface-card)', borderRadius: 4, padding: '60px 80px', maxWidth: 900, boxSizing: 'border-box', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }} className="auth-card">
          <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 20px' }}>Create An Account</h2>
          {confirmationSent ? (
            <div style={{ width: '100%', maxWidth: 525, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-sm)' }}>We sent a confirmation link to <strong>{email}</strong>. Confirm your email, then sign in.</p>
              <Button variant="strong" size="lg" onClick={() => nav('signin', j)}>Go to Sign In</Button>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: 525, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Password:" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: -12 }}>
                {passwordChecklist.map((r) => <RequirementRow key={r.id} passed={r.passed} label={r.label} />)}
              </div>
              <Input label="Verify Password:" type="password" value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)} />
              {verifyPassword.length > 0 && (
                <div style={{ marginTop: -12 }}>
                  <RequirementRow passed={passwordsMatch} label="Passwords match" />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setHasViewedTerms(true);
                    const url = `${window.location.origin}${window.location.pathname}?screen=terms`;
                    window.open(url, 'vlTerms', 'width=720,height=800,noopener,noreferrer');
                  }}
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--text-link)' }}
                >
                  Read the Terms and Conditions &rarr;
                </a>
                <label
                  style={{ display: 'flex', gap: 10, fontSize: 'var(--text-sm)', alignItems: 'flex-start', opacity: hasViewedTerms ? 1 : 0.5 }}
                  title={hasViewedTerms ? undefined : 'Please read the Terms and Conditions first.'}
                >
                  <input
                    type="checkbox"
                    checked={consent}
                    disabled={!hasViewedTerms}
                    onChange={(e) => setConsent(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  Yes, I have read and consent to the terms and conditions.
                </label>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>By clicking the "Create Account" button, you are agreeing to our Recruiting Data Privacy Notice.</p>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--red-700)' }}>{error}</span>
                  {emailTaken && (
                    <a href="#" onClick={(e) => { e.preventDefault(); nav('signin', j); }} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                      Sign In &rarr;
                    </a>
                  )}
                </div>
              )}
              <Button variant="strong" size="lg" onClick={handleCreateAccount} disabled={loading || !canSubmit}>{loading ? 'Creating Account…' : 'Create Account'}</Button>
            </div>
          )}
        </div>
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default CreateAccount;
