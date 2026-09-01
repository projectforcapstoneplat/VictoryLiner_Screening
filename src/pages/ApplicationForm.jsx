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
import {
  FadeSection, EMPTY_EXPERIENCE, EMPTY_EDUCATION, EMPTY_CERTIFICATION, EDUCATION_LEVELS,
  LICENSE_RESTRICTION_CODES, isPhoneValid, SECTION_STYLE, GRID_2COL, SECTION_ICONS,
  SectionHeader, RepeatableSection, TagInput,
} from '../components/forms/ResumeFields/ResumeFields.jsx';
import { submitApplication, getApplicationForJob, getMostRecentApplication } from '../lib/applications.js';
import { getMyResume } from '../lib/applicantResume.js';

// Bus-driving-specific fields only make sense for the driving role itself —
// asking an Accounting applicant for a driver's license type is just noise.
const DRIVING_CATEGORIES = new Set(['Bus Driver']);
// Broader set of customer/operations-facing roles where a shifting schedule
// and a clearance are actually relevant screening facts.
const FRONTLINE_CATEGORIES = new Set([
  'Bus Driver', 'Conductor', 'Terminal Operations Staff', 'Dispatcher / Trip Scheduler',
  'Customer Service / Ticketing', 'Cashier / Teller', 'Security Guard', 'Safety & Compliance Inspector',
]);

export function ApplicationForm({ job, profile, nav }) {
  const j = job || { title: 'Bus Conductor' };
  const [checking, setChecking] = useState(true);
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
  // Otherwise, pre-fill from whichever source is more current: the
  // standalone resume built in ResumeForm.jsx (resume-first flow) takes
  // priority since it's the one the applicant most recently maintained;
  // falls back to their most recent per-job application for anyone who
  // applied before that standalone resume existed. Cover note/summary is
  // deliberately never carried over either way — it should be tailored per
  // job, not reused.
  useEffect(() => {
    if (!job?.id || !profile?.id) {
      setChecking(false);
      return;
    }
    let cancelled = false;

    const applyPrefill = (source) => {
      setPhone(source.phone || '');
      setCurrentLocation(source.current_location || '');
      if (source.work_experience?.length) setWorkExperience(source.work_experience);
      setEducationLevel(source.education_level || '');
      if (source.education?.length) setEducation(source.education);
      if (source.certifications?.length) setCertifications(source.certifications);
      if (source.skills?.length) setSkills(source.skills);
      setLicenseType(source.drivers_license_type || '');
      setLicenseRestrictions(source.drivers_license_restrictions || []);
      setYearsDriving(source.years_driving_experience != null ? String(source.years_driving_experience) : '');
      setNbiClearance(source.has_nbi_clearance ?? false);
      setWillingShifting(source.willing_shifting_schedule ?? false);
      setMedicalCertificate(source.has_medical_certificate ?? false);
      setPrefilled(true);
    };

    getApplicationForJob(job.id, profile.id).then(({ data }) => {
      if (cancelled) return;
      if (data) {
        nav('interview', data);
        return;
      }
      getMyResume(profile.id).then(({ data: resume }) => {
        if (cancelled) return;
        if (resume) {
          applyPrefill(resume);
          setChecking(false);
          return;
        }
        getMostRecentApplication(profile.id).then(({ data: prev }) => {
          if (cancelled) return;
          if (prev) applyPrefill(prev);
          setChecking(false);
        });
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
    const { error: submitError } = await submitApplication({
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
    setSubmitted(true);
  };

  if (checking) {
    return (
      <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
        <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} profile={profile} /></div>
        <section style={{ maxWidth: 1065, margin: '60px auto 0', padding: '0 20px' }}><p>Loading…</p></section>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header nav={nav} profile={profile} /></div>
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
              <p style={{ fontSize: 'var(--text-sm)' }}>Thanks for applying to {j.title}. We'll review your resume next — check My Applications to see your status and when your video interview unlocks.</p>
              <Button variant="strong" size="lg" onClick={() => nav('my-applications')}>View My Application</Button>
              <Button variant="ghost" size="sm" onClick={() => nav('home')}>Back to Home</Button>
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
                  hint="Optional — leave this blank if you're a fresh graduate or don't have work experience yet. Just fill in Education below instead."
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