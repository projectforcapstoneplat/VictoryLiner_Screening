// HR job posting create/edit form.
//
// Split into steps (Job Details -> Description -> Screening Criteria ->
// Review & Publish), same pattern as ResumeForm.jsx's applicant-facing
// resume wizard — one focused group of fields at a time with a progress
// bar, instead of one long dense scroll. Reuses ResumeFields.jsx's shared
// building blocks (FadeSection, SectionHeader, FIELD_STYLE, GRID_2COL) so
// both wizards in the app look and feel like the same product.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Select } from '../components/core/Select/Select.jsx';
import { FormError } from '../components/feedback/FormError/FormError.jsx';
import { FadeSection, SectionHeader, SECTION_STYLE, GRID_2COL, FIELD_STYLE, SECTION_ICONS } from '../components/forms/ResumeFields/ResumeFields.jsx';
import { createJob, updateJob } from '../lib/jobs.js';
import { listCriteriaForJob, replaceCriteriaForJob, suggestCriteria } from '../lib/criteria.js';
import { listJobCategories } from '../lib/jobCategories.js';
import { STATIONS, EMPLOYMENT_TYPES } from '../lib/jobConstants.js';

const EMPTY = {
  title: '', category: '', location: '', employment_type: '', open_positions: 1,
  description: '', required_qualifications: '', preferred_qualifications: '',
  application_deadline: '',
};

const EMPTY_CRITERION = { keyword: '', weight: 3 };

const STEP_TITLES = ['Job Details', 'Description & Qualifications', 'Screening Criteria', 'Review & Publish'];
const LAST_STEP = STEP_TITLES.length - 1;

const REVIEW_ICON = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 5-5" /></svg>;
const ARROW_LEFT_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;

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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" onClick={onSuggest} disabled={suggesting}>
          {suggesting ? 'Asking AI…' : '✨ Suggest with AI'}
        </Button>
      </div>
      {suggestError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)' }}>{suggestError}</div>}
      {criteria.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', background: 'var(--surface-page)', borderRadius: 4, padding: 'clamp(14px, 4vw, 20px)' }}>
          <div style={{ flex: 1 }}>
            <Input label="Keyword:" value={c.keyword} onChange={(e) => onChange(i, 'keyword', e.target.value)} placeholder="e.g. Defensive Driving" />
          </div>
          <div style={{ width: 100 }}>
            <Input label="Weight:" type="number" value={c.weight} onChange={(e) => onChange(i, 'weight', e.target.value)} />
          </div>
          {criteria.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => onRemove(i)}>Remove</Button>
          )}
        </div>
      ))}
      <div><Button variant="ghost" size="sm" onClick={onAdd}>+ Add Criterion</Button></div>
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

export function JobPostingForm({ job, profile, nav }) {
  const isEdit = Boolean(job?.id);
  const [form, setForm] = useState(() => ({ ...EMPTY, ...job }));
  const [criteria, setCriteria] = useState([{ ...EMPTY_CRITERION }]);
  const [categories, setCategories] = useState([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
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

  const handleNext = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, LAST_STEP));
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo(0, 0);
  };

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      setStep(0);
      return;
    }
    if (!form.category.trim()) {
      setError('Category is required.');
      setStep(0);
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      open_positions: Number(form.open_positions) || 1,
      application_deadline: form.application_deadline || null,
      min_resume_match_percent: form.min_resume_match_percent === '' || form.min_resume_match_percent == null
        ? null
        : Math.max(0, Math.min(100, Math.round(Number(form.min_resume_match_percent)))),
    };
    const { data: savedJob, error: saveError } = isEdit
      ? await updateJob(job.id, payload)
      : await createJob({ ...payload, created_by: profile.id, status: 'draft' });
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
    // Job Openings — not the dashboard — is where this posting actually
    // shows up, and where HR came from to get here in the first place
    // (the "+ New Job Posting" button lives on that page).
    nav('hr-jobs');
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} /></div>
      <section style={{ maxWidth: 1065, margin: '60px auto', padding: '0 20px' }}>
        <button
          onClick={() => nav('hr-jobs')}
          className="btn-animate"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: 'fit-content', margin: '0 auto 20px',
            padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', color: 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 700,
          }}
        >
          {ARROW_LEFT_ICON} Back to Job Openings
        </button>
        <FadeSection delay={0.1} style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', borderRadius: 20, padding: 'clamp(24px, 5vw, 60px) clamp(16px, 5vw, 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontWeight: 700, fontSize: 'var(--text-xl)', margin: '0 0 8px' }}>{isEdit ? 'Edit Job Posting' : 'New Job Posting'}</h2>
              <p style={{ fontSize: 'var(--text-sm)', opacity: 0.65, margin: 0 }}>
                A few focused steps — details, description, how the AI should screen resumes, then review before it goes live.
              </p>
            </div>

            <StepProgress step={step} />

            <div key={step} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {step === 0 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.experience} title="Job Details" />
                  <Input label="Title:" value={form.title} onChange={set('title')} placeholder="e.g. City Bus Driver" />
                  <div style={GRID_2COL}>
                    <Select label="Category:" value={form.category} onChange={set('category')} options={categories} placeholder="Select a category" />
                    <Select label="Station:" value={form.location} onChange={set('location')} options={STATIONS} placeholder="Select a station" />
                  </div>
                  <div style={GRID_2COL}>
                    <Select label="Employment Type:" value={form.employment_type} onChange={set('employment_type')} options={EMPLOYMENT_TYPES} placeholder="Select employment type" />
                    <Input label="Open Positions:" type="number" min="1" value={form.open_positions} onChange={set('open_positions')} />
                  </div>
                  <Input label="Application Deadline:" type="date" value={form.application_deadline || ''} onChange={set('application_deadline')} hint="Leave blank for no deadline — the posting stays open until you close it manually." />
                </FadeSection>
              )}

              {step === 1 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader icon={SECTION_ICONS.note} title="Description & Qualifications" />
                  <Textarea label="Key Responsibilities (Description):" value={form.description} onChange={set('description')} placeholder="What will this person actually do day to day?" />
                  <Textarea label="Required Qualifications:" value={form.required_qualifications} onChange={set('required_qualifications')} placeholder="Must-haves — a candidate without these shouldn't qualify." />
                  <Textarea label="Preferred Qualifications:" value={form.preferred_qualifications} onChange={set('preferred_qualifications')} placeholder="Nice-to-haves that would set a candidate apart." />
                </FadeSection>
              )}

              {step === 2 && (
                <FadeSection delay={0} style={SECTION_STYLE}>
                  <SectionHeader
                    icon={SECTION_ICONS.skills}
                    title="Screening Criteria"
                    hint="Keywords/skills the resume-analysis stage will match applicants against, each weighted by importance (1 = nice to have, 5 = critical). AI can draft a starting list from the description and qualifications you just wrote — review and adjust before saving."
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
                    <SectionHeader
                      icon={SECTION_ICONS.preferences}
                      title="Minimum Resume Match (optional)"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Uses the system-wide default"
                      value={form.min_resume_match_percent ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, min_resume_match_percent: e.target.value === '' ? null : e.target.value }))}
                      hint="Leave blank to use the system-wide default set on the HR Head dashboard. Set a number (0–100) to require a different resume match score just for this role."
                    />
                  </FadeSection>

                  <FadeSection delay={0.06} style={SECTION_STYLE}>
                    <SectionHeader icon={REVIEW_ICON} title="Review Before Publishing" />
                    <div style={{ background: 'var(--surface-page)', borderRadius: 4, padding: 'clamp(14px, 4vw, 20px)' }}>
                      <ReviewRow label="Title" value={form.title} />
                      <ReviewRow label="Category" value={form.category} />
                      <ReviewRow label="Station" value={form.location} />
                      <ReviewRow label="Employment Type" value={form.employment_type} />
                      <ReviewRow label="Open Positions" value={form.open_positions} />
                      <ReviewRow label="Application Deadline" value={form.application_deadline || 'No deadline'} />
                      <ReviewRow label="Screening Criteria" value={`${criteria.filter((c) => c.keyword.trim()).length} keyword${criteria.filter((c) => c.keyword.trim()).length === 1 ? '' : 's'} set`} />
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', margin: 0, opacity: 0.65 }}>
                      Accommodations and AI-use disclosures are shown on every job posting automatically — no need to write them here.
                    </p>
                  </FadeSection>
                </>
              )}

              <FormError message={error} />
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                {step > 0 && (
                  <Button variant="ghost" size="lg" onClick={handleBack} disabled={saving} style={{ width: 'auto', flex: '0 0 110px' }}>
                    Back
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
              {step === LAST_STEP && (
                <button
                  onClick={() => nav('hr-jobs')}
                  className="btn-animate"
                  style={{
                    display: 'block', width: 'fit-content', margin: '0 auto', padding: '9px 20px', borderRadius: 999,
                    border: '1px solid var(--border-hairline)', background: 'transparent', cursor: 'pointer',
                    fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </FadeSection>
      </section>
    </div>
  );
}
export default JobPostingForm;
