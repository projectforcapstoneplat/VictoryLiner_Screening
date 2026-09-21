// Resume-section building blocks (work experience, education, skills, driving
// fields, etc.) used by ResumeForm.jsx — the one standalone "fill once"
// resume every applicant completes before browsing or matching to jobs.
import { forwardRef, useEffect, useRef, useState } from 'react';
import { ConfirmModal } from '../../core/ConfirmModal/ConfirmModal.jsx';
import { DROPDOWN_ARROW_STYLE } from '../../core/Select/Select.jsx';

// Grows a textarea to fit whatever's typed in it instead of a fixed box
// with an internal scrollbar (or a manual drag-handle nobody notices) —
// height:auto first so shrinking (deleting text) is picked up too, not just
// growth; scrollHeight alone would only ever ratchet taller. Plain ref
// callback (not memoized) so it also re-measures on every render, not just
// on mount — the description field can gain content from outside a
// keystroke (parsed resume upload autofilling it), and a stale height from
// mount time wouldn't grow to fit that. Harmless to re-run on a plain
// textarea (no stream/video to glitch from repeated attach, unlike the
// video-element ref-callback pitfall elsewhere in this app).
export function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

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

// gap is vh-based, not a flat 30px — both wizards built on this (ResumeForm,
// JobPostingForm) cap their card to a viewport-relative maxHeight and scroll
// the step content internally past that; a flat gap doesn't shrink on a
// short-but-wide laptop window the way the available space actually does,
// so it kept forcing even a short step (a handful of fields) into its own
// scrollbar. Still 30px on a tall screen, just not a fixed cost everywhere.
export const SECTION_STYLE = { display: 'flex', flexDirection: 'column', gap: 'clamp(14px, 2.2vh, 30px)', width: '100%' };
// Two-per-row layout for short fields (Name/Email, Company/Position, dates,
// etc.) so the form reads as a compact grid instead of one long single-column
// scroll. Plain `minmax(120px, 1fr)` packs in as MANY 120px+ columns as fit —
// on a wide screen that means 3-4 columns, not 2, cramming fields together.
// `max(120px, (100% - gap)/2)` pins each column's floor at half the row
// width (never above 120px on tiny screens), so at most 2 columns can ever
// fit — auto-fit only drops to 1 column when even 120px x2 doesn't fit.
export const GRID_2COL = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(max(120px, (100% - 28px) / 2), 1fr))', gap: 28, width: '100%' };
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

const CHEVRON_DOWN_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>;
const REMOVE_X_ICON = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5l14 14M19 5L5 19" /></svg>;
const WARNING_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.6 3.9a2 2 0 0 0-3.3 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const PLUS_ICON = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const TRASH_ICON = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>;

// The one field look used everywhere in Build/Continue Your Resume —
// uppercase label, red required asterisk, optional leading icon, rounded
// box — deliberately not a change to the shared Input component, which
// every other form in the app (Sign In, Job Posting, HR settings...) also
// renders, and none of those asked for this look. forwardRef so a field can
// be focused programmatically (see focusNext in Basic Information — Enter
// moves focus to the next field instead of doing nothing).
export const ResumeField = forwardRef(function ResumeField({ label, required, icon, error, hint, style, ...inputProps }, ref) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', fontFamily: 'var(--font-ui)', ...style }}>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-primary)', opacity: 0.7 }}>
        {label}{required && <span style={{ color: 'var(--action-primary-bg)' }}> *</span>}
      </span>
      <div style={{ position: 'relative', width: '100%' }}>
        {icon && (
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--action-primary-bg)', opacity: 0.75, pointerEvents: 'none' }}>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          {...inputProps}
          // Hides the native number-input spinner (up/down stepper) — see
          // ".resume-field-input" rule in ResumeForm.jsx's own <style> block.
          className="resume-field-input"
          style={{
            height: 46, width: '100%', boxSizing: 'border-box', padding: icon ? '0 16px 0 40px' : '0 16px',
            background: 'var(--surface-field)', border: error ? '1.5px solid var(--red-700)' : '1px solid var(--border-hairline)',
            borderRadius: 10, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
          }}
        />
      </div>
      {hint && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>{hint}</span>}
    </label>
  );
});

// Same visual language as ResumeField above, for a <select> instead of an
// <input> — Education Level, Driver's License Type.
export function ResumeSelect({ label, required, error, value, onChange, options, placeholder = 'Select…', style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', fontFamily: 'var(--font-ui)', ...style }}>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-primary)', opacity: 0.7 }}>
        {label}{required && <span style={{ color: 'var(--action-primary-bg)' }}> *</span>}
      </span>
      <select
        value={value}
        onChange={onChange}
        style={{
          height: 46, width: '100%', boxSizing: 'border-box', padding: '0 40px 0 16px',
          background: 'var(--surface-field)', border: error ? '1.5px solid var(--red-700)' : '1px solid var(--border-hairline)',
          borderRadius: 10, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', cursor: 'pointer',
          ...DROPDOWN_ARROW_STYLE,
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

export function SectionHeader({ icon, title, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid var(--border-hairline)' }}>
        {icon && (
          <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </span>
        )}
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{title}</span>
      </div>
      {hint && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65, marginLeft: icon ? 34 : 0 }}>{hint}</span>}
    </div>
  );
}

// `summary`, when given, turns this from "every entry always fully
// expanded" into a collapse-by-default accordion — the real fix for an
// applicant with 5 work experience entries otherwise having to scroll past
// 4 full edit forms just to reach the 5th. An entry starts collapsed the
// moment it already has real content in it (i.e. it was filled in on a
// previous visit) and expanded while it's still blank — no separate
// "loaded from server vs freshly added" tracking needed, this falls out of
// the data itself. Only one entry can be inline-expanded at a time (opening
// one collapses whichever was open) — reviewing several already-filled
// entries at once was never really "compare them side by side," it was just
// several full edit forms stacked on screen simultaneously.
//
// Adding a brand new entry happens in a modal instead of appearing inline —
// a full 5-field form (Work Experience) landing in the middle of an
// otherwise-tidy list of one-line summaries undoes the whole point of
// collapsing the others. The modal edits the exact same array entry via the
// normal onChange(i, key, value) — Cancel discards it via onRemove, Save
// just closes the modal (nothing extra to persist, onChange already did).
//
// A field can be flagged `required: true` in its config to drive a small
// red warning icon on that entry's collapsed row when it's missing — a
// visual nudge, not a hard gate; the real submit-blocking validation stays
// wherever ResumeForm.jsx already enforces it.
//
// Omitting `summary` keeps the old always-expanded, no-modal behavior, so
// any future caller that doesn't opt in is unaffected.
export function RepeatableSection({ title, icon, hint, delay, entries, fields, onChange, onAdd, onRemove, addLabel, summary }) {
  const hasContent = (entry) => fields.some((f) => `${entry[f.key] ?? ''}`.trim());
  // Only flags an entry once it actually has *some* content — a brand-new
  // blank entry (the default starter row, or one that's simply never been
  // touched) isn't "missing required information," it just hasn't been
  // filled in yet. This matters even more for a section that's entirely
  // optional (Certifications): an untouched blank row there is normal, not
  // a mistake, and shouldn't read as one.
  const isIncomplete = (entry) => hasContent(entry) && fields.some((f) => f.required && !`${entry[f.key] ?? ''}`.trim());
  // Starts open on whichever single entry is still blank, if any (a fresh
  // one-entry resume) — otherwise nothing starts expanded.
  const [expandedIndex, setExpandedIndex] = useState(() => entries.findIndex((e) => !hasContent(e)));
  const [pendingRemove, setPendingRemove] = useState(null);
  const [addModalIndex, setAddModalIndex] = useState(null);
  // One DOM node per entry, keyed by index — lets expanding an entry
  // scroll it into view centered, instead of leaving the newly-opened form
  // wherever it happened to land (e.g. its bottom half past the edge of the
  // scrollable list, Remove/Next unreachable without scrolling manually).
  const entryRefs = useRef({});

  useEffect(() => {
    if (expandedIndex < 0) return;
    entryRefs.current[expandedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [expandedIndex]);

  const toggle = (i) => setExpandedIndex((prev) => (prev === i ? -1 : i));

  const handleOpenAdd = () => {
    const newIndex = entries.length;
    onAdd();
    setExpandedIndex(-1);
    setAddModalIndex(newIndex);
  };
  const handleSaveAdd = () => setAddModalIndex(null);
  const handleCancelAdd = () => {
    if (addModalIndex != null) onRemove(addModalIndex);
    setAddModalIndex(null);
  };

  // Indices above the removed one all shift down by one — remap rather
  // than leaving expandedIndex pointing at whatever now sits there.
  const handleRemove = (i) => {
    onRemove(i);
    setExpandedIndex((prev) => (prev === i ? -1 : prev > i ? prev - 1 : prev));
  };
  const confirmRemove = () => {
    if (pendingRemove == null) return;
    handleRemove(pendingRemove);
    setPendingRemove(null);
  };
  const pendingEntry = pendingRemove != null ? entries[pendingRemove] : null;
  const pendingLabel = pendingEntry && summary ? summary(pendingEntry).primary : 'this entry';

  // `hint` renders as a small caption *below* the field rather than being
  // crammed into the label text itself — a label long enough to wrap onto 2
  // lines pushes just that one field's input down relative to its shorter
  // neighbor in the same grid row (e.g. "Start Date" next to "End Date
  // (leave blank if current)"), throwing off the whole row's alignment.
  // Keeping every label to one line and moving the extra explanation into
  // the hint avoids that entirely. Field configs still carry a trailing
  // colon from this page's older field-label convention ("Company:") —
  // stripped here rather than in every config, since ResumeField's own
  // uppercase + required-asterisk treatment already reads as a label
  // without needing the colon too ("COMPANY *", not "COMPANY: *").
  const renderFields = (entry, i) => fields.map(({ key, label, type, placeholder, hint, wide, required }) => {
    // Same "don't flag it until there's actually something to be
    // incomplete about" rule as isIncomplete above — a brand-new blank
    // entry's fields shouldn't all light up red before anyone's typed
    // anything.
    const missing = hasContent(entry) && required && !`${entry[key] ?? ''}`.trim();
    const cleanLabel = label.replace(/:\s*$/, '');
    return type === 'textarea' ? (
      <label key={key} style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-primary)', opacity: 0.7 }}>
        {cleanLabel}{required && <span style={{ color: 'var(--action-primary-bg)' }}> *</span>}
        <textarea
          ref={autoResizeTextarea}
          value={entry[key]}
          onChange={(e) => { onChange(i, key, e.target.value); autoResizeTextarea(e.target); }}
          placeholder={placeholder}
          style={{
            minHeight: 80, width: '100%', boxSizing: 'border-box', padding: '12px 16px', resize: 'none', overflow: 'hidden',
            background: 'var(--surface-field)', border: missing ? '1.5px solid var(--red-700)' : '1px solid var(--border-hairline)',
            borderRadius: 10, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text-primary)',
          }}
        />
      </label>
    ) : (
      <div key={key} style={wide ? { gridColumn: '1 / -1' } : undefined}>
        <ResumeField label={cleanLabel} required={required} type={type} placeholder={placeholder} hint={hint} error={missing} value={entry[key]} onChange={(e) => onChange(i, key, e.target.value)} />
      </div>
    );
  });

  // The two ConfirmModals below render as siblings of FadeSection, not
  // children of it — FadeSection's own entrance animation leaves a
  // lingering `transform` on itself even after finishing (animation-fill-
  // mode: both, see .fade-in-up in styles.css), and a `position: fixed`
  // descendant of a transformed ancestor is positioned/clipped relative to
  // THAT ancestor instead of the real viewport. Nested inside FadeSection,
  // the modal rendered squeezed into this section's own bounds instead of
  // centered over the whole page.
  return (
    <>
    <FadeSection delay={delay} style={SECTION_STYLE}>
      <SectionHeader icon={icon} title={title} hint={hint} />
      {entries.map((entry, i) => {
        if (i === addModalIndex) return null; // being edited in the Add modal instead, not inline
        if (summary && expandedIndex !== i) {
          const { primary, secondary } = summary(entry);
          const incomplete = isIncomplete(entry);
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => toggle(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); } }}
              style={{
                ...ENTRY_STYLE, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                ...(incomplete ? { background: 'var(--pink-100)', boxShadow: 'inset 0 0 0 1px var(--red-700)' } : null),
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <strong style={{ fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: incomplete ? 'var(--red-700)' : undefined }}>{primary}</strong>
                {secondary && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {incomplete && (
                  <span title="Missing required information" style={{ display: 'flex', color: 'var(--red-700)' }}>{WARNING_ICON}</span>
                )}
                {entries.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={(e) => { e.stopPropagation(); setPendingRemove(i); }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', opacity: 0.45, padding: 6, display: 'flex' }}
                  >
                    {REMOVE_X_ICON}
                  </button>
                )}
                <span style={{ display: 'flex', color: 'var(--text-primary)', opacity: 0.5 }}>{CHEVRON_DOWN_ICON}</span>
              </div>
            </div>
          );
        }
        return (
          <div key={i} ref={(el) => { entryRefs.current[i] = el; }} style={ENTRY_STYLE}>
            {/* Same toggle affordance as the collapsed row, just flipped —
                without this, the only way back to collapsed was a small
                ghost "Done" button buried below every field including the
                description textarea, easy to miss entirely. */}
            {summary && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggle(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); } }}
                style={{
                  gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
                  cursor: 'pointer', color: 'var(--text-primary)', opacity: 0.55, fontSize: 'var(--text-xs)', fontWeight: 600,
                }}
              >
                Collapse
                <span style={{ display: 'flex', transform: 'rotate(180deg)' }}>{CHEVRON_DOWN_ICON}</span>
              </div>
            )}
            {renderFields(entry, i)}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPendingRemove(i)}
                  className="btn-animate"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999,
                    border: '1px solid var(--red-700)', background: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--red-700)',
                  }}
                >
                  {TRASH_ICON}
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={handleOpenAdd}
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
        {addLabel.replace(/^\+\s*/, '')}
      </button>
    </FadeSection>

    <ConfirmModal
      open={addModalIndex != null}
      title={addLabel.replace(/^\+\s*/, '')}
      confirmLabel="Save"
      cancelLabel="Cancel"
      maxWidth={520}
      onConfirm={handleSaveAdd}
      onCancel={handleCancelAdd}
    >
      {addModalIndex != null && (
        <div style={ENTRY_STYLE}>{renderFields(entries[addModalIndex], addModalIndex)}</div>
      )}
    </ConfirmModal>

    <ConfirmModal
      open={pendingRemove != null}
      title="Remove This Entry?"
      message={`Remove "${pendingLabel}"? This can't be undone.`}
      confirmLabel="Remove"
      cancelLabel="Cancel"
      onConfirm={confirmRemove}
      onCancel={() => setPendingRemove(null)}
    />
    </>
  );
}

// Chip-based multi-value input (skills) — reduces free-text typo/inconsistency
// noise ("Defensive driving" vs "defensive-driving") compared to a single
// comma-separated field, without needing a fixed skills taxonomy.
export function TagInput({ label, required, values, onChange, placeholder, hint, error }) {
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
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', fontFamily: 'var(--font-ui)' }}>
      {label && (
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-primary)', opacity: 0.7 }}>
          {label}{required && <span style={{ color: 'var(--action-primary-bg)' }}> *</span>}
        </span>
      )}
      <div style={{
        minHeight: 46, height: 'auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 14px',
        background: 'var(--surface-field)', border: error ? '1.5px solid var(--red-700)' : '1px solid var(--border-hairline)', borderRadius: 10,
      }}>
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
      {hint && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{hint}</span>}
    </label>
  );
}
