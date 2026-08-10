// Careers FAQ — the footer used to link here and do nothing (href="#",
// preventDefault). Content is grounded in what this system actually does
// (structured resume instead of file upload, video interview, AI-assisted
// screening, in-app status only — no email/SMS yet) rather than generic
// filler, so it doesn't promise anything the site doesn't actually deliver.
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';

const FAQS = [
  {
    q: 'How do I apply for a job?',
    a: 'Browse open positions, pick a role, and create an account (or sign in). You\'ll fill out a structured "My Information / Resume" form, then record short video answers to a few interview questions — no separate interview scheduling needed.',
  },
  {
    q: 'Do I need to upload a resume file?',
    a: 'No. Instead of uploading a PDF or Word document, you fill out a structured form (work experience, education, skills, certifications, etc.). This keeps your information clean and consistent, and avoids issues with blurry scans or hard-to-read file formats.',
  },
  {
    q: 'What is the video interview, and can I re-record my answers?',
    a: 'After submitting your information, you\'ll record short video answers to a set of questions for the role using your camera and microphone. You can re-record any answer as many times as you like — before or after submitting it — right up until HR makes a decision.',
  },
  {
    q: 'Will I be notified about my application status?',
    a: 'Yes — check the "My Applications" page any time to see a live status for each application (e.g. action needed, under review, advanced, not selected). We don\'t send status emails or texts yet, so the My Applications page is currently the only place this updates.',
  },
  {
    q: 'Can I apply to more than one job?',
    a: 'Yes, and you don\'t have to start from scratch each time — when you apply to a second role, we pre-fill your information from your most recent application so you only need to review and adjust it, not retype everything.',
  },
  {
    q: 'Can I edit my application after submitting it?',
    a: 'Not directly — applications are locked once submitted so HR is always reviewing the version you intended to send. If you need to correct something important, reach out via Contact Us and HR can advise on next steps.',
  },
  {
    q: 'How is my application evaluated?',
    a: 'As part of our recruitment process, we use AI tools to help screen and assess applications against each role\'s stated qualifications and screening criteria — matching what you\'ve written against what the role actually needs, not just exact keyword matches. A member of our HR team still reviews candidates before any decision is made.',
  },
  {
    q: 'What documents or IDs do I need to prepare?',
    a: 'For most roles, nothing needs to be uploaded up front — driving-related roles ask you to state your license type, restriction codes, and related qualifications directly in the form. Physical documents (e.g. NBI clearance, license copy) are typically verified later in the process, not at initial application.',
  },
  {
    q: 'Is my information kept private?',
    a: 'Your application data is only visible to authorized HR staff reviewing candidates for the role(s) you applied to. See our Privacy Policy for full details.',
  },
  {
    q: 'I need accommodations during the application process — who do I contact?',
    a: 'Victory Liner is committed to an inclusive, accessible recruitment process. If you require reasonable accommodations at any stage, reach out via Contact Us and our HR team will assist.',
  },
];

function FAQItem({ index, item, open, onToggle }) {
  return (
    <div className="fade-in-up" style={{ animationDelay: `${Math.min(index, 6) * 0.06}s`, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '20px 26px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)',
        }}
      >
        {item.q}
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: 'transform 0.25s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div style={{ maxHeight: open ? 400 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ margin: 0, padding: '0 26px 22px', fontSize: 'var(--text-sm)', lineHeight: 1.7, opacity: 0.85 }}>{item.a}</p>
      </div>
    </div>
  );
}

export function FAQ({ nav }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header nav={nav} /></div>
      <section style={{ maxWidth: 820, margin: '70px auto 0', padding: '0 20px' }}>
        <div className="fade-in-up" style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 8 }}>
            Help Center
          </div>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--text-5xl)', margin: '0 0 12px' }}>Frequently Asked Questions</h1>
          <p style={{ fontSize: 'var(--text-md)', opacity: 0.7, margin: 0 }}>Everything you need to know about applying to Victory Liner.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 50 }}>
          {FAQS.map((item, i) => (
            <FAQItem key={item.q} index={i} item={item} open={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? -1 : i)} />
          ))}
        </div>

        <div className="fade-in-up" style={{ textAlign: 'center', background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '36px 28px', marginBottom: 70 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)' }}>Still have questions?</h3>
          <p style={{ margin: '0 0 20px', fontSize: 'var(--text-sm)', opacity: 0.7 }}>Our HR team is happy to help with anything not covered here.</p>
          <Button variant="ghost" size="sm" onClick={() => nav('filter')}>Browse Open Positions</Button>
        </div>
      </section>
      <Footer nav={nav} />
    </div>
  );
}
export default FAQ;
