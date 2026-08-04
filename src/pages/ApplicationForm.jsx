// My Information / Resume — Stepper step 2, right after Sign In on the apply flow.
// Collected as a structured questionnaire (not a file upload) so the qualifications
// text stays clean and consistent for the future NLP resume-analysis stage.
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { submitApplication } from '../lib/applications.js';
import logo from '../assets/logo.png';

const EMPTY_EXPERIENCE = { company: '', position: '', startDate: '', endDate: '', description: '' };
const EMPTY_EDUCATION = { school: '', degree: '', yearGraduated: '' };
const EMPTY_CERTIFICATION = { title: '', issuer: '', year: '' };

const SECTION_STYLE = { display: 'flex', flexDirection: 'column', gap: 16, width: '100%' };
const ENTRY_STYLE = { display: 'flex', flexDirection: 'column', gap: 12, padding: 20, background: 'var(--surface-page)', borderRadius: 4 };

function RepeatableSection({ title, entries, fields, onChange, onAdd, onRemove, addLabel }) {
  return (
    <div style={SECTION_STYLE}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{title}</span>
      {entries.map((entry, i) => (
        <div key={i} style={ENTRY_STYLE}>
          {fields.map(({ key, label, type }) => (
            <Input key={key} label={label} type={type} value={entry[key]} onChange={(e) => onChange(i, key, e.target.value)} />
          ))}
          {entries.length > 1 && (
            <div><Button variant="ghost" size="sm" onClick={() => onRemove(i)}>Remove</Button></div>
          )}
        </div>
      ))}
      <div><Button variant="ghost" size="sm" onClick={onAdd}>{addLabel}</Button></div>
    </div>
  );
}

export function ApplicationForm({ job, profile, nav }) {
  const j = job || { title: 'Bus Conductor' };
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState('');
  const [workExperience, setWorkExperience] = useState([{ ...EMPTY_EXPERIENCE }]);
  const [education, setEducation] = useState([{ ...EMPTY_EDUCATION }]);
  const [certifications, setCertifications] = useState([{ ...EMPTY_CERTIFICATION }]);
  const [skillsText, setSkillsText] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateEntry = (setter) => (index, key, value) => {
    setter((entries) => entries.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)));
  };
  const addEntry = (setter, empty) => () => setter((entries) => [...entries, { ...empty }]);
  const removeEntry = (setter) => (index) => setter((entries) => entries.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required.');
      return;
    }
    setSubmitting(true);
    const { error: submitError } = await submitApplication({
      jobId: job.id,
      applicantId: profile.id,
      fullName,
      email,
      phone,
      workExperience: workExperience.filter((e) => e.company || e.position),
      education: education.filter((e) => e.school || e.degree),
      certifications: certifications.filter((c) => c.title),
      skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
      coverNote,
    });
    setSubmitting(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    setSubmitted(true);
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header logo={logo} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 400, marginBottom: 30 }}>{j.title}</div>
        <div style={{ marginBottom: 50, padding: '0 40px' }}><Stepper current={1} /></div>
        <div style={{ background: 'var(--off-white-100)', borderRadius: 4, padding: '60px 80px', maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          {submitted ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 8px' }}>Application Submitted</h2>
              <p style={{ fontSize: 'var(--text-sm)' }}>Thanks for applying to {j.title}. We'll follow up by email with next steps.</p>
              <Button variant="strong" size="lg" onClick={() => nav('home')}>Back to Home</Button>
            </div>
          ) : (
            <>
              <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 20px' }}>My Information / Resume</h2>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div style={SECTION_STYLE}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Basic Information</span>
                  <Input label="Full Name:" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Input label="Phone Number:" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>

                <RepeatableSection
                  title="Work Experience"
                  entries={workExperience}
                  fields={[
                    { key: 'company', label: 'Company:' },
                    { key: 'position', label: 'Position:' },
                    { key: 'startDate', label: 'Start Date:', type: 'date' },
                    { key: 'endDate', label: 'End Date (leave blank if current):', type: 'date' },
                    { key: 'description', label: 'Description:' },
                  ]}
                  onChange={updateEntry(setWorkExperience)}
                  onAdd={addEntry(setWorkExperience, EMPTY_EXPERIENCE)}
                  onRemove={removeEntry(setWorkExperience)}
                  addLabel="+ Add Work Experience"
                />

                <RepeatableSection
                  title="Education"
                  entries={education}
                  fields={[
                    { key: 'school', label: 'School:' },
                    { key: 'degree', label: 'Degree / Course:' },
                    { key: 'yearGraduated', label: 'Year Graduated:' },
                  ]}
                  onChange={updateEntry(setEducation)}
                  onAdd={addEntry(setEducation, EMPTY_EDUCATION)}
                  onRemove={removeEntry(setEducation)}
                  addLabel="+ Add Education"
                />

                <div style={SECTION_STYLE}>
                  <Input label="Skills (comma-separated):" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="e.g. Customer Service, Defensive Driving, Ticketing Systems" />
                </div>

                <RepeatableSection
                  title="Certifications (optional)"
                  entries={certifications}
                  fields={[
                    { key: 'title', label: 'Title:' },
                    { key: 'issuer', label: 'Issuer:' },
                    { key: 'year', label: 'Year:' },
                  ]}
                  onChange={updateEntry(setCertifications)}
                  onAdd={addEntry(setCertifications, EMPTY_CERTIFICATION)}
                  onRemove={removeEntry(setCertifications)}
                  addLabel="+ Add Certification"
                />

                <div style={SECTION_STYLE}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)' }}>
                    Cover Note (optional):
                    <textarea value={coverNote} onChange={(e) => setCoverNote(e.target.value)} style={{
                      width: '100%', boxSizing: 'border-box', padding: '12px 18px', minHeight: 100,
                      background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
                      border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', resize: 'vertical',
                    }} />
                  </label>
                </div>

                {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
                <Button variant="strong" size="lg" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Application'}</Button>
              </div>
            </>
          )}
        </div>
      </section>
      <div style={{ marginTop: 60 }}><Footer logo={logo} /></div>
    </div>
  );
}
export default ApplicationForm;