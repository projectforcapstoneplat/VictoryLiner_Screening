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
import { uploadAndParseResume } from '../lib/resumeUpload.js';

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

// Auto-spaces as the applicant types — 0912 345 6789, matching the format
// shown in the field's own placeholder and what isPhoneValid expects once
// the spaces are stripped back out. Digits only, capped at 11 (the full
// length of a PH mobile number starting with 0) so it can't just keep
// growing past a real number if someone keeps typing or pastes something
// longer. Also used to normalize a phone number pulled from an uploaded
// resume, which can just as easily read "+63 917 234 5678" (international
// form, 12 digits) as the local "0917 234 5678" — without converting the
// country code back to a leading 0 first, an intl number would get its last
// digit truncated by the 11-digit cap and never pass isPhoneValid at all,
// which is exactly why an otherwise fully-filled Step 1 could still show as
// incomplete after an upload.
function formatPhoneInput(raw) {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('63')) {
    digits = `0${digits.slice(2)}`;
  }
  digits = digits.slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

const ARROW_LEFT_ICON = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
const PENCIL_ICON = <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const UPLOAD_ICON = <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>;

const STEP_CHECK_ICON = <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;

// A visible spinning ring while a resume upload is being read + parsed by
// Gemini — that round-trip can take several seconds, and the earlier
// "Reading your resume…" text-only swap wasn't enough on its own for it to
// read as *actively working* rather than possibly stuck.
const UPLOAD_SPINNER = (
  <span
    style={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
      border: '2.5px solid var(--pink-200)', borderTopColor: 'var(--action-primary-bg)',
      display: 'inline-block', animation: 'spin 0.7s linear infinite',
    }}
  />
);

// One label/value line on the final review screen — plain text, not an
// input, since this is meant to read as "here's what's about to be saved,"
// not another editable copy of the form.
function ReviewRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 'var(--text-sm)', padding: '4px 0' }}>
      <span style={{ opacity: 0.6, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

// Clickable so the applicant can jump straight to any section instead of
// clicking Next five times to reach, say, Certifications — no gating on
// completion, since "let me skip ahead and come back" is the whole point.
// isStepComplete drives a checkmark per step, not just current-step
// highlighting, using the same validateStep() the Next button already
// enforces — one source of truth for "is this section actually filled in,"
// not a second, separately-maintained definition of complete.
function StepProgress({ step, onStepClick, isStepComplete }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', opacity: 0.6, marginBottom: 12 }}>
        <span>Step {step + 1} of {STEP_TITLES.length}</span>
        <span>{STEP_TITLES[step]}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {STEP_TITLES.map((title, i) => {
          const complete = isStepComplete(i);
          const isCurrent = i === step;
          return (
            <div key={title} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_TITLES.length - 1 ? 1 : '0 0 auto' }}>
              <button
                type="button"
                onClick={() => onStepClick(i)}
                title={title}
                aria-label={`${title}${complete ? ' (complete)' : ''}${isCurrent ? ' — current step' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className="btn-animate"
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700,
                  border: isCurrent ? '2px solid var(--action-primary-bg)' : complete ? 'none' : '2px solid var(--gray-400)',
                  background: complete ? 'var(--action-primary-bg)' : 'var(--surface-card)',
                  color: complete ? '#fff' : isCurrent ? 'var(--action-primary-bg)' : 'var(--text-primary)',
                  opacity: complete || isCurrent ? 1 : 0.65,
                  transition: 'background 0.25s ease, border-color 0.25s ease, opacity 0.25s ease',
                }}
              >
                {complete ? STEP_CHECK_ICON : i + 1}
              </button>
              {i < STEP_TITLES.length - 1 && (
                <div style={{ flex: 1, height: 3, borderRadius: 999, margin: '0 2px', background: i < step ? 'var(--action-primary-bg)' : 'var(--surface-page-alt)', transition: 'background 0.3s ease' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResumeForm({ profile, nav, onResumeSaved }) {
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(0);

  // Same fix as SignIn.jsx: `height: 100vh` on the wrapper below isn't a
  // strong enough guarantee on its own — browser scrollbar reservation and
  // DPI/zoom rounding can still leave the real document a few px taller
  // than 100vh, producing a page-level scrollbar even though the card
  // itself already fits (or already has its own internal scroll for
  // whatever doesn't). Forcing the actual html/body box to the viewport
  // height while this page is mounted closes that gap outright, restored
  // the moment it unmounts.
  useEffect(() => {
    const { style } = document.documentElement;
    const bodyStyle = document.body.style;
    const prevHtmlOverflow = style.overflow;
    const prevBodyOverflow = bodyStyle.overflow;
    style.overflow = 'hidden';
    bodyStyle.overflow = 'hidden';
    return () => {
      style.overflow = prevHtmlOverflow;
      bodyStyle.overflow = prevBodyOverflow;
    };
  }, []);
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
  const [age, setAge] = useState('');
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
  // A read-only summary shown after Save Changes passes validation but
  // before anything is actually written — lets a typo, misclick, or missing
  // detail get caught right before it's committed, instead of only after.
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  // UI only for now, per explicit request — "Upload My Resume" has no
  // parsing logic behind it yet, so it's shown as a disabled-looking,
  // unclickable option (a design review step before that gets built) while
  // "Build It Manually" leads straight into the wizard below, since that's
  // just routing to what's already fully working, not new functionality.
  // Only relevant for a brand-new resume — revisiting/updating an existing
  // one (editing) always goes straight to the wizard, no choice needed.
  const [buildMethod, setBuildMethod] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  // Flips true right after an upload finishes pre-filling the wizard state —
  // a plain effect (below) picks it up on the next render, once React has
  // actually committed all those setXxx calls, and autosaves the result.
  // Calling upsertMyResume directly inside handleFileSelected instead would
  // read the *pre-update* closure values (setState isn't synchronous), so
  // it'd persist the wizard's state from before the upload, not after.
  const [justUploaded, setJustUploaded] = useState(false);
  const fileInputRef = useRef(null);
  // Which specific fields to outline in red — recomputed fresh on every
  // failed Next/Save attempt (not "live" as you type), so a field stays
  // flagged until you actually try to move on again, not just while it
  // happens to still be empty.
  const [invalidFields, setInvalidFields] = useState(new Set());

  // Revisiting this page (e.g. to update a resume already on file) loads
  // what's there instead of showing a blank form again. Deliberately keyed
  // on just profile?.id, not the whole profile object — Supabase silently
  // re-validates the session on tab focus, which hands App.jsx a new
  // profile object with identical data, and re-running this on THAT would
  // re-apply whatever step was last saved to the database, silently
  // snapping an applicant back to an old position mid-edit (e.g. after
  // navigating around freely via the step dots, which don't persist
  // last_step the way clicking Next does). This should only ever reload
  // once per actual user, not once per incidental object reference change.
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
        setAge(data.age != null ? String(data.age) : '');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Pre-fills the same state the manual wizard uses — from here on, an
  // uploaded resume and a manually-built one go through the exact same
  // review/edit/save flow. This does autosave the parsed draft (see the
  // justUploaded effect below) the same way advancing a step does — nothing
  // marks it *completed* until the applicant reaches the end and clicks Save
  // themselves, but leaving a freshly-parsed upload unsaved in memory only
  // meant losing it outright on a refresh before ever reaching that point.
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the same file again re-trigger onChange
    if (!file || !profile?.id) return;
    setUploadError('');
    setUploading(true);
    const { data, error: parseError } = await uploadAndParseResume(profile.id, file);
    setUploading(false);
    if (parseError) {
      setUploadError(parseError);
      return;
    }
    const { firstName: fn, lastName: ln } = splitFullName(data.fullName);
    if (fn) setFirstName(fn);
    if (ln) setLastName(ln);
    if (data.email) setEmail(data.email);
    if (data.phone) setPhone(formatPhoneInput(data.phone));
    if (data.currentLocation) setCurrentLocation(data.currentLocation);
    if (data.educationLevel) setEducationLevel(data.educationLevel);
    if (data.summary) setSummary(data.summary);
    if (data.skills?.length) setSkills(data.skills);
    if (data.workExperience?.length) {
      setWorkExperience(data.workExperience.map((w) => ({ ...EMPTY_EXPERIENCE, ...w })));
    }
    if (data.education?.length) {
      setEducation(data.education.map((ed) => ({ ...EMPTY_EDUCATION, ...ed })));
    }
    if (data.certifications?.length) {
      setCertifications(data.certifications.map((c) => ({ ...EMPTY_CERTIFICATION, ...c })));
    }
    setBuildMethod('manual');
    setJustUploaded(true);
  };

  useEffect(() => {
    if (!justUploaded) return;
    setJustUploaded(false);
    upsertMyResume(profile.id, { ...buildResumePayload(), last_step: step });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justUploaded]);

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
      if (!phone.trim()) missing.push('phone number');
      if (!currentLocation.trim()) missing.push('current location');
      if (!String(age).trim()) missing.push('age');
      if (missing.length) return `Please enter your ${missing.join(', ')}.`;
      if (!isPhoneValid(phone)) return 'Please enter a valid PH mobile number, e.g. 0912 345 6789.';
      if (Number(age) < 18) return 'You must be at least 18 years old to apply.';
    }
    if (s === 1) {
      // Work experience entries are optional overall (same as Education),
      // but match-resume-to-jobs computes total years of experience from
      // each entry's startDate — an entry with a company/position but no
      // start date silently gets skipped from that calculation entirely,
      // undercounting the applicant's real experience. Same "a started
      // entry must be finished" rule already applied to Education below.
      if (workExperience.some((e) => (e.company.trim() || e.position.trim()) && !e.startDate.trim())) {
        return 'Please add a start date for each work experience entry (or remove the incomplete one) — we use it to calculate your total years of experience.';
      }
    }
    if (s === 2) {
      if (!educationLevel) return 'Please select your highest educational attainment.';
      // Education entries themselves are optional (same as Work Experience),
      // but a *started* one left half-filled — school with no degree, or
      // vice versa — used to pass silently: this only ever checked the
      // dropdown above, so deleting one field out of an entry never changed
      // whether Step 3 showed complete.
      if (education.some((ed) => (ed.school.trim() || ed.degree.trim()) && (!ed.school.trim() || !ed.degree.trim()))) {
        return 'Please finish or remove the incomplete education entry (needs both School and Degree/Course).';
      }
    }
    if (s === 3 && skills.length === 0) return 'Please list at least a few skills.';
    return '';
  }

  // Same checks as validateStep, but naming exactly which field(s) are the
  // problem — validateStep only ever needed a yes/no plus a message before
  // (for the error banner), this is what actually drives the red outline on
  // the specific empty box, not just "something on this step is wrong."
  function getInvalidFields(s) {
    const fields = [];
    if (s === 0) {
      if (!firstName.trim()) fields.push('firstName');
      if (!lastName.trim()) fields.push('lastName');
      if (!email.trim()) fields.push('email');
      if (!phone.trim() || !isPhoneValid(phone)) fields.push('phone');
      if (!currentLocation.trim()) fields.push('currentLocation');
      if (!String(age).trim() || Number(age) < 18) fields.push('age');
    }
    if (s === 2 && !educationLevel) fields.push('educationLevel');
    if (s === 3 && skills.length === 0) fields.push('skills');
    return fields;
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
    age: age !== '' ? Number(age) : null,
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

  // Free to click regardless of whether the current step is actually filled
  // in — same as jumping via a stepper dot, and for the same reason: Save is
  // the one place required fields actually get enforced (with the jump-back
  // + red-outline treatment), so Next blocking here too was just a second,
  // inconsistent gate on top of that.
  const handleNext = () => {
    setError('');
    setInvalidFields(new Set());
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

  // Steps 0/2/3 have real required-field checks (validateStep), so reuse
  // that directly rather than maintaining a second definition of "done."
  // Steps 1/4/5 have no hard requirement — genuinely optional per this
  // page's own design (see the file's top comment) — so "complete" there
  // just means "you've actually put something in it," not a blocker.
  const isStepComplete = (i) => {
    if (i === 0 || i === 2 || i === 3) return !validateStep(i);
    // Still optional to have zero entries at all (leave blank if a fresh
    // graduate) — but once at least one is started, it also has to pass
    // validateStep's completeness check (start date present) to count.
    if (i === 1) return workExperience.some((e) => e.company.trim() || e.position.trim()) && !validateStep(1);
    if (i === 4) return Boolean(licenseType || yearsDriving !== '' || nbiClearance || willingShifting || medicalCertificate);
    if (i === 5) return certifications.some((c) => c.title.trim()) || summary.trim().length > 0;
    return false;
  };

  // No validation gate — free navigation is the point of making the stepper
  // clickable at all. handleNext's own validateStep check still runs
  // whenever the applicant actually tries to move forward normally or
  // submit, so nothing here lets an incomplete required step slip past Save.
  const handleStepClick = (i) => {
    setError('');
    setInvalidFields(new Set());
    setStep(i);
    window.scrollTo(0, 0);
    // Same autosave as Next (see there) — without this, jumping around via
    // the step dots (or Back, below) instead of clicking Next in order never
    // persisted anything, so a refresh mid-review could silently wipe out
    // everything the wizard was pre-filled with, e.g. right after an upload.
    upsertMyResume(profile.id, { ...buildResumePayload(), last_step: i });
  };

  const handleBack = () => {
    setError('');
    setInvalidFields(new Set());
    const prevStep = Math.max(step - 1, 0);
    setStep(prevStep);
    window.scrollTo(0, 0);
    upsertMyResume(profile.id, { ...buildResumePayload(), last_step: prevStep });
  };

  // Clicking "Save Changes" no longer saves immediately — it validates,
  // same as before, and if that passes it shows a read-only summary of
  // everything about to be written instead. The actual write only happens
  // once the applicant confirms from that screen (handleConfirmSave, below),
  // so a typo or missing field has one more checkpoint to get caught at.
  const handleReview = () => {
    setError('');
    // The stepper is now freely clickable, so Save can be reached without
    // ever passing through Next on every step (which used to be the only
    // thing enforcing validateStep's checks) — re-check every required step
    // here too, and jump to the first one that's actually missing something
    // instead of silently saving an incomplete resume.
    for (const s of [0, 1, 2, 3]) {
      const stepError = validateStep(s);
      if (stepError) {
        setStep(s);
        setError(stepError);
        setInvalidFields(new Set(getInvalidFields(s)));
        window.scrollTo(0, 0);
        return;
      }
    }
    setInvalidFields(new Set());
    const filteredExperience = workExperience.filter((e) => e.company || e.position);
    const filteredEducation = education.filter((e) => e.school || e.degree);
    if (filteredExperience.length === 0 && filteredEducation.length === 0) {
      setError('Please add at least one work experience or education entry.');
      return;
    }
    setReviewing(true);
    window.scrollTo(0, 0);
  };

  const handleBackToEdit = () => {
    setError('');
    setReviewing(false);
    window.scrollTo(0, 0);
  };

  const handleConfirmSave = async () => {
    setError('');
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

  // The choice screen is short, fixed-length content — it should sit
  // centered in whatever space is available, not pinned near the top with a
  // wall of empty space below it. The wizard itself stays top-anchored:
  // later steps (multiple work experience/education entries) can grow well
  // past a single viewport, where centering would look broken/jump around
  // as content grows.
  const showChoice = !editing && buildMethod === null;

  return (
    <div style={{ background: 'var(--surface-page)', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', overflow: 'hidden' }}>
      {/* A thin, on-brand scrollbar for the one region on this page that's
          ever allowed to scroll — so on the rare occasion a step genuinely
          has more content than fits (several work experience entries),
          that reads as a deliberately-designed scroll affordance instead of
          a bare OS-default scrollbar bolted onto the card. Chrome/Edge/
          Safari via the -webkit- rules; Firefox via the two scrollbar-*
          properties right above them. */}
      <style>{`
        .resume-step-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--gray-400) transparent;
        }
        .resume-step-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .resume-step-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .resume-step-scroll::-webkit-scrollbar-thumb {
          background: var(--gray-400);
          border-radius: 999px;
        }
        .resume-step-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--gray-500);
        }
      `}</style>
      <div style={{ padding: 'clamp(8px, 2vh, 30px) 60px 0', flexShrink: 0 }} className="page-header-wrap"><Header nav={nav} profile={profile} /></div>
      {/* Padding here is deliberately small and vh-aware, not a flat value —
          the card below owns all of its own internal spacing (header/middle/
          footer each pad themselves), so section's own padding is pure
          double-counted overhead against the card's maxHeight budget. On a
          short real laptop screen (~768px tall, not just a resized desktop
          browser window) that overhead was previously enough on its own to
          force an internal scrollbar that had no business appearing. */}
      <section style={{
        maxWidth: 1065, width: '100%', margin: '0 auto', boxSizing: 'border-box', minHeight: 0,
        padding: 'clamp(6px, 1.5vh, 20px) 20px',
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: showChoice ? 'center' : 'flex-start', overflow: 'hidden',
      }}>
        <FadeSection delay={0.1} style={{ maxWidth: 700, width: '100%', margin: '0 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* This card never scrolls the page it sits on — capped to fit
              the viewport, with only its own middle content region (below)
              scrolling internally if a step genuinely has more content than
              fits (several work experience entries, say). Header (title +
              stepper) and footer (Next/Save) both stay fixed in place
              either way, so those are never something you have to scroll to
              reach. */}
          <div style={{ position: 'relative', background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', borderRadius: 20, maxHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* One consistent back control for the whole wizard: on step 0
                it leaves the wizard entirely (back to the choice screen, if
                that's where this session actually came from); on every
                later step it's the same as the old bottom "Back" pill —
                just consolidated into this single corner affordance instead
                of two different-looking back controls existing at once. */}
            {(step > 0 || buildMethod !== null || editing) && (
              <button
                onClick={() => {
                  if (reviewing) {
                    handleBackToEdit();
                    return;
                  }
                  if (step > 0) {
                    handleBack();
                    return;
                  }
                  // Leaving step 0 back to the choice screen — this can be
                  // reached both for a brand-new resume (buildMethod already
                  // set) and for a resume being continued/edited (editing
                  // already true, buildMethod still null since the choice
                  // screen was skipped on load) — either way, resetting both
                  // is what actually reveals the choice screen again.
                  setBuildMethod(null);
                  setEditing(false);
                }}
                className="btn-animate"
                aria-label={reviewing ? 'Back to edit' : step > 0 ? 'Back to previous step' : 'Back to resume options'}
                style={{
                  position: 'absolute', top: 'clamp(16px, 3vw, 28px)', left: 'clamp(16px, 3vw, 28px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%',
                  border: 'none', cursor: 'pointer', background: 'var(--surface-page-alt)', color: 'var(--text-primary)', zIndex: 1,
                }}
              >
                {ARROW_LEFT_ICON}
              </button>
            )}
            <div style={{ flexShrink: 0, padding: 'clamp(10px, 2vh, 32px) clamp(16px, 5vw, 60px) 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(8px, 1.6vh, 16px)', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 8px' }}>
                  {reviewing ? 'Review Your Resume' : isDraft ? 'Continue Your Resume' : editing ? 'Update Your Resume' : 'Build Your Resume'}
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.65, margin: 0 }}>
                  {reviewing
                    ? 'Double-check everything below before saving — go back to edit anything that looks off.'
                    : isDraft
                    ? "Welcome back — we picked up right where you left off."
                    : "Fill this out once, and our AI will match it against every open position for you, so you don't have to re-enter the same information for each job."}
                </p>
              </div>
              {!showChoice && !reviewing && <StepProgress step={step} onStepClick={handleStepClick} isStepComplete={isStepComplete} />}
            </div>

            <div className="resume-step-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px clamp(16px, 5vw, 60px) 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, boxSizing: 'border-box', width: '100%' }}>
            {reviewing ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.basic} title="Basic Information" />
                  <ReviewRow label="Name" value={`${firstName} ${lastName}`.trim()} />
                  <ReviewRow label="Email" value={email} />
                  <ReviewRow label="Phone" value={phone} />
                  <ReviewRow label="Current Location" value={currentLocation} />
                </FadeSection>

                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.education} title="Education" />
                  <ReviewRow label="Highest Attainment" value={educationLevel} />
                  {education.filter((e) => e.school || e.degree).map((e, i) => (
                    <ReviewRow key={i} label={e.degree || 'Degree/Course'} value={[e.school, e.yearGraduated].filter(Boolean).join(' — ') || '—'} />
                  ))}
                </FadeSection>

                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.experience} title="Work Experience" />
                  {workExperience.filter((e) => e.company || e.position).length === 0 ? (
                    <ReviewRow label="Work Experience" value="None listed" />
                  ) : (
                    workExperience.filter((e) => e.company || e.position).map((e, i) => (
                      <ReviewRow
                        key={i}
                        label={e.position || 'Position'}
                        value={`${e.company || '—'}${e.startDate ? ` (${e.startDate} – ${e.endDate || 'Present'})` : ''}`}
                      />
                    ))
                  )}
                </FadeSection>

                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.education} title="Skills" />
                  <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{skills.length ? skills.join(', ') : 'None listed'}</p>
                </FadeSection>

                {(licenseType || yearsDriving !== '' || nbiClearance || willingShifting || medicalCertificate) && (
                  <FadeSection delay={0} style={SECTION_STYLE}>
                    <SectionHeader icon={SECTION_ICONS.driving} title="Driving Qualifications" />
                    {licenseType && <ReviewRow label="License Type" value={licenseType} />}
                    {yearsDriving !== '' && <ReviewRow label="Years of Driving Experience" value={yearsDriving} />}
                    <ReviewRow label="NBI Clearance" value={nbiClearance ? 'Yes' : 'No'} />
                    <ReviewRow label="Willing to Shift Schedule" value={willingShifting ? 'Yes' : 'No'} />
                    <ReviewRow label="Medical Certificate" value={medicalCertificate ? 'Yes' : 'No'} />
                  </FadeSection>
                )}

                {certifications.some((c) => c.title) && (
                  <FadeSection delay={0} style={SECTION_STYLE}>
                    <SectionHeader icon={SECTION_ICONS.certifications} title="Certifications" />
                    {certifications.filter((c) => c.title).map((c, i) => (
                      <ReviewRow key={i} label={c.title} value={[c.issuer, c.year].filter(Boolean).join(' — ') || '—'} />
                    ))}
                  </FadeSection>
                )}

                {summary.trim() && (
                  <FadeSection delay={0} style={SECTION_STYLE}>
                    <SectionHeader icon={SECTION_ICONS.note} title="Professional Summary" />
                    <p style={{ fontSize: 'var(--text-sm)', margin: 0, lineHeight: 1.5 }}>{summary}</p>
                  </FadeSection>
                )}
              </div>
            ) : !editing && buildMethod === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                <button
                  onClick={() => !uploading && setBuildMethod('manual')}
                  className="hover-lift btn-animate"
                  disabled={uploading}
                  style={{
                    textAlign: 'left', cursor: uploading ? 'default' : 'pointer', border: '1px solid var(--border-hairline)', borderRadius: 16,
                    padding: 24, background: 'var(--surface-page)', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'inherit',
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{PENCIL_ICON}</span>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>Build It Manually</div>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
                    Fill out a short guided form, one section at a time. Takes about 5 minutes.
                  </p>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelected}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className="hover-lift btn-animate"
                  disabled={uploading}
                  style={{
                    textAlign: 'left', cursor: uploading ? 'default' : 'pointer', border: '1px solid var(--border-hairline)', borderRadius: 16,
                    padding: 24, background: 'var(--surface-page)', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'inherit',
                    opacity: uploading ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{uploading ? UPLOAD_SPINNER : UPLOAD_ICON}</span>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>Upload My Resume</div>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
                    {uploading ? 'Reading your resume…' : "Upload a PDF or Word file and we'll fill this out for you."}
                  </p>
                </button>
                {uploadError && <FormError message={uploadError} />}
              </div>
            ) : (
              // minHeight keeps a sparse step (Skills — just one field) from
              // collapsing down to a fraction of a denser step's
              // (Qualifications, Certifications) height — without it, this
              // region visibly jumps size on every Back/Next/step-click,
              // which reads as broken rather than just "this section has
              // less to fill in." A step with genuinely more content than
              // this (several work experience entries, say) still grows
              // past it and scrolls within this middle region normally —
              // this is a floor, not a cap.
              <div key={step} style={{ width: '100%', minHeight: 340, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {step === 0 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.basic} title="Basic Information" />
                  <div style={GRID_2COL}>
                    <Input label="First Name:" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={invalidFields.has('firstName')} />
                    <Input label="Last Name:" value={lastName} onChange={(e) => setLastName(e.target.value)} error={invalidFields.has('lastName')} />
                    <Input label="Email Address:" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={invalidFields.has('email')} />
                    <Input label="Phone Number:" type="tel" placeholder="0912 345 6789" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} error={invalidFields.has('phone')} />
                    <Input
                      label="Current Location (City / Province):" value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)}
                      placeholder="e.g. Quezon City" error={invalidFields.has('currentLocation')}
                    />
                    <Input
                      label="Age:" type="number" min="18" max="100" value={age} onChange={(e) => setAge(e.target.value)}
                      error={invalidFields.has('age')}
                    />
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
                      error={invalidFields.has('educationLevel')}
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
                    error={invalidFields.has('skills')}
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
                    <textarea value={summary} onChange={(e) => setSummary(e.target.value)} style={{ ...FIELD_STYLE, minHeight: 80, resize: 'vertical' }} />
                  </FadeSection>
                </>
              )}

              </div>
            )}
            </div>
            {/* Fixed footer, outside the scrollable middle region above —
                Next/Save (and the validation error, when there is one) stay
                reachable without scrolling regardless of how long the
                current step's content is. Choice-screen mode has no
                separate footer of its own (each option card is
                self-contained), so this only renders once actually in the
                wizard. */}
            {!showChoice && (
              <div style={{ flexShrink: 0, padding: '12px clamp(16px, 5vw, 60px) clamp(16px, 3vw, 32px)', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <FormError message={error} />
                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  {reviewing ? (
                    <Button variant="strong" size="lg" onClick={handleConfirmSave} disabled={submitting} style={{ width: 'auto', flex: 1 }}>
                      {submitting ? 'Saving…' : 'Confirm & Save'}
                    </Button>
                  ) : step < LAST_STEP ? (
                    <Button variant="strong" size="lg" onClick={handleNext} style={{ width: 'auto', flex: 1 }}>
                      Next
                    </Button>
                  ) : (
                    <Button variant="strong" size="lg" onClick={handleReview} style={{ width: 'auto', flex: 1 }}>
                      Review & Save
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </FadeSection>
      </section>
    </div>
  );
}
export default ResumeForm;
