// My Information / Resume — Stepper step 2, right after Sign In on the apply flow.
// Collected as a structured questionnaire (not a file upload) so the qualifications
// text stays clean and consistent for the future NLP resume-analysis stage.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Select } from '../components/core/Select/Select.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { submitApplication, getApplicationForJob, getMostRecentApplication } from '../lib/applications.js';

// Sections stagger in on mount via the shared `.fade-in-up` keyframe (see
// styles.css), not scroll-triggered `Reveal` — this is a required form, not a
// marketing page, so every field must be reliably visible regardless of how
// the user scrolls (a fast/instant scroll can skip the intermediate frames
// IntersectionObserver needs, which would leave a Reveal-wrapped section
// stuck invisible). Mount-time animation can't have that failure mode.
function FadeSection({ delay, style, children }) {
  return <div className="fade-in-up" style={{ animationDelay: `${delay}s`, ...style }}>{children}</div>;
}

const EMPTY_EXPERIENCE = { company: '', position: '', startDate: '', endDate: '', description: '' };
const EMPTY_EDUCATION = { school: '', degree: '', yearGraduated: '' };
const EMPTY_CERTIFICATION = { title: '', issuer: '', year: '' };

// Bus-driving-specific fields only make sense for the driving role itself —
// asking an Accounting applicant for a driver's license type is just noise.
const DRIVING_CATEGORIES = new Set(['Bus Driver']);
// Broader set of customer/operations-facing roles where a shifting schedule
// and a clearance are actually relevant screening facts.
const FRONTLINE_CATEGORIES = new Set([
  'Bus Driver', 'Conductor', 'Terminal Operations Staff', 'Dispatcher / Trip Scheduler',
  'Customer Service / Ticketing', 'Cashier / Teller', 'Security Guard', 'Safety & Compliance Inspector',
]);

// LTO driver's license restriction codes relevant to a bus operator (skips
// the tricycle-only codes 1/8, not applicable here).
const EDUCATION_LEVELS = [
  'High School Graduate',
  'Vocational / TESDA Graduate',
  'College Undergraduate',
  "College Graduate (Bachelor's Degree)",
  'Post-Graduate',
];

const LICENSE_RESTRICTION_CODES = [
  { code: '2', label: '2 — up to 4,500 kg GVW' },
  { code: '3', label: '3 — above 4,500 kg GVW' },
  { code: '4', label: '4 — automatic, up to 4,500 kg' },
  { code: '5', label: '5 — automatic, above 4,500 kg' },
  { code: '6', label: '6 — articulated, up to 4,500 kg' },
  { code: '7', label: '7 — articulated, above 4,500 kg' },
];

function isPhoneValid(phone) {
  const digits = phone.replace(/[\s-]/g, '');
  return /^(\+63|0)9\d{9}$/.test(digits);
}

const SECTION_STYLE = { display: 'flex', flexDirection: 'column', gap: 14, width: '100%' };
// Two-per-row layout for short fields (Name/Email, Company/Position, dates,
// etc.) so the form reads as a compact grid instead of one long single-column
// scroll. Plain `minmax(120px, 1fr)` packs in as MANY 120px+ columns as fit —
// on a wide screen that means 3-4 columns, not 2, cramming fields together.
// `max(120px, (100% - gap)/2)` pins each column's floor at half the row
// width (never above 120px on tiny screens), so at most 2 columns can ever
// fit — auto-fit only drops to 1 column when even 120px x2 doesn't fit.
const GRID_2COL = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(max(120px, (100% - 12px) / 2), 1fr))', gap: 12, width: '100%' };
const ENTRY_STYLE = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(max(120px, (100% - 10px) / 2), 1fr))', gap: 10, padding: 'clamp(14px, 4vw, 20px)', background: 'var(--surface-page)', borderRadius: 4 };
const FIELD_STYLE = {
  width: '100%', boxSizing: 'border-box', padding: '12px 18px',
  background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
  border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
};

const ICON_PROPS = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const SECTION_ICONS = {
  basic: <svg {...ICON_PROPS}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>,
  experience: <svg {...ICON_PROPS}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  education: <svg {...ICON_PROPS}><path d="M2 9l10-5 10 5-10 5-10-5z" /><path d="M6 11.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" /></svg>,
  skills: <svg {...ICON_PROPS}><path d="M12 2l2.6 6.6L21 9.3l-5 4.5 1.4 7.2L12 17.5 6.6 21l1.4-7.2-5-4.5 6.4-.7z" /></svg>,
  driving: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4.5V9M12 15v4.5M5.5 8.5l3.8 2.4M14.7 13.1l3.8 2.4M18.5 8.5l-3.8 2.4M9.3 13.1l-3.8 2.4" /></svg>,
  preferences: <svg {...ICON_PROPS}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  certifications: <svg {...ICON_PROPS}><circle cx="12" cy="9" r="6" /><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" /></svg>,
  note: <svg {...ICON_PROPS}><path d="M5 3h11l3 3v15H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>,
};

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon && (
        <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </span>
      )}
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{title}</span>
    </div>
  );
}

function RepeatableSection({ title, icon, delay, entries, fields, onChange, onAdd, onRemove, addLabel }) {
  return (
    <FadeSection delay={delay} style={SECTION_STYLE}>
      <SectionHeader icon={icon} title={title} />
      {entries.map((entry, i) => (
        <div key={i} style={ENTRY_STYLE}>
          {fields.map(({ key, label, type, placeholder }) => (
            type === 'textarea' ? (
              <label key={key} style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)' }}>
                {label}
                <textarea
                  value={entry[key]}
                  onChange={(e) => onChange(i, key, e.target.value)}
                  placeholder={placeholder}
                  style={{ ...FIELD_STYLE, minHeight: 80, resize: 'vertical' }}
                />
              </label>
            ) : (
              <Input key={key} label={label} type={type} placeholder={placeholder} value={entry[key]} onChange={(e) => onChange(i, key, e.target.value)} />
            )
          ))}
          {entries.length > 1 && (
            <div style={{ gridColumn: '1 / -1' }}><Button variant="ghost" size="sm" onClick={() => onRemove(i)}>Remove</Button></div>
          )}
        </div>
      ))}
      <div><Button variant="ghost" size="sm" onClick={onAdd}>{addLabel}</Button></div>
    </FadeSection>
  );
}

// Chip-based multi-value input (skills) — reduces free-text typo/inconsistency
// noise ("Defensive driving" vs "defensive-driving") compared to a single
// comma-separated field, without needing a fixed skills taxonomy.
function TagInput({ label, values, onChange, placeholder, hint }) {
  const [draft, setDraft] = useState('');

  // Splits on comma at commit time (not just on individual comma keypresses)
  // so a pasted comma-separated list ("Customer Service, Defensive Driving")
  // — which never fires per-character keydown events — still becomes several
  // clean tags instead of one garbled one with commas baked into the text.
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) {
      if (!next.includes(p)) next.push(p);
    }
    onChange(next);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)' }}>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>}
      <div style={{ ...FIELD_STYLE, minHeight: 49, height: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 14px' }}>
        {values.map((v) => (
          <span key={v} className="chip-pop" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)',
            padding: '4px 10px', borderRadius: 999, background: 'var(--pink-100)', color: 'var(--red-700)',
          }}>
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 'var(--text-xs)', lineHeight: 1, fontWeight: 700 }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : ''}
          style={{ flex: 1, minWidth: 140, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', padding: '6px 0' }}
        />
      </div>
      {hint && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', opacity: 0.65 }}>{hint}</span>}
    </label>
  );
}

export function ApplicationForm({ job, profile, nav }) {
  const j = job || { title: 'Bus Conductor' };
  const [checking, setChecking] = useState(true);
  const [submittedApplication, setSubmittedApplication] = useState(null);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [workExperience, setWorkExperience] = useState([{ ...EMPTY_EXPERIENCE }]);
  const [educationLevel, setEducationLevel] = useState('');
  const [education, setEducation] = useState([{ ...EMPTY_EDUCATION }]);
  const [certifications, setCertifications] = useState([{ ...EMPTY_CERTIFICATION }]);
  const [skills, setSkills] = useState([]);
  const [coverNote, setCoverNote] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [licenseRestrictions, setLicenseRestrictions] = useState([]);
  const [yearsDriving, setYearsDriving] = useState('');
  const [nbiClearance, setNbiClearance] = useState(false);
  const [willingShifting, setWillingShifting] = useState(false);
  const [medicalCertificate, setMedicalCertificate] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const isDriving = DRIVING_CATEGORIES.has(j.category);
  const isFrontline = FRONTLINE_CATEGORIES.has(j.category);

  // A returning applicant who already submitted for this job should never
  // see a blank resume form again — send them straight to their interview.
  // Otherwise, pre-fill from their most recent application to a DIFFERENT
  // job (if any) so they aren't retyping work experience/education/skills
  // from scratch every time — cover note is deliberately left blank since it
  // should be tailored per job, not carried over.
  useEffect(() => {
    if (!job?.id || !profile?.id) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    getApplicationForJob(job.id, profile.id).then(({ data }) => {
      if (cancelled) return;
      if (data) {
        nav('interview', data);
        return;
      }
      getMostRecentApplication(profile.id).then(({ data: prev }) => {
        if (cancelled) return;
        if (prev) {
          setPhone(prev.phone || '');
          setCurrentLocation(prev.current_location || '');
          if (prev.work_experience?.length) setWorkExperience(prev.work_experience);
          setEducationLevel(prev.education_level || '');
          if (prev.education?.length) setEducation(prev.education);
          if (prev.certifications?.length) setCertifications(prev.certifications);
          if (prev.skills?.length) setSkills(prev.skills);
          setLicenseType(prev.drivers_license_type || '');
          setLicenseRestrictions(prev.drivers_license_restrictions || []);
          setYearsDriving(prev.years_driving_experience != null ? String(prev.years_driving_experience) : '');
          setNbiClearance(prev.has_nbi_clearance ?? false);
          setWillingShifting(prev.willing_shifting_schedule ?? false);
          setMedicalCertificate(prev.has_medical_certificate ?? false);
          setPrefilled(true);
        }
        setChecking(false);
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, profile]);

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
    const filteredExperience = workExperience.filter((e) => e.company || e.position);
    const filteredEducation = education.filter((e) => e.school || e.degree);
    if (filteredExperience.length === 0 && filteredEducation.length === 0) {
      setError('Please add at least one work experience or education entry.');
      return;
    }
    if (skills.length === 0) {
      setError('Please list at least a few skills.');
      return;
    }
    if (!educationLevel) {
      setError('Please select your highest educational attainment.');
      return;
    }
    if (phone.trim() && !isPhoneValid(phone)) {
      setError('Please enter a valid PH mobile number, e.g. 0912 345 6789.');
      return;
    }
    if (isDriving && !licenseType) {
      setError("Please select your driver's license type.");
      return;
    }
    if (isDriving && (yearsDriving === '' || Number(yearsDriving) < 0)) {
      setError('Please enter your years of driving experience.');
      return;
    }
    setSubmitting(true);
    const { data, error: submitError } = await submitApplication({
      jobId: job.id,
      applicantId: profile.id,
      fullName,
      email,
      phone,
      workExperience: filteredExperience,
      education: filteredEducation,
      certifications: certifications.filter((c) => c.title),
      skills,
      coverNote,
      driversLicenseType: isDriving ? licenseType : null,
      driversLicenseRestrictions: isDriving ? licenseRestrictions : [],
      yearsDrivingExperience: isDriving && yearsDriving !== '' ? Number(yearsDriving) : null,
      hasNbiClearance: isFrontline ? nbiClearance : null,
      willingShiftingSchedule: isFrontline ? willingShifting : null,
      educationLevel,
      currentLocation: currentLocation.trim() || null,
      hasMedicalCertificate: isFrontline ? medicalCertificate : null,
    });
    setSubmitting(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    // submitApplication doesn't join job_postings — the Interview screen
    // needs job.category to pick the right question bank, so attach it here
    // from the job we already have rather than re-querying.
    setSubmittedApplication({ ...data, job_postings: { title: job.title, category: job.category } });
    setSubmitted(true);
  };

  if (checking) {
    return (
      <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
        <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
        <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}><p>Loading…</p></section>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}>
        <FadeSection delay={0}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--action-primary-bg)', marginBottom: 6 }}>Applying For</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 400, marginBottom: 30 }}>{j.title}</div>
        </FadeSection>
        <div style={{ marginBottom: 50, padding: '0 clamp(8px, 4vw, 40px)' }}><Stepper current={1} /></div>
        <FadeSection delay={0.1} style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', borderRadius: 20, padding: 'clamp(24px, 5vw, 60px) clamp(16px, 5vw, 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, boxSizing: 'border-box' }}>
          {submitted ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 8px' }}>Application Submitted</h2>
              <p style={{ fontSize: 'var(--text-sm)' }}>Thanks for applying to {j.title}. Next, complete your video interview so HR can review your full application.</p>
              <Button variant="strong" size="lg" onClick={() => nav('interview', submittedApplication)}>Continue to Video Interview</Button>
              <Button variant="ghost" size="sm" onClick={() => nav('home')}>I'll do this later</Button>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 8px' }}>My Information / Resume</h2>
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.65, margin: 0 }}>The more detail you give, the more accurately our AI can match you to this role.</p>
              </div>
              {prefilled && (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--pink-100)', color: 'var(--red-700)', borderRadius: 12, padding: '12px 18px', fontSize: 'var(--text-sm)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M12 8v4M12 16h.01" /><circle cx="12" cy="12" r="9" />
                  </svg>
                  We've pre-filled this from your most recent application — feel free to update anything before submitting.
                </div>
              )}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <FadeSection delay={0.2} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.basic} title="Basic Information" />
                  <div style={GRID_2COL}>
                    <Input label="Full Name:" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Input label="Phone Number:" type="tel" placeholder="0912 345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} hint="Philippine mobile number — HR will use this to contact you." />
                    <Input label="Current Location (City / Province):" value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)} placeholder="e.g. Quezon City" />
                  </div>
                </FadeSection>

                <RepeatableSection
                  title="Work Experience"
                  icon={SECTION_ICONS.experience}
                  delay={0.26}
                  entries={workExperience}
                  fields={[
                    { key: 'company', label: 'Company:' },
                    { key: 'position', label: 'Position:' },
                    { key: 'startDate', label: 'Start Date:', type: 'date' },
                    { key: 'endDate', label: 'End Date (leave blank if current):', type: 'date' },
                    { key: 'description', label: 'Description:', type: 'textarea', placeholder: 'e.g. Drove provincial routes, maintained zero at-fault accidents, assisted passengers with special needs' },
                  ]}
                  onChange={updateEntry(setWorkExperience)}
                  onAdd={addEntry(setWorkExperience, EMPTY_EXPERIENCE)}
                  onRemove={removeEntry(setWorkExperience)}
                  addLabel="+ Add Work Experience"
                />

                <FadeSection delay={0.32} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.education} title="Highest Educational Attainment" />
                  <Select
                    label="Highest Educational Attainment:"
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    options={EDUCATION_LEVELS}
                    placeholder="Select attainment level"
                  />
                </FadeSection>

                <RepeatableSection
                  title="Education"
                  icon={SECTION_ICONS.education}
                  delay={0.38}
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

                <FadeSection delay={0.44} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.skills} title="Skills" />
                  <TagInput
                    label="Skills:"
                    values={skills}
                    onChange={setSkills}
                    placeholder="Type a skill and press Enter — e.g. Customer Service, Defensive Driving"
                    hint="Press Enter or comma after each skill so it becomes its own tag — or paste a comma-separated list from an old resume."
                  />
                </FadeSection>

                {isDriving && (
                  <FadeSection delay={0.5} style={SECTION_STYLE}>
                    <SectionHeader icon={SECTION_ICONS.driving} title="Driving Qualifications" />
                    <div style={GRID_2COL}>
                      <Select
                        label="Driver's License Type:"
                        value={licenseType}
                        onChange={(e) => setLicenseType(e.target.value)}
                        options={['Non-Professional', 'Professional']}
                        placeholder="Select license type"
                      />
                      <Input label="Years of Driving Experience:" type="number" min="0" value={yearsDriving} onChange={(e) => setYearsDriving(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 'var(--text-sm)' }}>License Restriction Codes:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {LICENSE_RESTRICTION_CODES.map(({ code, label }) => {
                          const active = licenseRestrictions.includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              className="btn-animate"
                              onClick={() => setLicenseRestrictions((codes) => (active ? codes.filter((c) => c !== code) : [...codes, code]))}
                              style={{
                                padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 'var(--text-xs)',
                                border: active ? 'none' : '1px solid var(--border-hairline)',
                                background: active ? 'var(--action-primary-bg)' : 'var(--surface-field)',
                                color: active ? '#fff' : 'var(--text-primary)',
                                transition: 'background 0.18s ease, color 0.18s ease, border-color 0.18s ease',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </FadeSection>
                )}

                {isFrontline && (
                  <FadeSection delay={0.56} style={SECTION_STYLE}>
                    <SectionHeader icon={SECTION_ICONS.preferences} title="Work Preferences" />
                    <label style={{ display: 'flex', gap: 10, fontSize: 'var(--text-sm)', alignItems: 'center' }}>
                      <input type="checkbox" checked={nbiClearance} onChange={(e) => setNbiClearance(e.target.checked)} />
                      I have a valid NBI or Police Clearance
                    </label>
                    <label style={{ display: 'flex', gap: 10, fontSize: 'var(--text-sm)', alignItems: 'center' }}>
                      <input type="checkbox" checked={willingShifting} onChange={(e) => setWillingShifting(e.target.checked)} />
                      I am willing to work a shifting schedule (including weekends/holidays)
                    </label>
                    <label style={{ display: 'flex', gap: 10, fontSize: 'var(--text-sm)', alignItems: 'center' }}>
                      <input type="checkbox" checked={medicalCertificate} onChange={(e) => setMedicalCertificate(e.target.checked)} />
                      I have a valid Medical / Physical Fitness Certificate
                    </label>
                  </FadeSection>
                )}

                <RepeatableSection
                  title="Certifications (optional)"
                  icon={SECTION_ICONS.certifications}
                  delay={0.62}
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

                <FadeSection delay={0.68} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.note} title="Cover Note (optional)" />
                  <textarea value={coverNote} onChange={(e) => setCoverNote(e.target.value)} style={{
                    width: '100%', boxSizing: 'border-box', padding: '12px 18px', minHeight: 100,
                    background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
                    border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', resize: 'vertical',
                  }} />
                </FadeSection>

                {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
                <Button variant="strong" size="lg" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Application'}</Button>
              </div>
            </>
          )}
          </div>
        </FadeSection>
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default ApplicationForm;