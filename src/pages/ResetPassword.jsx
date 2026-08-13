// Reached only via the PASSWORD_RECOVERY auth event (see App.jsx), after
// either an applicant or HR staff clicks the reset link from their email —
// Supabase Auth itself enforces that this only works with a valid,
// unexpired recovery session. The recovery link carries no context about
// which portal the request came from, so which "Sign In" to send them back
// to is only knowable by checking the recovered session's own profile role.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { RequirementRow } from '../components/core/RequirementRow/RequirementRow.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { updatePassword, getProfile } from '../lib/auth.js';
import { getPasswordChecklist, isPasswordValid } from '../lib/passwordRules.js';

const HR_ROLES = ['hr_personnel', 'hr_head'];

export function ResetPassword({ nav }) {
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [isHr, setIsHr] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId) return;
      getProfile(userId).then(({ data: profile }) => {
        if (profile && HR_ROLES.includes(profile.role)) setIsHr(true);
      });
    });
  }, []);

  const signInScreen = isHr ? 'hr-login' : 'signin';
  const signInLabel = isHr ? 'Sign In to HR Portal' : 'Sign In';

  const passwordChecklist = getPasswordChecklist(password);
  const passwordValid = isPasswordValid(password);
  const passwordsMatch = verifyPassword.length > 0 && password === verifyPassword;
  const canSubmit = passwordValid && passwordsMatch;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}>
        <div style={{ background: 'var(--surface-card)', borderRadius: 4, padding: '60px 80px', maxWidth: 900, boxSizing: 'border-box', margin: '30px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }} className="auth-card">
          <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 4px' }}>Set a New Password</h2>
          {done ? (
            <div style={{ width: '100%', maxWidth: 525, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 'var(--text-sm)' }}>Your password has been updated.</p>
              <Button variant="strong" size="lg" onClick={() => nav(signInScreen)}>{signInLabel}</Button>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: 525, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <Input label="New Password:" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: -12 }}>
                {passwordChecklist.map((r) => <RequirementRow key={r.id} passed={r.passed} label={r.label} />)}
              </div>
              <Input label="Verify New Password:" type="password" value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)} />
              {verifyPassword.length > 0 && (
                <div style={{ marginTop: -12 }}>
                  <RequirementRow passed={passwordsMatch} label="Passwords match" />
                </div>
              )}
              {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
              <Button variant="strong" size="lg" onClick={handleSubmit} disabled={loading || !canSubmit}>{loading ? 'Updating…' : 'Update Password'}</Button>
            </div>
          )}
        </div>
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default ResetPassword;
