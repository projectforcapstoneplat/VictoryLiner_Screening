// HR job posting create/edit form.
import { useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { createJob, updateJob } from '../lib/jobs.js';
import logo from '../assets/logo.png';

const EMPTY = {
  title: '', category: '', location: '', employment_type: '', open_positions: 1,
  description: '', required_qualifications: '', preferred_qualifications: '',
  application_deadline: '',
};

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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      open_positions: Number(form.open_positions) || 1,
      application_deadline: form.application_deadline || null,
    };
    const { error: saveError } = isEdit
      ? await updateJob(job.id, payload)
      : await createJob({ ...payload, created_by: profile.id, status: 'draft' });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    nav('hr-dashboard');
  };

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }}><Header logo={logo} links={[]} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
        <div onClick={() => nav('hr-dashboard')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginBottom: 20 }}>&larr; Back to Dashboard</div>
        <h1 style={{ fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 30px' }}>{isEdit ? 'Edit Job Posting' : 'New Job Posting'}</h1>
        <div style={{ background: 'var(--off-white-100)', borderRadius: 4, padding: '40px 50px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Input label="Title:" value={form.title} onChange={set('title')} />
          <div style={{ display: 'flex', gap: 20 }}>
            <Input label="Category:" value={form.category} onChange={set('category')} />
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
