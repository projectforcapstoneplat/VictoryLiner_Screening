// Careers FAQ: the footer used to link here and do nothing (href="#",
// preventDefault). Content is grounded in what this system actually does
// (structured resume with optional file upload, video interview,
// AI-assisted screening, automatic status emails) rather than generic
// filler, so it doesn't promise anything the site doesn't actually deliver.
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';

const FAQS = [
  {
    q: 'How do I apply for a job?',
    a: 'Create an account (or sign in) and fill out your "My Resume" profile once: work experience, education, skills, and more. Our AI then shows you which open positions actually match your background; clicking "Apply Now" on a matching job submits instantly using that saved profile, no retyping. If your resume clears that role\'s minimum match score, your video interview unlocks right away.',
  },
  {
    q: 'Do I need to upload a resume file?',
    a: 'Not required, but you can. Fill out the "My Resume" form by hand, or upload a PDF/Word resume and we\'ll automatically read it and fill the form in for you. You just review and correct anything before saving. Either way, your information ends up in the same clean, structured format rather than a scanned or hard-to-parse file.',
  },
  {
    q: 'What is the video interview, and can I re-record my answers?',
    a: 'You\'ll record short video answers to a set of questions for the role, one at a time. Each stays hidden until you click Start, so nobody gets extra time to prepare or look anything up. You get up to 3 attempts per question, whether you re-record before or after submitting, right up until HR makes a decision. Once every question is submitted, there\'s no further editing; HR reviews from there.',
  },
  {
    q: 'What do I need before starting my video interview?',
    a: 'A working camera and microphone, and a reasonably stable internet connection, since you\'ll be uploading a video after each answer. Right before your first question, you\'ll see a short walkthrough of how the interview works (watch the video, or just read the summary), then a quick on-screen check confirming your camera, microphone, and connection all look good.',
  },
  {
    q: 'Will I be notified about my application status?',
    a: 'Yes. Check the "My Application" page any time to see a live status for each application (e.g. action needed, under review, advanced, not selected). We also email you automatically when your status changes or a deadline is coming up.',
  },
  {
    q: 'Can I apply to more than one job?',
    a: 'Yes. Your "My Resume" profile is saved once and reused for every job you apply to, so applying to another matching role is just a click from that job\'s page, with no re-entering your information. Once one of your applications reaches the video interview stage (or you\'re accepted), though, new applications are paused until that one is resolved, so you\'re never juggling more than one active interview at a time.',
  },
  {
    q: 'Can I edit my application after submitting it?',
    a: 'Not directly. Applications are locked once submitted so HR is always reviewing the version you intended to send. If you need to correct something important, reach out via Contact Us and HR can advise on next steps.',
  },
  {
    q: 'How is my application evaluated?',
    a: 'As part of our recruitment process, we use AI tools to help screen and assess applications against each role\'s stated qualifications and screening criteria, matching what you\'ve written against what the role actually needs, not just exact keyword matches. A member of our HR team still reviews candidates before any decision is made.',
  },
  {
    q: 'What documents or IDs do I need to prepare?',
    a: 'For most roles, nothing needs to be uploaded up front. Driving-related roles ask you to state your license type, restriction codes, and related qualifications directly in the form. Physical documents (e.g. NBI clearance, license copy) are typically verified later in the process, not at initial application.',
  },
  {
    q: 'Is my information kept private?',
    a: 'Your application data is only visible to authorized HR staff reviewing candidates for the role(s) you applied to. See our Privacy Policy for full details.',
  },
  {
    q: 'Who do I contact if I need accommodations during the application process?',
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
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap">
        <Header
          nav={nav}
          links={[
            { label: 'Contact Us', onClick: () => nav('contact') },
            { label: 'Back to Home', onClick: () => nav('home') },
          ]}
        />
      </div>
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
    </div>
  );
}
export default FAQ;
