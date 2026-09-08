// Resume-section building blocks (work experience, education, skills, driving
// fields, etc.) used by ResumeForm.jsx — the one standalone "fill once"
// resume every applicant completes before browsing or matching to jobs.
import { useState } from 'react';
import { Input } from '../../core/Input/Input.jsx';
import { Button } from '../../core/Button/Button.jsx';

// Sections stagger in on mount via the shared `.fade-in-up` keyframe (see
// styles.css), not scroll-triggered `Reveal` — this is a required form, not a
// marketing page, so every field must be reliably visible regardless of how
// the user scrolls (a fast/instant scroll can skip the intermediate frames
// IntersectionObserver needs, which would leave a Reveal-wrapped section
// stuck invisible). Mount-time animation can't have that failure mode.
export function FadeSection({ delay, style, children }) {
  return <div className="fade-in-up" style={{ animationDelay: `${delay}s`, ...style }}>{children}</div>;
}

export const EMPTY_EXPERIENCE = { company: '', position: '', startDate: '', endDate: '', description: '' };
export const EMPTY_EDUCATION = { school: '', degree: '', yearGraduated: '' };
export const EMPTY_CERTIFICATION = { title: '', issuer: '', year: '' };

export const EDUCATION_LEVELS = [
  'High School Graduate',
  'Vocational / TESDA Graduate',
  'College Undergraduate',
  "College Graduate (Bachelor's Degree)",
  'Post-Graduate',
];

// LTO driver's license restriction codes relevant to a bus operator (skips
// the tricycle-only codes 1/8, not applicable here).
export const LICENSE_RESTRICTION_CODES = [
  { code: '2', label: '2 — up to 4,500 kg GVW' },
  { code: '3', label: '3 — above 4,500 kg GVW' },
  { code: '4', label: '4 — automatic, up to 4,500 kg' },
  { code: '5', label: '5 — automatic, above 4,500 kg' },
  { code: '6', label: '6 — articulated, up to 4,500 kg' },
  { code: '7', label: '7 — articulated, above 4,500 kg' },
];

export function isPhoneValid(phone) {
  const digits = phone.replace(/[\s-]/g, '');
  return /^(\+63|0)9\d{9}$/.test(digits);
}

export const SECTION_STYLE = { display: 'flex', flexDirection: 'column', gap: 14, width: '100%' };
// Two-per-row layout for short fields (Name/Email, Company/Position, dates,
// etc.) so the form reads as a compact grid instead of one long single-column
// scroll. Plain `minmax(120px, 1fr)` packs in as MANY 120px+ columns as fit —
// on a wide screen that means 3-4 columns, not 2, cramming fields together.
// `max(120px, (100% - gap)/2)` pins each column's floor at half the row
// width (never above 120px on tiny screens), so at most 2 columns can ever
// fit — auto-fit only drops to 1 column when even 120px x2 doesn't fit.
export const GRID_2COL = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(max(120px, (100% - 12px) / 2), 1fr))', gap: 12, width: '100%' };
export const ENTRY_STYLE = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(max(120px, (100% - 10px) / 2), 1fr))', gap: 10, padding: 'clamp(14px, 4vw, 20px)', background: 'var(--surface-page)', borderRadius: 4 };
export const FIELD_STYLE = {
  width: '100%', boxSizing: 'border-box', padding: '12px 18px',
  background: 'var(--surface-field)', boxShadow: 'var(--shadow-field-inset)',
  border: 'none', borderRadius: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
};

const ICON_PROPS = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const SECTION_ICONS = {
  basic: <svg {...ICON_PROPS}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>,
  experience: <svg {...ICON_PROPS}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  education: <svg {...ICON_PROPS}><path d="M2 9l10-5 10 5-10 5-10-5z" /><path d="M6 11.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" /></svg>,
  skills: <svg {...ICON_PROPS}><path d="M12 2l2.6 6.6L21 9.3l-5 4.5 1.4 7.2L12 17.5 6.6 21l1.4-7.2-5-4.5 6.4-.7z" /></svg>,
  driving: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4.5V9M12 15v4.5M5.5 8.5l3.8 2.4M14.7 13.1l3.8 2.4M18.5 8.5l-3.8 2.4M9.3 13.1l-3.8 2.4" /></svg>,
  preferences: <svg {...ICON_PROPS}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  certifications: <svg {...ICON_PROPS}><circle cx="12" cy="9" r="6" /><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" /></svg>,
  note: <svg {...ICON_PROPS}><path d="M5 3h11l3 3v15H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>,
};

export function SectionHeader({ icon, title, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && (
          <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </span>
        )}
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{title}</span>
      </div>
      {hint && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65, marginLeft: icon ? 34 : 0 }}>{hint}</span>}
    </div>
  );
}

export function RepeatableSection({ title, icon, hint, delay, entries, fields, onChange, onAdd, onRemove, addLabel }) {
  return (
    <FadeSection delay={delay} style={SECTION_STYLE}>
      <SectionHeader icon={icon} title={title} hint={hint} />
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
export function TagInput({ label, values, onChange, placeholder, hint }) {
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
