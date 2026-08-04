// Careers job detail page — recreation of the Figma "Job details" frame
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Badge } from '../components/core/Badge/Badge.jsx';
import { Breadcrumb } from '../components/navigation/Breadcrumb/Breadcrumb.jsx';
import logo from '../assets/logo.png';

// Standard disclosures shown on every job posting — not something HR writes per job.
const STATIC_SECTIONS = [
  { h: 'Accommodations', body: 'Victory Liner is committed to providing an inclusive and accessible recruitment process. Applicants who require reasonable accommodations may request assistance at any stage of the recruitment process.' },
  { h: 'Artificial Intelligence', body: 'As part of our recruitment process, we may use artificial intelligence (AI) tools to assist in the screening and/or assessment of job applicants.' },
];

export function JobDetails({ job, nav }) {
  const j = job || { title: 'Bus Conductor', category: 'Operations' };
  const sections = [
    { h: 'Required Qualifications', body: j.required_qualifications },
    { h: 'Preferred Qualifications', body: j.preferred_qualifications },
  ].filter((s) => s.body);
  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header logo={logo} /></div>
      <section style={{ maxWidth: 1086, margin: '80px auto 0', padding: '0 20px' }}>
        <div onClick={() => nav('home')} style={{ cursor: 'pointer', marginBottom: 30 }}><Breadcrumb items={['Home', 'Job Details']} /></div>
        <h1 style={{ fontWeight: 600, fontSize: 'var(--text-5xl)', margin: '0 0 24px' }}>{j.title}</h1>
        <div style={{ marginBottom: 30 }}><Badge>{j.category}</Badge></div>
        <div style={{ marginBottom: 40 }}><Button variant="primary" size="md" onClick={() => nav('signin', j)}>Apply</Button></div>
        {j.description && (
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontWeight: 600, fontSize: 'var(--text-xl)', marginBottom: 12 }}>Key Responsibilities</h3>
            <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, maxWidth: 900, margin: 0 }}>{j.description}</p>
          </div>
        )}
        {[...sections, ...STATIC_SECTIONS].map((s, i) => (
          <div key={i} style={{ marginBottom: 40 }}>
            <h3 style={{ fontWeight: 600, fontSize: 'var(--text-xl)', marginBottom: 12 }}>{s.h}</h3>
            <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, maxWidth: 900, margin: 0 }}>{s.body}</p>
          </div>
        ))}
        <Button variant="primary" size="md" onClick={() => nav('signin', j)}>Apply</Button>
      </section>
      <div style={{ marginTop: 60 }}><Footer logo={logo} /></div>
    </div>
  );
}
export default JobDetails;
