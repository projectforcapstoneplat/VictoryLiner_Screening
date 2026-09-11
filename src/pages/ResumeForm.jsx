// Standalone resume — filled once, before choosing any job, per the
// "resume-first" flow: sign up -> basic info + resume -> AI shows which open
// jobs match. This page doesn't know the target role yet, so every section
// is shown and nothing role-specific (license type, etc.) is required to
// submit — the one and only apply path is Job Details' Apply Now, which only
// unlocks once the AI has actually matched this resume to that job.
//
// Split into steps (one section group visible at a time, Back/Next between
// them) rather than one long scroll — the full form has 8 sections, which
// read as overwhelming all at once on first landing on the site.
import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Select } from '../components/core/Select/Select.jsx';
import { FormError } from '../components/feedback/FormError/FormError.jsx';
import {
  FadeSection, EMPTY_EXPERIENCE, EMPTY_EDUCATION, EMPTY_CERTIFICATION, EDUCATION_LEVELS,
  LICENSE_RESTRICTION_CODES, isPhoneValid, SECTION_STYLE, GRID_2COL, FIELD_STYLE, SECTION_ICONS,
  SectionHeader, RepeatableSection, TagInput,
} from '../components/forms/ResumeFields/ResumeFields.jsx';
import { getMyResume, upsertMyResume } from '../lib/applicantResume.js';
import { clearMyMatches } from '../lib/resumeMatches.js';

const STEP_TITLES = ['Basic Information', 'Work Experience', 'Education', 'Skills', 'Qualifications', 'Certifications & Summary'];
const LAST_STEP = STEP_TITLES.length - 1;

// full_name stays one column in the DB (applicant_resumes.full_name, same
// as applications/profiles elsewhere in the app) — only the form itself
// splits it into two fields, for a more resume-like feel on entry. Split is
// best-effort: first word is the first name, everything else is the last
// name, which is right for the vast majority of names but not a hard
// guarantee (multi-word first names, etc.) — acceptable since the applicant
// can always just retype it correctly in either box.
function splitFullName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function StepProgress({ step }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', opacity: 0.6, marginBottom: 6 }}>
        <span>Step {step + 1} of {STEP_TITLES.length}</span>
        <span>{STEP_TITLES[step]}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-page-alt)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${((step + 1) / STEP_TITLES.length) * 100}%`, background: 'var(--action-primary-bg)',
          borderRadius: 999, transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>
    </div>
  );
}

export function ResumeForm({ profile, nav, onResumeSaved }) {
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(0);
  // Cached match scores were computed against whatever the resume looked
  // like before this editing session started — the moment any step actually
  // gets saved, those scores describe a resume that no longer exists. Only
  // handleSubmit (the final step) used to clear them, so an applicant who
  // edited several steps' worth of real changes and then abandoned before
  // reaching the last step left every job showing a stale match percentage
  // indefinitely (match-resume-to-jobs never re-scores a job that already
  // has a cached row). Tracked so this only fires once per editing session,
  // not on every single "Next" click.
  const matchesInvalidatedRef = useRef(false);
  const [firstName, setFirstName] = useState(() => splitFullName(profile?.full_name).firstName);
  const [lastName, setLastName] = useState(() => splitFullName(profile?.full_name).lastName);
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [workExperience, setWorkExperience] = useState([{ ...EMPTY_EXPERIENCE }]);
  const [educationLevel, setEducationLevel] = useState('');
  const [education, setEducation] = useState([{ ...EMPTY_EDUCATION }]);
  const [certifications, setCertifications] = useState([{ ...EMPTY_CERTIFICATION }]);
  const [skills, setSkills] = useState([]);
  const [summary, setSummary] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [licenseRestrictions, setLicenseRestrictions] = useState([]);
  const [yearsDriving, setYearsDriving] = useState('');
  const [nbiClearance, setNbiClearance] = useState(false);
  const [willingShifting, setWillingShifting] = useState(false);
  const [medicalCertificate, setMedicalCertificate] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  // Revisiting this page (e.g. to update a resume already on file) loads
  // what's there instead of showing a blank form again.
  useEffect(() => {
    if (!profile?.id) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    getMyResume(profile.id).then(({ data }) => {
      if (cancelled) return;
      if (data) {
        const { firstName: fn, lastName: ln } = splitFullName(data.full_name || profile.full_name);
        setFirstName(fn);
        setLastName(ln);
        setEmail(data.email || profile.email || '');
        setPhone(data.phone || '');
        setCurrentLocation(data.current_location || '');
        if (data.work_experience?.length) setWorkExperience(data.work_experience);
        setEducationLevel(data.education_level || '');
        if (data.education?.length) setEducation(data.education);
        if (data.certifications?.length) setCertifications(data.certifications);
        if (data.skills?.length) setSkills(data.skills);
        setSummary(data.summary || '');
        setLicenseType(data.drivers_license_type || '');
        setLicenseRestrictions(data.drivers_license_restrictions || []);
        setYearsDriving(data.years_driving_experience != null ? String(data.years_driving_experience) : '');
        setNbiClearance(data.has_nbi_clearance ?? false);
        setWillingShifting(data.willing_shifting_schedule ?? false);
        setMedicalCertificate(data.has_medical_certificate ?? false);
        setEditing(true);
        // A genuinely finished resume being revisited starts at step 0 (an
        // "update" pass, not a continuation) — only an in-progress draft
        // (never reached Save) resumes at the step it was left on.
        if (!data.completed_at) {
          setIsDraft(true);
          setStep(Math.min(data.last_step || 0, LAST_STEP));
        }
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const updateEntry = (setter) => (index, key, value) => {
    setter((entries) => entries.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)));
  };
  const addEntry = (setter, empty) => () => setter((entries) => [...entries, { ...empty }]);
  const removeEntry = (setter) => (index) => setter((entries) => entries.filter((_, i) => i !== index));

  // Only the fields visible on that step get gated — Work Experience and
  // Qualifications are optional sections, so their steps never block Next.
  // The one cross-step rule (at least one work experience OR education
  // entry) can't be pinned to a single step, so it's checked at final save
  // instead, alongside everything else handleSubmit already validates.
  function validateStep(s) {
    if (s === 0) {
      const missing = [];
      if (!firstName.trim()) missing.push('first name');
      if (!lastName.trim()) missing.push('last name');
      if (!email.trim()) missing.push('email address');
      if (missing.length) return `Please enter your ${missing.join(' and ')}.`;
      if (phone.trim() && !isPhoneValid(phone)) return 'Please enter a valid PH mobile number, e.g. 0912 345 6789.';
    }
    if (s === 2 && !educationLevel) return 'Please select your highest educational attainment.';
    if (s === 3 && skills.length === 0) return 'Please list at least a few skills.';
    return '';
  }

  // Shared by the per-step autosave and the final save — `completed_at` is
  // deliberately NOT part of this shape: omitting a column from a Supabase
  // upsert leaves its existing DB value untouched, which is exactly what
  // draft autosaves need (never flip a finished resume back to "incomplete"
  // mid-edit, never mark a brand-new one "complete" before Save is clicked).
  const buildResumePayload = () => ({
    full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
    email,
    phone,
    current_location: currentLocation.trim() || null,
    work_experience: workExperience.filter((e) => e.company || e.position),
    education_level: educationLevel,
    education: education.filter((e) => e.school || e.degree),
    skills,
    certifications: certifications.filter((c) => c.title),
    summary,
    drivers_license_type: licenseType || null,
    drivers_license_restrictions: licenseRestrictions,
    years_driving_experience: yearsDriving !== '' ? Number(yearsDriving) : null,
    has_nbi_clearance: nbiClearance,
    willing_shifting_schedule: willingShifting,
    has_medical_certificate: medicalCertificate,
  });

  const handleNext = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    const nextStep = Math.min(step + 1, LAST_STEP);
    setStep(nextStep);
    window.scrollTo(0, 0);
    // Fire-and-forget — progress is a convenience, not something worth
    // making the applicant wait on before they can keep moving. Worst case
    // of a failed autosave is losing just this one step's checkpoint, not
    // the whole session.
    upsertMyResume(profile.id, { ...buildResumePayload(), last_step: nextStep });
    if (!matchesInvalidatedRef.current) {
      matchesInvalidatedRef.current = true;
      clearMyMatches(profile.id);
    }
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    setError('');
    const filteredExperience = workExperience.filter((e) => e.company || e.position);
    const filteredEducation = education.filter((e) => e.school || e.degree);
    if (filteredExperience.length === 0 && filteredEducation.length === 0) {
      setError('Please add at least one work experience or education entry.');
      return;
    }
    setSubmitting(true);
    const { error: saveError } = await upsertMyResume(profile.id, {
      ...buildResumePayload(),
      last_step: LAST_STEP,
      completed_at: new Date().toISOString(),
    });
    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    // Cached match scores were computed against the resume as it was before
    // this save — clear them so the next time the applicant asks to be
    // matched, it recomputes fresh against what was just changed instead of
    // showing stale scores.
    await clearMyMatches(profile.id);
    // App.jsx's own hasResume only refetches when `profile` itself changes,
    // which this save doesn't trigger — without this, its landing-page gate
    // would still think no resume exists and bounce back here the next time
    // the applicant navs to 'home' instead of through to the homepage.
    onResumeSaved?.();
    // Matching is applicant-triggered now (the "Match Me to a Job" button on
    // Homepage), not something shown automatically right after saving.
    nav('home');
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
        <FadeSection delay={0.1} style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', borderRadius: 20, padding: 'clamp(24px, 5vw, 60px) clamp(16px, 5vw, 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 8px' }}>
                {isDraft ? 'Continue Your Resume' : editing ? 'Update Your Resume' : 'Build Your Resume'}
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', opacity: 0.65, margin: 0 }}>
                {isDraft
                  ? "Welcome back — we picked up right where you left off."
                  : "Fill this out once — our AI will match it against every open position for you, so you don't have to re-enter the same information for each job."}
              </p>
            </div>

            <StepProgress step={step} />

            <div key={step} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {step === 0 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.basic} title="Basic Information" />
                  <div style={GRID_2COL}>
                    <Input label="First Name:" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    <Input label="Last Name:" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Input label="Phone Number:" type="tel" placeholder="0912 345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} hint="Philippine mobile number — HR will use this to contact you." />
                    <Input label="Current Location (City / Province):" value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)} placeholder="e.g. Quezon City" />
                  </div>
                </FadeSection>
              )}

              {step === 1 && (
                <RepeatableSection
                  title="Work Experience"
                  hint="Optional — leave this blank if you're a fresh graduate or don't have work experience yet. Just fill in Education instead."
                  icon={SECTION_ICONS.experience}
                  delay={0}
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
              )}

              {step === 2 && (
                <>
                  <FadeSection delay={0} style={SECTION_STYLE}>
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
                    delay={0.06}
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
                </>
              )}

              {step === 3 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.skills} title="Skills" />
                  <TagInput
                    label="Skills:"
                    values={skills}
                    onChange={setSkills}
                    placeholder="Type a skill and press Enter — e.g. Customer Service, Defensive Driving"
                    hint="Press Enter or comma after each skill so it becomes its own tag — or paste a comma-separated list from an old resume."
                  />
                </FadeSection>
              )}

              {step === 4 && (
                <>
                  <FadeSection delay={0} style={SECTION_STYLE}>
                    <SectionHeader
                      icon={SECTION_ICONS.driving}
                      title="Driving Qualifications (if applicable)"
                      hint="Only fill this in if you hold a driver's license — skip it otherwise."
                    />
                    <div style={GRID_2COL}>
                      <Select
                        label="Driver's License Type:"
                        value={licenseType}
                        onChange={(e) => setLicenseType(e.target.value)}
                        options={['Non-Professional', 'Professional']}
                        placeholder="Select license type (optional)"
                      />
                      <Input label="Years of Driving Experience:" type="number" min="0" value={yearsDriving} onChange={(e) => setYearsDriving(e.target.value)} />
                    </div>
                    {licenseType && (
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
                    )}
                  </FadeSection>

                  <FadeSection delay={0.06} style={SECTION_STYLE}>
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
                </>
              )}

              {step === 5 && (
                <>
                  <RepeatableSection
                    title="Certifications (optional)"
                    icon={SECTION_ICONS.certifications}
                    delay={0}
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
                  <FadeSection delay={0.06} style={SECTION_STYLE}>
                    <SectionHeader icon={SECTION_ICONS.note} title="Professional Summary (optional)" hint="A short intro about yourself — not tied to any one job." />
                    <textarea value={summary} onChange={(e) => setSummary(e.target.value)} style={{ ...FIELD_STYLE, minHeight: 100, resize: 'vertical' }} />
                  </FadeSection>
                </>
              )}

              <FormError message={error} />
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                {step > 0 && (
                  <Button variant="ghost" size="lg" onClick={handleBack} disabled={submitting} style={{ width: 'auto', flex: '0 0 110px' }}>
                    Back
                  </Button>
                )}
                {step < LAST_STEP ? (
                  <Button variant="strong" size="lg" onClick={handleNext} style={{ width: 'auto', flex: 1 }}>
                    Next
                  </Button>
                ) : (
                  <Button variant="strong" size="lg" onClick={handleSubmit} disabled={submitting} style={{ width: 'auto', flex: 1 }}>
                    {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Save Resume'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </FadeSection>
      </section>
      <div style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default ResumeForm;
