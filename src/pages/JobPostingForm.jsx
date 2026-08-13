// HR job posting create/edit form.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Select } from '../components/core/Select/Select.jsx';
import { createJob, updateJob } from '../lib/jobs.js';
import { listCriteriaForJob, replaceCriteriaForJob, suggestCriteria } from '../lib/criteria.js';
import { listJobCategories } from '../lib/jobCategories.js';

const EMPTY = {
  title: '', category: '', location: '', employment_type: '', open_positions: 1,
  description: '', required_qualifications: '', preferred_qualifications: '',
  application_deadline: '',
};

const EMPTY_CRITERION = { keyword: '', weight: 3 };

function CriteriaEditor({ criteria, onChange, onAdd, onRemove, onSuggest, suggesting, suggestError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Screening Criteria</span>
        <Button variant="ghost" size="sm" onClick={onSuggest} disabled={suggesting}>
          {suggesting ? 'Asking AI…' : '✨ Suggest with AI'}
        </Button>
      </div>
      <p style={{ fontSize: 'var(--text-xs)', margin: 0, opacity: 0.7 }}>
        Keywords/skills the resume-analysis stage will match applicants against, each weighted by importance (1 = nice to have, 5 = critical).
        AI can draft a starting list from the description and qualifications below — review and adjust before saving.
      </p>
      {suggestError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)' }}>{suggestError}</div>}
      {criteria.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
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

const TEXTAREA_STYLE = {
  width: '100%', boxSizing: 'border-box', padding: '12px 18px', minHeight: 100,
  background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
  border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', resize: 'vertical',
};

function Textarea({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', fontFamily: 'var(--font-ui)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>
      <textarea value={value} onChange={onChange} style={TEXTAREA_STYLE} />
    </label>
  );
}

export function JobPostingForm({ job, profile, nav }) {
  const isEdit = Boolean(job?.id);
  const [form, setForm] = useState(() => ({ ...EMPTY, ...job }));
  const [criteria, setCriteria] = useState([{ ...EMPTY_CRITERION }]);
  const [categories, setCategories] = useState([]);
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

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.category.trim()) {
      setError('Category is required.');
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
    nav('hr-dashboard');
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
        <div onClick={() => nav('hr-dashboard')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginBottom: 20 }}>&larr; Back to Dashboard</div>
        <h1 style={{ fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 30px' }}>{isEdit ? 'Edit Job Posting' : 'New Job Posting'}</h1>
        <div style={{ background: 'var(--surface-card)', borderRadius: 4, padding: '40px 50px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Input label="Title:" value={form.title} onChange={set('title')} />
          <div style={{ display: 'flex', gap: 20 }}>
            <Select label="Category:" value={form.category} onChange={set('category')} options={categories} placeholder="Select a category" />
            <Input label="Location:" value={form.location} onChange={set('location')} />
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <Input label="Employment Type:" value={form.employment_type} onChange={set('employment_type')} placeholder="Full-time, Contractual, etc." />
            <Input label="Open Positions:" type="number" value={form.open_positions} onChange={set('open_positions')} />
          </div>
          <Input label="Application Deadline:" type="date" value={form.application_deadline || ''} onChange={set('application_deadline')} />
          <Textarea label="Key Responsibilities (Description):" value={form.description} onChange={set('description')} />
          <Textarea label="Required Qualifications:" value={form.required_qualifications} onChange={set('required_qualifications')} />
          <Textarea label="Preferred Qualifications:" value={form.preferred_qualifications} onChange={set('preferred_qualifications')} />
          <CriteriaEditor
            criteria={criteria}
            onChange={updateCriterion}
            onAdd={addCriterion}
            onRemove={removeCriterion}
            onSuggest={handleSuggest}
            suggesting={suggesting}
            suggestError={suggestError}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input
              label="Minimum Resume Match to Unlock Interview (optional):"
              type="number"
              min={0}
              max={100}
              placeholder="Uses the system-wide default"
              value={form.min_resume_match_percent ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, min_resume_match_percent: e.target.value === '' ? null : e.target.value }))}
              hint="Leave blank to use the system-wide default set on the HR Head dashboard. Set a number (0–100) to require a different resume match score just for this role."
            />
          </div>
          <p style={{ fontSize: 'var(--text-sm)', margin: 0, opacity: 0.7 }}>
            Accommodations and AI-use disclosures are shown on every job posting automatically — no need to write them here.
          </p>
          {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="strong" size="md" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="ghost" size="md" onClick={() => nav('hr-dashboard')}>Cancel</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
export default JobPostingForm;
