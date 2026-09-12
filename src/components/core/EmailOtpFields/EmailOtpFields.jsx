// Shared between SignIn.jsx and HrLogin.jsx — the "sign in with a code
// instead of a password" flow. Deliberately doesn't render its own email
// input: both pages already have one (shared with their Password tab so the
// applicant/HR user never has to retype it just for switching methods),
// this only renders what comes after — either "Send Code" or the code entry
// + verify step, depending on where in the flow it's at.
//
// Errors and the final verified session are reported up via callbacks
// rather than rendered here, so each page can show them through its own
// existing FormError/error state instead of a second, separate one.
import { useState } from 'react';
import { Button } from '../Button/Button.jsx';
import { FloatingInput } from '../FloatingInput/FloatingInput.jsx';
import { sendSignInOtp, verifySignInOtp } from '../../../lib/auth.js';
import { friendlyAuthError } from '../../../lib/authErrors.js';

const LINK_BUTTON_STYLE = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--action-primary-bg)', padding: 4 };

export function EmailOtpFields({ email, idPrefix = 'otp', onVerified, onError }) {
  const [step, setStep] = useState('email');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSendCode = async () => {
    onError('');
    if (!email.trim()) {
      onError('Please enter your email address first.');
      return;
    }
    setSending(true);
    const { error } = await sendSignInOtp(email.trim());
    setSending(false);
    if (error) {
      onError(friendlyAuthError(error.message));
      return;
    }
    setCode('');
    setStep('code');
  };

  const handleVerify = async () => {
    onError('');
    if (!code.trim()) {
      onError('Please enter the code we emailed you.');
      return;
    }
    setVerifying(true);
    const { data, error } = await verifySignInOtp(email.trim(), code.trim());
    setVerifying(false);
    if (error) {
      onError(friendlyAuthError(error.message));
      return;
    }
    onVerified(data);
  };

  if (step === 'email') {
    return (
      <Button variant="strong" size="lg" onClick={handleSendCode} disabled={sending}>
        {sending ? 'Sending Code…' : 'Send Sign-In Code'}
      </Button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, margin: 0, textAlign: 'center' }}>
        We emailed a code to <strong>{email}</strong>.
      </p>
      {/* Not "6-Digit Code" — Supabase's own OTP length isn't something this
          app configures/guarantees, so hardcoding a digit count here risked
          reading as wrong (it has). "Sign-In Code" describes the field
          without promising a specific length. */}
      <FloatingInput id={`${idPrefix}-code`} label="Sign-In Code" type="text" value={code} onChange={(e) => setCode(e.target.value)} />
      <Button variant="strong" size="lg" onClick={handleVerify} disabled={verifying}>
        {verifying ? 'Verifying…' : 'Verify & Sign In'}
      </Button>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, fontSize: 'var(--text-sm)' }}>
        <button onClick={() => { setStep('email'); setCode(''); onError(''); }} style={LINK_BUTTON_STYLE}>
          Change Email
        </button>
        <span style={{ opacity: 0.4, alignSelf: 'center' }}>·</span>
        <button onClick={handleSendCode} disabled={sending} style={LINK_BUTTON_STYLE}>
          {sending ? 'Resending…' : 'Resend Code'}
        </button>
      </div>
    </div>
  );
}
export default EmailOtpFields;
