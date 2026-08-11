// Privacy Policy — grounded in what this system actually collects (structured
// resume fields, video interview recordings, AI-assisted screening) rather
// than generic boilerplate, same approach as FAQ.jsx.
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';

const SECTIONS = [
  {
    h: 'What We Collect',
    body: 'When you apply, we collect the information you provide in your structured application (name, contact details, work experience, education, skills, certifications, and role-specific details such as driver\'s license information for driving roles), along with the video answers you record for your interview.',
  },
  {
    h: 'How We Use It',
    body: 'Your information is used solely to evaluate your application for the role(s) you applied to — including AI-assisted screening against each role\'s stated qualifications — and to contact you about your application status. We do not sell your data or use it for advertising.',
  },
  {
    h: 'Who Can See It',
    body: 'Only authorized HR staff reviewing candidates for the specific role(s) you applied to can view your application and interview recordings. HR Head accounts see aggregate reporting and analytics, not your raw application details, unless also acting as a reviewer.',
  },
  {
    h: 'AI-Assisted Screening',
    body: 'As disclosed on every job posting, we use AI tools to help assess how your application matches a role\'s screening criteria. A human member of our HR team reviews candidates before any decision is made — the AI assists screening, it doesn\'t make hiring decisions on its own.',
  },
  {
    h: 'Video Interview Storage',
    body: 'Recorded video answers are stored securely and are only accessible to authorized HR staff and the AI evaluation process described above. You can re-record any answer before HR makes a decision.',
  },
  {
    h: 'Data Retention',
    body: 'We retain application data for as long as reasonably necessary for recruitment purposes and to comply with applicable record-keeping requirements. If you have questions about how long your specific data will be kept, reach out via Contact Us.',
  },
  {
    h: 'Your Rights',
    body: 'You may request details about the personal data we hold about you, consistent with the Philippine Data Privacy Act of 2012. Reach out via Contact Us and our HR team will assist.',
  },
];

export function Privacy({ nav }) {
  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 820, margin: '70px auto 0', padding: '0 20px' }}>
        <div className="fade-in-up" style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 8 }}>Legal</div>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-5xl)', margin: '0 0 12px' }}>Privacy Policy</h1>
          <p style={{ fontSize: 'var(--text-md)', opacity: 0.7, margin: 0 }}>How Victory Liner Careers collects, uses, and protects your information.</p>
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
export default Privacy;
