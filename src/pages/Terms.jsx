// Terms of Service — grounded in what this system actually does (structured
// application instead of file upload, video interview, applications lock
// after submission, in-app status only) rather than generic boilerplate.
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';

const SECTIONS = [
  {
    h: 'Accepting These Terms',
    body: 'By creating an account or submitting an application through Victory Liner Careers, you agree to these terms and to our Privacy Policy.',
  },
  {
    h: 'Accuracy of Information',
    body: 'You agree that the information you provide in your application — including work experience, education, skills, and any role-specific details — is accurate and truthful to the best of your knowledge. Providing false information may disqualify your application.',
  },
  {
    h: 'Video Interview Conduct',
    body: 'When recording video interview answers, you\'re responsible for the content of your responses. Each question is hidden until you start it and is timed once you begin. You may re-record an answer up to 3 times per question, before or after submitting, up until HR makes a decision on your application.',
  },
  {
    h: 'Application Finality',
    body: 'Once submitted, an application is locked and cannot be edited directly — this ensures HR is always reviewing the version you intended to submit. If you need to correct something important, contact us and HR can advise on next steps.',
  },
  {
    h: 'Account Responsibility',
    body: 'You\'re responsible for keeping your account credentials secure and for all activity under your account. Notify us right away if you believe your account has been accessed without your permission.',
  },
  {
    h: 'No Guarantee of Employment',
    body: 'Submitting an application, completing a video interview, or being advanced to a later stage does not guarantee an offer of employment. All hiring decisions are made at Victory Liner\'s discretion.',
  },
  {
    h: 'Changes to These Terms',
    body: 'We may update these terms from time to time as the platform evolves. Continued use of the site after changes are posted means you accept the updated terms.',
  },
];

export function Terms({ nav }) {
  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 820, margin: '70px auto 0', padding: '0 20px' }}>
        <div className="fade-in-up" style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 8 }}>Legal</div>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-5xl)', margin: '0 0 12px' }}>Terms of Service</h1>
          <p style={{ fontSize: 'var(--text-md)', opacity: 0.7, margin: 0 }}>The terms that apply when you use Victory Liner Careers to apply for a role.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 60 }}>
          {SECTIONS.map((s, i) => (
            <div key={s.h} className="fade-in-up" style={{ animationDelay: `${Math.min(i, 6) * 0.06}s`, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '26px 30px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>{s.h}</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.7, opacity: 0.85 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>
      <Footer nav={nav} />
    </div>
  );
}
export default Terms;
