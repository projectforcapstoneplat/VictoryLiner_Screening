// HR — manage the category-scoped video-interview question bank.
import { useEffect, useState } from 'react';
import { HrShell } from '../components/layout/HrShell/HrShell.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Input } from '../components/core/Input/Input.jsx';
import { Select } from '../components/core/Select/Select.jsx';
import {
  listQuestionsForCategory,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  suggestQuestions,
} from '../lib/interviewQuestions.js';
import { listJobCategories } from '../lib/jobCategories.js';

function QuestionRow({ question, onSave, onDelete }) {
  const [text, setText] = useState(question.question_text);
  const [saving, setSaving] = useState(false);
  const dirty = text.trim() !== question.question_text;

  const handleSave = async () => {
    setSaving(true);
    await onSave(question.id, text);
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
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
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
      <div style={{ flex: 1 }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <Button variant="strong" size="sm" onClick={handleAdd} disabled={adding}>{adding ? 'Adding…' : 'Add to Bank'}</Button>
      <Button variant="ghost" size="sm" onClick={onDiscard}>Discard</Button>
    </div>
  );
}

export function InterviewQuestions({ profile, nav }) {
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [addError, setAddError] = useState('');

  const loadCategory = async (cat) => {
    if (!cat.trim()) {
      setQuestions([]);
      return;
    }
    setLoading(true);
    const { data } = await listQuestionsForCategory(cat);
    setQuestions(data);
    setLoading(false);
  };

  useEffect(() => {
    listJobCategories().then(({ data }) => setCategories(data.map((c) => c.name)));
  }, []);

  useEffect(() => {
    setDrafts([]);
    setSuggestError('');
    setAddError('');
    const timeout = setTimeout(() => loadCategory(category), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const handleSave = async (id, text) => {
    if (!text.trim()) return;
    const { data } = await updateQuestion(id, { questionText: text });
    if (data) setQuestions((qs) => qs.map((q) => (q.id === id ? data : q)));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    await deleteQuestion(id);
    setQuestions((qs) => qs.filter((q) => q.id !== id));
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
      setNewQuestionText('');
    }
  };

  const handleSuggest = async () => {
    setSuggestError('');
    if (!category.trim()) {
      setSuggestError('Enter a category first.');
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
      setDrafts((ds) => ds.filter((_, i) => i !== index));
    }
  };

  const handleDiscardDraft = (index) => {
    setDrafts((ds) => ds.filter((_, i) => i !== index));
  };

  return (
    <HrShell active="interview-questions" nav={nav} profile={profile}>
      <div style={{ maxWidth: 900 }}>
        <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>Interview Questions</h1>
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginBottom: 30 }}>
          Questions are organized by job category — every published job automatically draws 3 questions from the bank for its category, so build the list once per category rather than per job.
        </p>
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '40px 50px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ maxWidth: 360 }}>
            <Select label="Category:" value={category} onChange={(e) => setCategory(e.target.value)} options={categories} placeholder="Select a category" />
          </div>

          {category.trim() && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Question Bank — {category}</span>
                <Button variant="ghost" size="sm" onClick={handleSuggest} disabled={suggesting}>
                  {suggesting ? 'Asking AI…' : '✨ Suggest with AI'}
                </Button>
              </div>
              {suggestError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)' }}>{suggestError}</div>}

              {loading ? (
                <p style={{ fontSize: 'var(--text-sm)' }}>Loading…</p>
              ) : questions.length === 0 && drafts.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7 }}>No questions yet for this category. Add one below or ask AI for a starting set.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {questions.map((q) => (
                    <QuestionRow key={q.id} question={q} onSave={handleSave} onDelete={handleDelete} />
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
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <Input label="New question:" value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} placeholder="Type a question and add it to the bank" />
                </div>
                <Button variant="ghost" size="sm" onClick={handleAddManual} disabled={addingManual}>{addingManual ? 'Adding…' : '+ Add'}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </HrShell>
  );
}
export default InterviewQuestions;
