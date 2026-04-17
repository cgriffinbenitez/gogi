'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GogiNav } from '@/components/nav/GogiNav';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionRow {
  id: string;
  standard_id: string;
  content: string;
  title: string | null;
  author: string | null;
  pub_year: string | null;
  cognitive_skill_targeted: string | null;
  option_a_text: string | null;
  option_b_text: string | null;
  option_c_text: string | null;
  option_d_text: string | null;
  option_a_class: string | null;
  option_b_class: string | null;
  option_c_class: string | null;
  option_d_class: string | null;
  correct_option: string | null;
  approved: boolean | null;
  flagged: boolean | null;
  rationale: string | null;
  difficulty_level: number | null;
}

interface StandardRow {
  id: string;
  code: string;
  title: string;
}

type EditState = {
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPassageFromContent(content: string): string {
  const qIdx = content.search(/\nQUESTION:/i);
  const raw = qIdx > 0 ? content.slice(0, qIdx) : content;
  return raw
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^-{2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseOptions(content: string): Record<string, string> {
  const opts: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.trimStart().match(/^([A-D])[.)]\s*(.+)/);
    if (m) opts[m[1]] = m[2].trim();
  }
  return opts;
}

function parseQuestionStem(content: string): string {
  const lines = content.split('\n');
  const line = lines.find((l) => l.trimStart().startsWith('QUESTION:'));
  return line ? line.slice(line.indexOf('QUESTION:') + 9).trim() : '';
}

function parseCorrectOption(content: string): string {
  const lines = content.split('\n');
  const line = lines.find((l) => l.trimStart().startsWith('CORRECT:'));
  return line ? line.slice(line.indexOf('CORRECT:') + 8).replace(/[^A-D]/g, '').trim() : '';
}

function parseClassification(content: string, letter: string): string {
  const prefix = `DIAGNOSTIC_CLASSIFICATION_${letter}:`;
  const lines = content.split('\n');
  const line = lines.find((l) => l.trimStart().startsWith(prefix));
  return line ? line.slice(line.indexOf(prefix) + prefix.length).trim() : '';
}

function classificationLabel(cls: string | null): string {
  if (!cls) return '';
  return cls.replace(/_/g, ' ');
}

function classificationColor(cls: string | null): { bg: string; text: string; border: string } {
  if (!cls) return { bg: C.light, text: C.gray, border: C.border };
  if (cls.includes('schema') || cls.includes('metacognitive'))
    return { bg: C.amberLight, text: C.amber, border: C.amber };
  if (cls.includes('vocabulary') || cls.includes('morphology') || cls.includes('syntax'))
    return { bg: C.blueLight, text: C.blue, border: C.blue };
  if (cls.includes('inferencing') || cls.includes('evidence') || cls.includes('abstract') || cls.includes('comprehension'))
    return { bg: C.greenLight, text: C.green, border: C.green };
  return { bg: C.light, text: C.gray, border: C.border };
}

// ─── Classification badge ─────────────────────────────────────────────────────

function ClassBadge({ cls }: { cls: string | null }) {
  if (!cls) return null;
  const { bg, text, border } = classificationColor(cls);
  return (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: 4,
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        whiteSpace: 'nowrap',
      }}
    >
      {classificationLabel(cls)}
    </span>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  q,
  standardCode,
  onApprove,
  onFlag,
  onSaveEdit,
}: {
  q: QuestionRow;
  standardCode: string;
  onApprove: (id: string) => void;
  onFlag: (id: string) => void;
  onSaveEdit: (id: string, stem: string, opts: Record<string, string>) => void;
}) {
  const [showFullPassage, setShowFullPassage] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  // Derive structured fields — prefer explicit columns, fall back to content parsing
  const passageText = extractPassageFromContent(q.content);
  const hasQuestionBlock = q.content.includes('QUESTION:');
  const stem = q.option_a_text ? parseQuestionStem(q.content) : parseQuestionStem(q.content);

  const opts = q.option_a_text
    ? { A: q.option_a_text, B: q.option_b_text ?? '', C: q.option_c_text ?? '', D: q.option_d_text ?? '' }
    : parseOptions(q.content);

  const classes = {
    A: q.option_a_class ?? parseClassification(q.content, 'A'),
    B: q.option_b_class ?? parseClassification(q.content, 'B'),
    C: q.option_c_class ?? parseClassification(q.content, 'C'),
    D: q.option_d_class ?? parseClassification(q.content, 'D'),
  };

  const correct = q.correct_option ?? parseCorrectOption(q.content);

  const [editState, setEditState] = useState<EditState>({
    stem: stem,
    optionA: opts.A,
    optionB: opts.B,
    optionC: opts.C,
    optionD: opts.D,
  });

  // Status
  const isApproved = q.approved === true;
  const isFlagged = q.flagged === true;
  const needsReview = !isApproved && !isFlagged;

  async function handleApprove() {
    if (acting) return;
    setActing(true);
    await onApprove(q.id);
    setActing(false);
  }

  async function handleFlag() {
    if (acting) return;
    setActing(true);
    await onFlag(q.id);
    setActing(false);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    await onSaveEdit(q.id, editState.stem, {
      A: editState.optionA,
      B: editState.optionB,
      C: editState.optionC,
      D: editState.optionD,
    });
    setEditing(false);
    setSaving(false);
  }

  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${isApproved ? C.green : isFlagged ? C.red : C.border}`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        fontFamily: FONTS.ui,
      }}
    >
      {/* ── TOP ROW ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        {/* Standard badge */}
        <span
          style={{
            background: C.blueLight,
            color: C.blue,
            border: `1px solid ${C.blue}`,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {standardCode}
        </span>

        {/* Title / author */}
        <span style={{ fontSize: 12, color: C.gray }}>
          {q.title ?? 'Untitled'}
          {q.author ? ` — ${q.author}` : ''}
          {q.pub_year ? ` (${q.pub_year})` : ''}
        </span>

        {/* Difficulty */}
        {q.difficulty_level !== null && q.difficulty_level !== undefined && (
          <span style={{ fontSize: 10, color: C.gray }}>
            level {q.difficulty_level}
          </span>
        )}

        {/* Status badge */}
        <span
          style={{
            marginLeft: 'auto',
            background: isApproved ? C.greenLight : isFlagged ? C.redLight : C.amberLight,
            color: isApproved ? C.green : isFlagged ? C.red : C.amber,
            border: `1px solid ${isApproved ? C.green : isFlagged ? C.red : C.amber}`,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {isApproved ? '✓ APPROVED' : isFlagged ? '✗ FLAGGED' : 'NEEDS REVIEW'}
        </span>
      </div>

      {/* ── PASSAGE PREVIEW ──────────────────────────────────────────────────── */}
      <div
        style={{
          background: C.light,
          borderLeft: `3px solid ${C.blue}`,
          borderRadius: '0 6px 6px 0',
          padding: '10px 12px',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          PASSAGE
        </div>
        <p
          style={{
            fontSize: 13,
            fontFamily: FONTS.passage,
            fontStyle: 'italic',
            color: C.dark,
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          {showFullPassage ? passageText : passageText.slice(0, 200) + (passageText.length > 200 ? '…' : '')}
        </p>
        {passageText.length > 200 && (
          <button
            onClick={() => setShowFullPassage((v) => !v)}
            style={{
              marginTop: 6,
              background: 'none',
              border: 'none',
              color: C.blue,
              fontSize: 11,
              cursor: 'pointer',
              padding: 0,
              fontFamily: FONTS.ui,
            }}
          >
            {showFullPassage ? 'Hide passage ↑' : 'Show full passage ↓'}
          </button>
        )}
      </div>

      {!hasQuestionBlock ? (
        <div style={{ fontSize: 12, color: C.amber, marginBottom: 8 }}>
          ⚠ No question block found in content — run generateQuestions.ts to populate
        </div>
      ) : (
        <>
          {/* ── QUESTION STEM ──────────────────────────────────────────────────── */}
          {editing ? (
            <textarea
              value={editState.stem}
              onChange={(e) => setEditState((s) => ({ ...s, stem: e.target.value }))}
              style={{
                width: '100%',
                border: `1.5px solid ${C.blue}`,
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 14,
                fontWeight: 600,
                color: C.dark,
                fontFamily: FONTS.ui,
                lineHeight: 1.5,
                resize: 'vertical',
                minHeight: 60,
                boxSizing: 'border-box',
                marginBottom: 10,
                outline: 'none',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.dark,
                lineHeight: 1.55,
                marginBottom: 12,
              }}
            >
              {stem || '(no question stem parsed)'}
            </div>
          )}

          {/* ── ANSWER OPTIONS ─────────────────────────────────────────────────── */}
          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const optText = opts[letter] ?? '';
            const cls = classes[letter];
            const isCorrectOpt = correct === letter;
            const editKey = `option${letter}` as keyof EditState;

            return (
              <div
                key={letter}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 10px',
                  marginBottom: 6,
                  borderRadius: 6,
                  background: isCorrectOpt ? C.greenLight : C.light,
                  border: `1px solid ${isCorrectOpt ? C.green : C.border}`,
                }}
              >
                {/* Letter circle */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isCorrectOpt ? C.green : C.navy,
                    color: C.white,
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {letter}
                </div>

                {/* Option text */}
                <div style={{ flex: 1 }}>
                  {editing ? (
                    <input
                      value={editState[editKey] as string}
                      onChange={(e) =>
                        setEditState((s) => ({ ...s, [editKey]: e.target.value }))
                      }
                      style={{
                        width: '100%',
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        padding: '4px 6px',
                        fontSize: 13,
                        color: C.dark,
                        fontFamily: FONTS.ui,
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.5 }}>
                      {optText || <em style={{ color: C.gray }}>—</em>}
                    </span>
                  )}
                </div>

                {/* Classification badge */}
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {isCorrectOpt ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.green,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      CORRECT
                    </span>
                  ) : (
                    <ClassBadge cls={cls || null} />
                  )}
                </div>
              </div>
            );
          })}

          {/* ── RATIONALE ──────────────────────────────────────────────────────── */}
          {q.rationale && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowRationale((v) => !v)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.gray,
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: FONTS.ui,
                  textDecoration: 'underline',
                }}
              >
                {showRationale ? 'Hide rationale ↑' : 'Show rationale ↓'}
              </button>
              {showRationale && (
                <p
                  style={{
                    fontSize: 12,
                    color: C.gray,
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                    marginTop: 6,
                    padding: '8px 10px',
                    background: C.light,
                    borderRadius: 4,
                    borderLeft: `2px solid ${C.border}`,
                  }}
                >
                  {q.rationale}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 14,
          flexWrap: 'wrap',
        }}
      >
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: C.navy,
                color: C.white,
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: FONTS.ui,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                background: C.white,
                color: C.navy,
                border: `1.5px solid ${C.navy}`,
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {/* Approve */}
            {!isApproved && (
              <button
                onClick={handleApprove}
                disabled={acting}
                style={{
                  background: C.green,
                  color: C.white,
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: acting ? 'not-allowed' : 'pointer',
                  fontFamily: FONTS.ui,
                  opacity: acting ? 0.6 : 1,
                }}
              >
                ✓ Approve
              </button>
            )}

            {/* Flag */}
            {!isFlagged && (
              <button
                onClick={handleFlag}
                disabled={acting}
                style={{
                  background: C.white,
                  color: C.red,
                  border: `1.5px solid ${C.red}`,
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: acting ? 'not-allowed' : 'pointer',
                  fontFamily: FONTS.ui,
                  opacity: acting ? 0.6 : 1,
                }}
              >
                ✗ Flag
              </button>
            )}

            {/* Unflag / re-review */}
            {isFlagged && (
              <button
                onClick={handleApprove}
                disabled={acting}
                style={{
                  background: C.white,
                  color: C.green,
                  border: `1.5px solid ${C.green}`,
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: acting ? 'not-allowed' : 'pointer',
                  fontFamily: FONTS.ui,
                  opacity: acting ? 0.6 : 1,
                }}
              >
                ✓ Approve anyway
              </button>
            )}

            {/* Edit */}
            {hasQuestionBlock && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  background: C.white,
                  color: C.navy,
                  border: `1.5px solid ${C.navy}`,
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: FONTS.ui,
                }}
              >
                Edit
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminQuestionsPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [standards, setStandards] = useState<StandardRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  // Redirect effect — never call router.push() in the render body
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (role !== 'teacher') { router.push('/dashboard/student'); return; }
  }, [authLoading, user, role, router]);

  // Data load effect — only runs when auth is confirmed as teacher
  useEffect(() => {
    console.log('[AdminQuestions] role:', role, 'user:', user?.email, 'authLoading:', authLoading);

    if (authLoading || !user || role !== 'teacher') return;

    async function load() {
      try {
        const supabase = createClient();

        const [{ data: stds, error: stdsErr }, { data: qs, error: qsErr }] = await Promise.all([
          supabase
            .from('standards')
            .select('id, code, title')
            .order('code'),
          supabase
            .from('questions')
            .select(
              'id, standard_id, content, title, author, pub_year, cognitive_skill_targeted, ' +
              'option_a_text, option_b_text, option_c_text, option_d_text, ' +
              'option_a_class, option_b_class, option_c_class, option_d_class, ' +
              'correct_option, approved, flagged, rationale, difficulty_level',
            )
            .order('difficulty_level', { ascending: true }),
        ]);

        if (stdsErr) { setErrorMsg('Could not load standards: ' + stdsErr.message); setLoadState('error'); return; }
        if (qsErr)   { setErrorMsg('Could not load questions: '  + qsErr.message);  setLoadState('error'); return; }

        setStandards((stds ?? []) as unknown as StandardRow[]);
        setQuestions((qs ?? []) as unknown as QuestionRow[]);
        setLoadState('ready');
      } catch (err) {
        setErrorMsg('Unexpected error. Check console.');
        setLoadState('error');
        console.error('[AdminQuestions] load error:', err);
      }
    }

    load();
  }, [user, role, authLoading]);

  // ── Mutate helpers ────────────────────────────────────────────────────────────

  async function handleApprove(id: string) {
    const res = await fetch('/api/questions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: id }),
    });
    if (res.ok) {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, approved: true, flagged: false } : q)),
      );
    } else {
      console.error('[AdminQuestions] approve failed:', await res.text());
    }
  }

  async function handleFlag(id: string) {
    const res = await fetch('/api/questions/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: id }),
    });
    if (res.ok) {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, flagged: true, approved: false } : q)),
      );
    } else {
      console.error('[AdminQuestions] flag failed:', await res.text());
    }
  }

  async function handleSaveEdit(
    id: string,
    newStem: string,
    newOpts: Record<string, string>,
  ) {
    const supabase = createClient();
    const q = questions.find((r) => r.id === id);
    if (!q) return;

    // Rebuild content — replace question block
    const passage = extractPassageFromContent(q.content);
    const correct = q.correct_option ?? parseCorrectOption(q.content);
    const classA = q.option_a_class ?? parseClassification(q.content, 'A');
    const classB = q.option_b_class ?? parseClassification(q.content, 'B');
    const classC = q.option_c_class ?? parseClassification(q.content, 'C');
    const classD = q.option_d_class ?? parseClassification(q.content, 'D');
    const skill   = q.cognitive_skill_targeted ?? '';

    const newContent =
      passage +
      '\n\n---\n\n' +
      `QUESTION: ${newStem}\n\n` +
      `A. ${newOpts.A}\nB. ${newOpts.B}\nC. ${newOpts.C}\nD. ${newOpts.D}\n\n` +
      `CORRECT: ${correct}\n` +
      `DIAGNOSTIC_CLASSIFICATION_A: ${classA}\n` +
      `DIAGNOSTIC_CLASSIFICATION_B: ${classB}\n` +
      `DIAGNOSTIC_CLASSIFICATION_C: ${classC}\n` +
      `DIAGNOSTIC_CLASSIFICATION_D: ${classD}\n` +
      `COGNITIVE_SKILL: ${skill}`;

    const { error } = await supabase
      .from('questions')
      .update({
        content: newContent,
        option_a_text: newOpts.A,
        option_b_text: newOpts.B,
        option_c_text: newOpts.C,
        option_d_text: newOpts.D,
        approved: false, // require re-approval after edit
      })
      .eq('id', id);

    if (error) {
      console.error('[AdminQuestions] edit save failed:', error.message);
    } else {
      setQuestions((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                content: newContent,
                option_a_text: newOpts.A,
                option_b_text: newOpts.B,
                option_c_text: newOpts.C,
                option_d_text: newOpts.D,
                approved: false,
              }
            : r,
        ),
      );
    }
  }

  // ── Derived counts ─────────────────────────────────────────────────────────

  const unapprovedCount = questions.filter((q) => !q.approved).length;

  // Group questions by standard_id
  const grouped = standards.map((std) => ({
    standard: std,
    questions: questions.filter((q) => q.standard_id === std.id),
  })).filter((g) => g.questions.length > 0);

  // Also show questions whose standard isn't in our pilot list (orphans)
  const knownStandardIds = new Set(standards.map((s) => s.id));
  const orphans = questions.filter((q) => !knownStandardIds.has(q.standard_id));

  // ── Views ──────────────────────────────────────────────────────────────────

  // Render-time auth guard — fires AFTER all hooks, safe for React
  // Blocks the UI while auth is loading so the redirect below never fires on null role
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.ui }}>
        <p style={{ color: C.gray, fontSize: 14 }}>Checking access…</p>
      </div>
    );
  }

  // Don't render anything while the redirect effect is running
  if (!user || role !== 'teacher') return null;

  if (loadState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.ui }}>
        <p style={{ color: C.gray, fontSize: 14 }}>Loading question bank…</p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.ui }}>
        <div style={{ maxWidth: 400, textAlign: 'center', padding: 24 }}>
          <p style={{ color: C.red, fontSize: 15, marginBottom: 12 }}>{errorMsg}</p>
          <button onClick={() => router.push('/dashboard/teacher')} style={{ background: C.navy, color: C.white, border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui }}>
      <GogiNav subtitle="Question Bank — Admin Review" showLogout />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px' }}>

        {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: C.navy,
              margin: 0,
              letterSpacing: -0.5,
            }}
          >
            Question Bank
          </h1>

          {unapprovedCount > 0 && (
            <span
              style={{
                background: C.amberLight,
                color: C.amber,
                border: `1px solid ${C.amber}`,
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {unapprovedCount} UNAPPROVED
            </span>
          )}

          {unapprovedCount === 0 && questions.length > 0 && (
            <span
              style={{
                background: C.greenLight,
                color: C.green,
                border: `1px solid ${C.green}`,
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ALL APPROVED
            </span>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.gray }}>
            {questions.length} total question{questions.length !== 1 ? 's' : ''} across {grouped.length} standard{grouped.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── INFO BANNER ─────────────────────────────────────────────────────── */}
        <div
          style={{
            background: C.blueLight,
            border: `1px solid ${C.blue}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12,
            color: C.blue,
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          Only <strong>approved</strong> questions are served to students in the diagnostic engine.
          Review each question, then click <strong>Approve</strong> to activate it.
          Editing a question removes approval and requires re-approval.
        </div>

        {questions.length === 0 && (
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 32,
              textAlign: 'center',
              color: C.gray,
              fontSize: 14,
            }}
          >
            <p style={{ margin: '0 0 8px' }}>No questions found in the database.</p>
            <p style={{ margin: 0, fontSize: 12 }}>
              Run <code style={{ background: C.light, padding: '1px 5px', borderRadius: 3 }}>
                npx tsx scripts/generateQuestions.ts
              </code> to generate OMC questions from your passages.
            </p>
          </div>
        )}

        {/* ── QUESTIONS GROUPED BY STANDARD ──────────────────────────────────── */}
        {grouped.map(({ standard, questions: stdQs }) => {
          const meta = STANDARDS[standard.code as keyof typeof STANDARDS];
          const unapproved = stdQs.filter((q) => !q.approved).length;

          return (
            <div key={standard.id} style={{ marginBottom: 32 }}>
              {/* Standard header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: `2px solid ${C.navy}`,
                }}
              >
                <span
                  style={{
                    background: C.navy,
                    color: C.white,
                    borderRadius: 5,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                >
                  {standard.code}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                  {meta?.title ?? standard.title}
                </span>
                <span style={{ fontSize: 12, color: C.gray, marginLeft: 'auto' }}>
                  {stdQs.length} question{stdQs.length !== 1 ? 's' : ''}
                  {unapproved > 0 && (
                    <span style={{ color: C.amber, marginLeft: 6 }}>
                      · {unapproved} unapproved
                    </span>
                  )}
                </span>
              </div>

              {stdQs.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  standardCode={standard.code}
                  onApprove={handleApprove}
                  onFlag={handleFlag}
                  onSaveEdit={handleSaveEdit}
                />
              ))}
            </div>
          );
        })}

        {/* ── ORPHANED QUESTIONS (no matching standard) ───────────────────────── */}
        {orphans.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: `2px solid ${C.gray}`,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: C.gray }}>
                Other / Unmatched Standards ({orphans.length})
              </span>
            </div>
            {orphans.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                standardCode={q.standard_id.slice(0, 8) + '…'}
                onApprove={handleApprove}
                onFlag={handleFlag}
                onSaveEdit={handleSaveEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
