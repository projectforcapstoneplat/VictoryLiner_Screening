// HR job posting create/edit form.
//
// Split into steps (Job Details -> Description -> Screening Criteria ->
// Review & Publish), same pattern as ResumeForm.jsx's applicant-facing
// resume wizard — one focused group of fields at a time with a progress
// bar, instead of one long dense scroll. Reuses ResumeFields.jsx's shared
// building blocks (FadeSection, SectionHeader, FIELD_STYLE, GRID_2COL) so
// both wizards in the app look and feel like the same product.
import { useEffect, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Select, DROPDOWN_ARROW_STYLE } from '../components/core/Select/Select.jsx';
import { ConfirmModal } from '../components/core/ConfirmModal/ConfirmModal.jsx';
import { FormError } from '../components/feedback/FormError/FormError.jsx';
import { FadeSection, SectionHeader, SECTION_STYLE, GRID_2COL, FIELD_STYLE, SECTION_ICONS } from '../components/forms/ResumeFields/ResumeFields.jsx';
import { createJob, updateJob } from '../lib/jobs.js';
import { matchJobToAllResumes } from '../lib/resumeMatches.js';
import { listCriteriaForJob, replaceCriteriaForJob, suggestCriteria } from '../lib/criteria.js';
import { listJobCategories } from '../lib/jobCategories.js';
import { STATIONS, EMPLOYMENT_TYPES } from '../lib/jobConstants.js';

const EMPTY = {
  title: '', category: '', location: '', employment_type: '', open_positions: 1,
  description: '', required_qualifications: '', preferred_qualifications: '',
  application_deadline: '',
};

const EMPTY_CRITERION = { keyword: '', weight: 3 };

// Mirrors WEIGHT_LABELS in supabase/functions/_shared/weightLabel.ts — that
// file is what the AI actually reads when scoring against these criteria,
// this is what HR sees while setting them. Neither side had any defined
// meaning for "3" vs "4" before; this is the one place both now agree on.
const WEIGHT_OPTIONS = [
  { value: 1, label: '1: Nice to Have' },
  { value: 2, label: '2: Helpful' },
  { value: 3, label: '3: Important' },
  { value: 4, label: '4: Very Important' },
  { value: 5, label: '5: Critical / Required' },
];

const STEP_TITLES = ['Job Details', 'Description & Qualifications', 'Screening Criteria', 'Review & Publish'];
const LAST_STEP = STEP_TITLES.length - 1;

const REVIEW_ICON = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 5-5" /></svg>;
const ARROW_LEFT_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
const TRASH_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>;
const STEP_CHECK_ICON = <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const PLUS_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1={12} y1={5} x2={12} y2={19} /><line x1={5} y1={12} x2={19} y2={12} /></svg>;
const SPARKLE_ICON = <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9L12 2z" /><path d="M19 15l.7 2.2L22 18l-2.3.8L19 21l-.7-2.2L16 18l2.3-.8L19 15z" /></svg>;

// Clickable step dots, same pattern as ResumeForm.jsx's own stepper — no
// validation gate on the click itself (free navigation is the point of
// making it clickable at all); handleNext/handleSave still run their own
// checks whenever the applicant actually tries to move forward or publish,
// so nothing here lets a required field slip past those.
function StepProgress({ step, onStepClick, isStepComplete }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--action-primary-bg)' }}>
          Step {step + 1} of {STEP_TITLES.length}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, opacity: 0.65 }}>{STEP_TITLES[step]}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {STEP_TITLES.map((title, i) => {
          const complete = isStepComplete(i);
          const isCurrent = i === step;
          const filled = complete || isCurrent;
          return (
            <div key={title} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_TITLES.length - 1 ? 1 : '0 0 auto' }}>
              <button
                type="button"
                onClick={() => onStepClick(i)}
                title={title}
                aria-label={`${title}${complete ? ' (complete)' : ''}${isCurrent ? ', current step' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className="btn-animate"
                style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontWeight: 700,
                  border: filled ? 'none' : '2px solid var(--gray-400)',
                  background: filled ? 'var(--action-primary-bg)' : 'var(--surface-card)',
                  color: filled ? '#fff' : 'var(--text-primary)',
                  opacity: filled ? 1 : 0.65,
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

function Textarea({ label, value, onChange, placeholder, hint }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>
      <textarea value={value} onChange={onChange} placeholder={placeholder} style={{ ...FIELD_STYLE, minHeight: 120, resize: 'vertical' }} />
      {hint && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>{hint}</span>}
    </label>
  );
}

function CriteriaEditor({ criteria, onChange, onAdd, onRemove, onSuggest, suggesting, suggestError }) {
  // A removed criterion is gone for good the moment it happens — no undo,
  // and it's easy to fat-finger on a row sitting right next to the field
  // you actually meant to edit. Same ConfirmModal pattern used everywhere
  // else in the app a destructive click needs a second "are you sure."
  const [pendingRemove, setPendingRemove] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onSuggest}
          disabled={suggesting}
          className="btn-animate"
          style={{
            // Violet, not the app's red/pink brand color — red is already
            // "destructive/primary action" everywhere else on this screen
            // (Remove, Publish), and using it here too made an AI *helper*
            // action read as another dangerous one sitting right next to
            // Remove. Violet is the same accent the "Ready for Your
            // Decision" KPI tile uses elsewhere in the app, repurposed here
            // as a genuinely distinct "AI feature" color.
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 999,
            border: '1.5px solid #6d4fc7', cursor: suggesting ? 'default' : 'pointer', fontFamily: 'inherit',
            fontSize: 'var(--text-sm)', fontWeight: 700, color: '#6d4fc7',
            background: 'linear-gradient(135deg, #ece7fa, #f5f2fb)', opacity: suggesting ? 0.7 : 1,
          }}
        >
          {SPARKLE_ICON} {suggesting ? 'Asking AI…' : 'Suggest with AI'}
        </button>
      </div>
      {suggestError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)' }}>{suggestError}</div>}
      <ConfirmModal
        open={pendingRemove !== null}
        title="Remove this criterion?"
        message={pendingRemove !== null ? `"${criteria[pendingRemove]?.keyword || 'This criterion'}" will be removed from the screening list. This can't be undone.` : ''}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => { onRemove(pendingRemove); setPendingRemove(null); }}
        onCancel={() => setPendingRemove(null)}
      />
      {criteria.map((c, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-page)', borderRadius: 4, padding: 'clamp(14px, 4vw, 20px)' }}>
          {/* A criterion is a real phrase, not a short keyword ("Full-Stack
              Web Application Development", not "Web") — it used to share a
              row with the fixed-260px Weight dropdown and Remove button,
              which left it whatever scraps of width were left over and
              truncated anything longer than a couple words. Its own full-
              width row means it's never fighting the other two controls for
              space, regardless of how narrow the page gets. */}
          <Input label="Criterion:" value={c.keyword} onChange={(e) => onChange(i, 'keyword', e.target.value)} placeholder="e.g. Defensive Driving, Full-Stack Web Application Development" />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ width: 260, flexShrink: 0 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Weight:</span>
                <select
                  value={c.weight}
                  onChange={(e) => onChange(i, 'weight', Number(e.target.value))}
                  style={{
                    height: 49, width: '100%', boxSizing: 'border-box', padding: '0 40px 0 18px',
                    background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
                    border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
                    ...DROPDOWN_ARROW_STYLE,
                  }}
                >
                  {WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
            </div>
            {criteria.length > 1 && (
              <button
                type="button"
                onClick={() => setPendingRemove(i)}
                className="btn-animate"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, height: 49, padding: '0 18px', borderRadius: 8,
                  border: '1.5px solid var(--pink-100)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700,
                  background: 'transparent', color: 'var(--red-700)', whiteSpace: 'nowrap',
                }}
              >
                {TRASH_ICON} Remove
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="btn-animate hover-lift"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 8px 8px', borderRadius: 999, alignSelf: 'flex-start',
          border: '1.5px dashed var(--action-primary-bg)', background: 'transparent', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--action-primary-bg)',
        }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: '50%', background: 'var(--action-primary-bg)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {PLUS_ICON}
        </span>
        Add Criterion
      </button>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border-hairline)' }}>
      <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>{label}</span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

// A plain count ("14 criteria set") meant scrolling back up a whole step
// just to remember what any of them actually were, right before publishing
// — the one moment that check matters most. Expands in place instead, so
// the full list (with weights) is a click away without leaving the review
// screen.
function CriteriaReviewRow({ criteria }) {
  const [expanded, setExpanded] = useState(false);
  const filled = criteria.filter((c) => c.keyword.trim());
  const count = filled.length;
  return (
    <div style={{ borderBottom: '1px solid var(--border-hairline)' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="btn-animate"
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, width: '100%',
          padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>Screening Criteria</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {count} criteri{count === 1 ? 'on' : 'a'} set
          <svg
            width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {expanded && (
        <div style={{ paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {count === 0 ? (
            <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>No criteria set.</span>
          ) : (
            filled.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  fontSize: 'var(--text-xs)', background: 'var(--surface-card)', borderRadius: 6, padding: '9px 12px',
                }}
              >
                <span>{c.keyword}</span>
                <span style={{ opacity: 0.6, flexShrink: 0, fontWeight: 600 }}>
                  {WEIGHT_OPTIONS.find((w) => w.value === Number(c.weight))?.label || `${c.weight}/5`}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function JobPostingForm({ job, profile, nav }) {
  const isEdit = Boolean(job?.id);
  const [form, setForm] = useState(() => ({ ...EMPTY, ...job }));
  const [criteria, setCriteria] = useState([{ ...EMPTY_CRITERION }]);
  const [categories, setCategories] = useState([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  // Same pattern as ResumeForm.jsx's invalidFields — a plain error banner
  // said *that* something was missing, never *which* field, so on a form
  // with more than one required field per step an applicant/HR user had to
  // guess. This drives a red border on the specific empty field instead.
  const [invalidFields, setInvalidFields] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  useEffect(() => {
    listJobCategories().then(({ data }) => setCategories(data.map((c) => c.name)));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    listCriteriaForJob(job.id).then(({ data }) => {
      if (data?.length) setCriteria(data.map((c) => ({ keyword: c.keyword, weight: c.weight })));
    });
  }, [isEdit, job?.id]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const updateCriterion = (index, key, value) => {
    setCriteria((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };
  const addCriterion = () => setCriteria((rows) => [...rows, { ...EMPTY_CRITERION }]);
  const removeCriterion = (index) => setCriteria((rows) => rows.filter((_, i) => i !== index));

  const handleSuggest = async () => {
    setSuggestError('');
    if (!form.title.trim()) {
      setSuggestError('Add a title first so the AI knows what role this is for.');
      return;
    }
    setSuggesting(true);
    const { data, error: suggestErr } = await suggestCriteria({
      title: form.title,
      description: form.description,
      requiredQualifications: form.required_qualifications,
      preferredQualifications: form.preferred_qualifications,
      existingCriteria: criteria.map((c) => c.keyword.trim()).filter(Boolean),
    });
    setSuggesting(false);
    if (suggestErr) {
      setSuggestError(suggestErr);
      return;
    }
    setCriteria((rows) => {
      const existingKeywords = new Set(rows.map((r) => r.keyword.trim().toLowerCase()).filter(Boolean));
      const nonEmptyRows = rows.filter((r) => r.keyword.trim());
      const newRows = (data || [])
        .filter((c) => c.keyword && !existingKeywords.has(c.keyword.trim().toLowerCase()))
        .map((c) => ({ keyword: c.keyword, weight: c.weight ?? 3 }));
      const merged = [...nonEmptyRows, ...newRows];
      return merged.length ? merged : [{ ...EMPTY_CRITERION }];
    });
  };

  // Only Job Details is gated — everything after it is either optional
  // (description/qualifications) or has its own dedicated review at the
  // final step, so there's nothing worth blocking Next on before then.
  function validateStep(s) {
    if (s === 0) {
      if (!form.title.trim()) return 'Please enter a job title.';
      if (!form.category.trim()) return 'Please select a category.';
    }
    return '';
  }

  // Which specific fields to red-border for a failed step — mirrors
  // validateStep's own checks field-by-field instead of just the first
  // error message, so Title and Category can both light up at once instead
  // of only ever pointing at whichever one validateStep happened to check
  // first.
  function getInvalidFields(s) {
    const fields = [];
    if (s === 0) {
      if (!form.title.trim()) fields.push('title');
      if (!form.category.trim()) fields.push('category');
    }
    return fields;
  }

  const handleNext = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      setInvalidFields(new Set(getInvalidFields(step)));
      return;
    }
    setError('');
    setInvalidFields(new Set());
    setStep((s) => Math.min(s + 1, LAST_STEP));
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setError('');
    setInvalidFields(new Set());
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo(0, 0);
  };

  // No validation gate here, same reasoning as ResumeForm.jsx's own
  // clickable stepper — jumping around is the point. handleSave re-checks
  // everything required before it actually publishes/saves regardless of
  // how the applicant got to that screen.
  const handleStepClick = (i) => {
    setError('');
    setInvalidFields(new Set());
    setStep(i);
    window.scrollTo(0, 0);
  };

  // Step 0 has a real required-field check (validateStep), reused directly.
  // Steps 1/2 have no hard requirement, so "complete" just means "you've
  // actually put something in it" — matches how the same distinction works
  // in ResumeForm.jsx. Step 3 (Review & Publish) is the destination itself,
  // not something with its own separate completion state to show.
  const isStepComplete = (i) => {
    if (i === 0) return !validateStep(0);
    if (i === 1) return form.description.trim().length > 0;
    if (i === 2) return criteria.some((c) => c.keyword.trim());
    return false;
  };

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      setInvalidFields(new Set(['title']));
      setStep(0);
      return;
    }
    if (!form.category.trim()) {
      setError('Category is required.');
      setInvalidFields(new Set(['category']));
      setStep(0);
      return;
    }
    setInvalidFields(new Set());
    // Same gate HrDashboard.jsx's own Publish pill already enforces for an
    // existing draft — the AI matcher relies on this for real context, not
    // just the weighted keyword list, so a newly-created job going live
    // with none would score every applicant off almost nothing. Only
    // applies here (isEdit false): editing an already-published job's
    // description doesn't change its publish state at all (see payload
    // below — status is never part of an update), so there's no publish
    // action on this screen to gate in that case.
    if (!isEdit && !form.description.trim()) {
      setError('Add a job description before publishing — the AI match scoring relies on it for real context, not just the weighted keyword list.');
      setStep(1);
      return;
    }
    setSaving(true);
    // Built as an explicit whitelist, not `...form` — `form` is seeded from
    // whatever job object the caller passed in, and HrDashboard.jsx's job
    // list (listAllJobs in lib/jobs.js) enriches those with computed,
    // non-column fields (applicant_count, advanced_count,
    // positions_remaining) for display. Spreading form wholesale into the
    // update payload sent those straight to PostgREST and got rejected with
    // "Could not find the 'advanced_count' column."
    const payload = {
      title: form.title,
      category: form.category,
      location: form.location,
      employment_type: form.employment_type,
      open_positions: Number(form.open_positions) || 1,
      description: form.description,
      required_qualifications: form.required_qualifications,
      preferred_qualifications: form.preferred_qualifications,
      application_deadline: form.application_deadline || null,
      min_resume_match_percent: form.min_resume_match_percent === '' || form.min_resume_match_percent == null
        ? null
        : Math.max(0, Math.min(100, Math.round(Number(form.min_resume_match_percent)))),
    };
    // A brand-new job actually goes live here — the button says "Publish
    // Job Posting", so it needs to actually publish, not quietly land as a
    // draft that then needs a second, separate click from the Job Openings
    // list to really go live (which is what used to happen: this always
    // passed status: 'draft' regardless of what the button told HR).
    const { data: savedJob, error: saveError } = isEdit
      ? await updateJob(job.id, payload)
      : await createJob({ ...payload, created_by: profile.id, status: 'published' });
    if (saveError) {
      setSaving(false);
      setError(saveError.message);
      return;
    }
    const { error: criteriaError } = await replaceCriteriaForJob(savedJob.id, criteria);
    setSaving(false);
    if (criteriaError) {
      setError(criteriaError.message);
      return;
    }
    // Fire-and-forget, same reasoning as the identical call in
    // HrDashboard.jsx's own Publish pill — scoring every applicant's resume
    // against this job can take a while, and there's nothing on this screen
    // for HR to wait on. This is what makes "Publish Job Posting" actually
    // trigger the automatic matching pass immediately, instead of only
    // happening if HR later also clicks Publish again from Job Openings.
    if (!isEdit) {
      matchJobToAllResumes(savedJob.id).then(({ error }) => {
        if (error) window.alert(`"${savedJob.title}" is published, but automatic applicant matching failed: ${error}\n\nUse "Re-check Matches" on this job from Job Openings once the issue is resolved.`);
      });
    }
    // Job Openings — not the dashboard — is where this posting actually
    // shows up, and where HR came from to get here in the first place
    // (the "+ New Job Posting" button lives on that page).
    nav('hr-jobs');
  };

  return (
    <HrShell active="hr-jobs" nav={nav} profile={profile}>
      {/* Same thin-scrollbar treatment as ResumeForm.jsx's own step-scroll
          region, so the one internal scrollbar that can appear here (see
          .jobform-step-scroll below) doesn't look like a bare OS-default
          scrollbar bolted onto the card. */}
      <style>{`
        .jobform-step-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--gray-400) transparent;
        }
        .jobform-step-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .jobform-step-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .jobform-step-scroll::-webkit-scrollbar-thumb {
          background: var(--gray-400);
          border-radius: 999px;
        }
        .jobform-step-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--gray-500);
        }
      `}</style>
      {/* No "Back to Job Openings" pill here anymore — it was pure chrome
          eating vertical room a short laptop screen can't spare, and it's
          fully redundant now that this page lives inside HrShell: "Job
          Openings" in the sidebar is the exact same one click away, always
          visible, without costing this card anything. */}
      <section style={{ maxWidth: 1065, margin: '0 auto', padding: '0 20px' }}>
        <FadeSection delay={0.1} style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Capped to fit under HrShell's header instead of growing the
              whole page — on a real laptop screen (not just a wide desktop
              browser window), a 4-step wizard's tallest step used to push
              Next/Publish below the fold, forcing a page-level scroll just
              to reach the one button that actually moves the wizard
              forward. Only the middle (the step's own fields) scrolls
              internally now if it's genuinely taller than the available
              space; the title/stepper above it and the Back/Next/Save row
              below it both stay put, same technique ResumeForm.jsx already
              uses for its own wizard.

              The vertical padding/gaps below are all vh-based, not the flat
              (or vw-based) values they started as — a vw clamp sizes off
              *width*, so on a wide-but-short laptop window it still ate up
              to 60px top + 60px bottom in padding alone regardless of how
              little vertical room there actually was, which is exactly what
              forced a short step (5 plain fields) into its own internal
              scroll for no real reason. vh-based values shrink along with
              the actual constrained axis instead. */}
          <div style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', borderRadius: 20, padding: 'clamp(14px, 2.5vh, 36px) clamp(16px, 5vw, 80px)', maxHeight: 'calc(100vh - 170px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(10px, 1.6vh, 20px)', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* The explanatory sentence that used to sit here ("A few
                focused steps: details, description...") was pure chrome
                too — nice on a tall screen, but the stepper right below
                already says which step this is, and the title alone is
                self-explanatory. Cut for the same reason the back button
                was: real vertical cost, on every step, for content that
                only ever needed to be read once. */}
            <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: 0, textAlign: 'center', flexShrink: 0 }}>{isEdit ? 'Edit Job Posting' : 'New Job Posting'}</h2>

            <div style={{ width: '100%', flexShrink: 0 }}>
              <StepProgress step={step} onStepClick={handleStepClick} isStepComplete={isStepComplete} />
            </div>

            <div className="jobform-step-scroll" style={{ width: '100%', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div key={step} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'clamp(14px, 2vh, 24px)' }}>
              {step === 0 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.experience} title="Job Details" />
                  <Input label="Title:" value={form.title} onChange={set('title')} placeholder="e.g. City Bus Driver" error={invalidFields.has('title')} />
                  <div style={GRID_2COL}>
                    <Select label="Category:" value={form.category} onChange={set('category')} options={categories} placeholder="Select a category" error={invalidFields.has('category')} />
                    <Select label="Station:" value={form.location} onChange={set('location')} options={STATIONS} placeholder="Select a station" />
                  </div>
                  <div style={GRID_2COL}>
                    <Select label="Employment Type:" value={form.employment_type} onChange={set('employment_type')} options={EMPLOYMENT_TYPES} placeholder="Select employment type" />
                    <Input label="Open Positions:" type="number" min="1" value={form.open_positions} onChange={set('open_positions')} />
                  </div>
                  <Input label="Application Deadline:" type="date" value={form.application_deadline || ''} onChange={set('application_deadline')} hint="Leave blank for no deadline. The posting stays open until you close it manually." />
                </FadeSection>
              )}

              {step === 1 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.note} title="Description & Qualifications" />
                  <Textarea label="Key Responsibilities (Description):" value={form.description} onChange={set('description')} placeholder="What will this person actually do day to day?" />
                  <Textarea label="Required Qualifications:" value={form.required_qualifications} onChange={set('required_qualifications')} placeholder="Must-haves: a candidate without these shouldn't qualify." />
                  <Textarea label="Preferred Qualifications:" value={form.preferred_qualifications} onChange={set('preferred_qualifications')} placeholder="Nice-to-haves that would set a candidate apart." />
                </FadeSection>
              )}

              {step === 2 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader
                    icon={SECTION_ICONS.skills}
                    title="Screening Criteria"
                    hint="Skills/requirements the AI will semantically evaluate each resume against (not literal keyword matching, equivalent wording counts too), each weighted by importance (1 = Nice to Have, 5 = Critical / Required, see the Weight dropdown for the full scale). AI can draft a starting list from the description and qualifications you just wrote; review and adjust before saving."
                  />
                  <CriteriaEditor
                    criteria={criteria}
                    onChange={updateCriterion}
                    onAdd={addCriterion}
                    onRemove={removeCriterion}
                    onSuggest={handleSuggest}
                    suggesting={suggesting}
                    suggestError={suggestError}
                  />
                </FadeSection>
              )}

              {step === 3 && (
                <>
                  <FadeSection delay={0} style={SECTION_STYLE}>
                    <SectionHeader icon={REVIEW_ICON} title="Review Before Publishing" />
                    <div style={{ background: 'var(--surface-page)', borderRadius: 4, padding: 'clamp(14px, 4vw, 20px)' }}>
                      <ReviewRow label="Title" value={form.title} />
                      <ReviewRow label="Category" value={form.category} />
                      <ReviewRow label="Station" value={form.location} />
                      <ReviewRow label="Employment Type" value={form.employment_type} />
                      <ReviewRow label="Open Positions" value={form.open_positions} />
                      <ReviewRow label="Application Deadline" value={form.application_deadline || 'No deadline'} />
                      <CriteriaReviewRow criteria={criteria} />
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', margin: 0, opacity: 0.65 }}>
                      Accommodations and AI-use disclosures are shown on every job posting automatically, no need to write them here.
                    </p>
                  </FadeSection>
                </>
              )}
            </div>
            </div>

            <div style={{ width: '100%', flexShrink: 0, paddingTop: 'clamp(8px, 1.5vh, 16px)' }}>
              <FormError message={error} />
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                {step > 0 && (
                  <Button variant="outline" size="lg" onClick={handleBack} disabled={saving} style={{ width: 'auto', flex: '0 0 130px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {ARROW_LEFT_ICON} Back
                  </Button>
                )}
                {step < LAST_STEP ? (
                  <Button variant="strong" size="lg" onClick={handleNext} style={{ width: 'auto', flex: 1 }}>
                    Next
                  </Button>
                ) : (
                  <>
                    <Button variant="strong" size="lg" onClick={handleSave} disabled={saving} style={{ width: 'auto', flex: 1 }}>
                      {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Job Posting'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </FadeSection>
      </section>
    </HrShell>
  );
}
export default JobPostingForm;
