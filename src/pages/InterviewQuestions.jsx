// HR — manage the category-scoped video-interview question bank.
//
// The old version was just a dropdown on an otherwise blank page — no way
// to tell which categories already had questions without clicking through
// each one individually. This version leads with a category overview grid
// (question count per category, empty ones flagged red) so gaps are visible
// at a glance: a category with 0 questions means any job posted under it
// can't actually run its video-screening stage, which is worth surfacing
// prominently, not discovering by accident later.
import { useEffect, useMemo, useRef, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import {
  listAllQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  suggestQuestions,
} from '../lib/interviewQuestions.js';
import { listJobCategories } from '../lib/jobCategories.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';

const ICON_PROPS = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const QUESTION_ICON = <svg {...ICON_PROPS}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.6-2.2 1.8-2.3 3.3" /><circle cx="12" cy="16.3" r="0.15" fill="var(--action-primary-bg)" /></svg>;
const WARN_ICON = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--red-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>;

function QuestionRow({ index, question, onSave, onDelete }) {
  const [text, setText] = useState(question.question_text);
  const [saving, setSaving] = useState(false);
  const dirty = text.trim() !== question.question_text;

  const handleSave = async () => {
    setSaving(true);
    await onSave(question.id, text);
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', background: 'var(--surface-page)', borderRadius: 10, padding: '12px 14px' }}>
      <span style={{
        width: 26, height: 26, borderRadius: '50%', background: 'var(--pink-100)', color: 'var(--action-primary-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 800, flexShrink: 0, marginBottom: 12,
      }}>
        {index + 1}
      </span>
      <div style={{ flex: 1 }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {dirty && <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>}
      <Button variant="ghost" size="sm" onClick={() => onDelete(question.id)}>Delete</Button>
    </div>
  );
}

function DraftRow({ text: initialText, onAdd, onDiscard }) {
  const [text, setText] = useState(initialText);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    await onAdd(text);
    setAdding(false);
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', background: '#fff8ec', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ flex: 1 }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <Button variant="strong" size="sm" onClick={handleAdd} disabled={adding}>{adding ? 'Adding…' : 'Add to Bank'}</Button>
      <Button variant="ghost" size="sm" onClick={onDiscard}>Discard</Button>
    </div>
  );
}

function CategoryCard({ name, count, configuredCount, active, onClick }) {
  const empty = count === 0;
  // Every applicant in this category gets the same questions in the same
  // draw pool as everyone else if the bank isn't bigger than what's
  // actually asked — randomizing which N get picked (see
  // ensureAssignedResponses in src/lib/interview.js) has nothing to vary
  // when there's nothing extra to draw from.
  const noVariety = !empty && count <= configuredCount;
  return (
    <button
      onClick={onClick}
      className="btn-animate"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, textAlign: 'left',
        padding: '16px 18px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
        border: active ? '2px solid var(--action-primary-bg)' : '1px solid var(--border-hairline)',
        background: active ? 'var(--pink-100)' : 'var(--surface-card)',
      }}
    >
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{name}</span>
      <span style={{
        fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4,
        background: empty ? '#fdecea' : noVariety ? '#fff4de' : '#e3f6e6', color: empty ? 'var(--red-700)' : noVariety ? '#a3690b' : '#0ca30c',
      }}>
        {empty && WARN_ICON}
        {empty ? 'No questions yet' : `${count} question${count === 1 ? '' : 's'}`}
      </span>
      {noVariety && (
        <span style={{ fontSize: 10, opacity: 0.65 }}>Same {count === 1 ? 'question' : 'set'} every time — add more for variety</span>
      )}
    </button>
  );
}

export function InterviewQuestions({ profile, nav, initialCategory }) {
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [addError, setAddError] = useState('');
  const [questionCount, setQuestionCount] = useState(3);

  useEffect(() => {
    Promise.all([listJobCategories(), listAllQuestions(), getScreeningSettings()]).then(([catResult, qResult, settingsResult]) => {
      setCategories(catResult.data.map((c) => c.name));
      setAllQuestions(qResult.data || []);
      if (settingsResult.data?.interview_question_count) setQuestionCount(settingsResult.data.interview_question_count);
      setLoadingCategories(false);
    });
  }, []);

  // Counts drive the overview grid — computed from the one listAllQuestions()
  // fetch on mount rather than a per-category query, so opening the page
  // costs exactly two requests total regardless of how many categories exist.
  const countByCategory = useMemo(() => {
    const counts = new Map();
    for (const q of allQuestions) {
      const key = q.category.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [allQuestions]);

  const emptyCategoryCount = useMemo(
    () => categories.filter((c) => !countByCategory.get(c)).length,
    [categories, countByCategory],
  );

  const selectCategory = (cat) => {
    setCategory(cat);
    setDrafts([]);
    setSuggestError('');
    setAddError('');
    setQuestions(allQuestions.filter((q) => q.category.trim().toLowerCase() === cat.trim().toLowerCase()));
  };

  // Lands pre-selected on a specific category when arriving from the HR
  // notification bell's "missing questions" alert (HrShell.jsx) — otherwise
  // clicking that notification would just dump HR back onto the same blank
  // grid they'd have to re-scan by eye for the exact category it was about.
  // Guarded to fire once: without it, this would re-fire on every re-render
  // and stomp a category HR deliberately clicked afterward.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (loadingCategories || autoSelectedRef.current) return;
    autoSelectedRef.current = true;
    if (initialCategory && categories.includes(initialCategory)) selectCategory(initialCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCategories]);

  const handleSave = async (id, text) => {
    if (!text.trim()) return;
    const { data } = await updateQuestion(id, { questionText: text });
    if (data) {
      setQuestions((qs) => qs.map((q) => (q.id === id ? data : q)));
      setAllQuestions((qs) => qs.map((q) => (q.id === id ? data : q)));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    await deleteQuestion(id);
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    setAllQuestions((qs) => qs.filter((q) => q.id !== id));
  };

  const handleAddManual = async () => {
    setAddError('');
    const text = newQuestionText.trim();
    if (!category.trim() || !text || addingManual) return;
    if (questions.some((q) => q.question_text.trim().toLowerCase() === text.toLowerCase())) {
      setAddError('That question is already in the bank for this category.');
      return;
    }
    setAddingManual(true);
    const { data } = await createQuestion({ category, questionText: text, createdBy: profile.id });
    setAddingManual(false);
    if (data) {
      setQuestions((qs) => [...qs, data]);
      setAllQuestions((qs) => [...qs, data]);
      setNewQuestionText('');
    }
  };

  const handleSuggest = async () => {
    setSuggestError('');
    if (!category.trim()) {
      setSuggestError('Select a category first.');
      return;
    }
    setSuggesting(true);
    const { data, error } = await suggestQuestions({ category });
    setSuggesting(false);
    if (error) {
      setSuggestError(error);
      return;
    }
    const existing = new Set(questions.map((q) => q.question_text.trim().toLowerCase()));
    const newDrafts = (data || []).filter((q) => q && !existing.has(q.trim().toLowerCase()));
    setDrafts(newDrafts);
  };

  const handleAddDraft = async (index, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (questions.some((q) => q.question_text.trim().toLowerCase() === trimmed.toLowerCase())) {
      setDrafts((ds) => ds.filter((_, i) => i !== index));
      return;
    }
    const { data } = await createQuestion({ category, questionText: trimmed, createdBy: profile.id });
    if (data) {
      setQuestions((qs) => [...qs, data]);
      setAllQuestions((qs) => [...qs, data]);
      setDrafts((ds) => ds.filter((_, i) => i !== index));
    }
  };

  const handleDiscardDraft = (index) => {
    setDrafts((ds) => ds.filter((_, i) => i !== index));
  };

  return (
    <HrShell active="interview-questions" nav={nav} profile={profile}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>Interview Questions</h1>
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginBottom: 24 }}>
          Questions are organized by job category — every published job automatically draws {questionCount} random question{questionCount === 1 ? '' : 's'} from the bank for its category, so build the list once per category rather than per job. Keep each category's bank bigger than {questionCount} so applicants don't all get the exact same {questionCount === 1 ? 'question' : 'set'}.
        </p>

        {!loadingCategories && emptyCategoryCount > 0 && (
          <div style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {WARN_ICON}
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)', fontWeight: 600 }}>
              {emptyCategoryCount} categor{emptyCategoryCount === 1 ? 'y has' : 'ies have'} no interview questions yet — any job posted under {emptyCategoryCount === 1 ? 'it' : 'them'} can&rsquo;t run its video-screening stage.
            </span>
          </div>
        )}

        {loadingCategories ? (
          <p style={{ opacity: 0.7 }}>Loading categories…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            {categories.map((cat) => (
              <CategoryCard key={cat} name={cat} count={countByCategory.get(cat) || 0} configuredCount={questionCount} active={category === cat} onClick={() => selectCategory(cat)} />
            ))}
          </div>
        )}

        {category.trim() && (
          <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: 'clamp(24px, 4vw, 40px) clamp(20px, 4vw, 50px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{QUESTION_ICON}</span>
                <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{category}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSuggest} disabled={suggesting}>
                {suggesting ? 'Asking AI…' : '✨ Suggest with AI'}
              </Button>
            </div>
            {questions.length > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', margin: 0, color: questions.length <= questionCount ? '#a3690b' : 'inherit', opacity: questions.length <= questionCount ? 1 : 0.65 }}>
                {questions.length} question{questions.length === 1 ? '' : 's'} in this bank — {questionCount} randomly asked per applicant.
                {questions.length <= questionCount && ' Every applicant currently gets the exact same set — add more questions so it actually varies.'}
              </p>
            )}
            {suggestError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)' }}>{suggestError}</div>}

            {questions.length === 0 && drafts.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7 }}>No questions yet for this category. Add one below or ask AI for a starting set.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {questions.map((q, i) => (
                  <QuestionRow key={q.id} index={i} question={q} onSave={handleSave} onDelete={handleDelete} />
                ))}
              </div>
            )}

            {drafts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>AI suggestions — review and add the ones you want:</span>
                {drafts.map((text, i) => (
                  <DraftRow key={i} text={text} onAdd={(t) => handleAddDraft(i, t)} onDiscard={() => handleDiscardDraft(i)} />
                ))}
              </div>
            )}

            {addError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)' }}>{addError}</div>}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 8, borderTop: '1px solid var(--border-hairline)', paddingTop: 18 }}>
              <div style={{ flex: 1 }}>
                <Input label="New question:" value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} placeholder="Type a question and add it to the bank" />
              </div>
              <Button variant="strong" size="sm" onClick={handleAddManual} disabled={addingManual}>{addingManual ? 'Adding…' : '+ Add'}</Button>
            </div>
          </div>
        )}
      </div>
    </HrShell>
  );
}
export default InterviewQuestions;
