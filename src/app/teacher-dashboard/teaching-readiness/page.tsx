'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';

type TeachingPullOut = {
  selection: string;
  exactLinesOrParagraphs: string;
  excerpt: string;
  skillFocus: string;
  whyThisExcerpt: string;
  moveStatementTemplate: string;
  instructionalSupport?: {
    title: string;
    teachFirst: string[];
    cornellNotes: string[];
    studentStrategy: string[];
    prometheanPrompt: string;
    successCriteria: string[];
  };
  qualityGate?: {
    status: 'gold' | 'candidate' | 'revise';
    label: string;
    checks: string[];
  };
  teacherTrust: { confidence: 'strong' | 'emerging' | 'weak'; evidencePoints: string[] };
  anchorQuestion: {
    stem: string;
    choices: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }>;
  };
};

type TeachingReadinessBoard = {
  targetPerSkill: number;
  totalStrong: number;
  targetStrong: number;
  standards: Array<{
    code: string;
    title: string;
    standardText: string;
    stateGuidance: string[];
    studentsNeedToKnow: string[];
    fastReportQuestions: string[];
    assessmentWeight: {
      category: string;
      percentOfTest: string;
      priority: 'highest' | 'high' | 'supporting';
      note: string;
    };
    fastDemand: string;
    itemShape: string;
    strategy: string;
    strongCount: number;
    targetStrong: number;
    argumentLabs?: Array<{
      id: string;
      title: string;
      issueQuestion: string;
      durationMinutes: number;
      sourcePair: string;
      teacherSetup: string;
      studentProduct: string;
      sequence: Array<{
        label: string;
        minutes: number;
        teacherMove: string;
        studentTask: string;
      }>;
      cards: TeachingPullOut[];
    }>;
    availableTexts: Array<{
      title: string;
      author: string | null;
      status: string;
      wordCount: number;
      hasLocalText: boolean;
      textPath: string | null;
    }>;
    skills: Array<{
      strandId: string;
      label: string;
      studentMove: string;
      passageMustHave?: string[];
      fastStemFocus?: string[];
      commonMiss?: string;
      scaffold?: string;
      masterySignal?: string;
      minimumPullOuts: number;
      strongCount: number;
      emergingCount: number;
      status: 'ready' | 'building' | 'needed';
      bestPullOut: TeachingPullOut | null;
      pullOuts: TeachingPullOut[];
    }>;
  }>;
};

function statusColor(status: string) {
  if (status === 'ready') return C.green;
  if (status === 'building') return C.amber;
  return C.red;
}

function statusLabel(status: string) {
  if (status === 'ready') return 'Ready';
  if (status === 'building') return 'Building';
  return 'Needs excerpts';
}

function priorityColor(priority: string) {
  if (priority === 'highest') return C.red;
  if (priority === 'high') return C.blue;
  return C.gray;
}

function priorityMarker(priority: string) {
  if (priority === 'highest') return '★ ';
  return '';
}

function compact(value: string, max = 260) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function pullOutMatchesText(row: TeachingPullOut, title: string) {
  const selectionTitle = row.selection.split(' — ')[0]?.trim().toLowerCase();
  return selectionTitle === title.trim().toLowerCase();
}

function lessonLaunchHref(args: {
  standardCode: string;
  subSkillId: string;
  label: string;
}) {
  const params = new URLSearchParams({
    standard_code: args.standardCode,
    sub_skill_id: args.subSkillId,
    title: args.label,
    period: 'Teacher preview',
  });
  return `/teacher-dashboard/lesson-launch?${params.toString()}`;
}

export default function TeachingReadinessPage() {
  const [board, setBoard] = useState<TeachingReadinessBoard | null>(null);
  const [standardFilter, setStandardFilter] = useState('all');
  const [textFilter, setTextFilter] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [openLab, setOpenLab] = useState<string | null>(null);
  const [fullText, setFullText] = useState<{
    title: string;
    author: string | null;
    wordCount: number;
    sourceKind?: 'official_file' | 'manual_upload' | 'manual_upload_full';
    content: string;
    sections: Array<{
      id: string;
      label: string;
      startLine: number;
      endLine: number;
      wordCount: number;
      preview: string;
      content: string;
    }>;
  } | null>(null);
  const [selectedTextSection, setSelectedTextSection] = useState<string | null>(null);
  const [fullTextLoading, setFullTextLoading] = useState<string | null>(null);
  const [fullTextError, setFullTextError] = useState<string | null>(null);
  const [cardIndexes, setCardIndexes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visibleStandards =
    board?.standards.filter((standard) => standardFilter === 'all' || standard.code === standardFilter) ?? [];
  const selectedStandard = standardFilter === 'all' ? null : visibleStandards[0] ?? null;

  async function loadBoard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/teacher/teaching-readiness?target=5');
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not load teaching readiness.');
      setBoard(json.board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load teaching readiness.');
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
  }, []);

  useEffect(() => {
    const standard = new URLSearchParams(window.location.search).get('standard');
    if (standard) setStandardFilter(standard);
  }, []);

  useEffect(() => {
    setTextFilter(null);
    setOpenCard(null);
    setOpenLab(null);
    setFullText(null);
    setFullTextError(null);
    setCardIndexes({});
  }, [standardFilter]);

  async function openFullText(title: string) {
    setFullTextLoading(title);
    setFullTextError(null);
    try {
      const res = await fetch(`/api/reading-wins/official-text-library/text?title=${encodeURIComponent(title)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not open full text.');
      setFullText(json.text);
      setSelectedTextSection(json.text.sections?.[0]?.id ?? null);
    } catch (err) {
      setFullTextError(err instanceof Error ? err.message : 'Could not open full text.');
    } finally {
      setFullTextLoading(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.dark, fontFamily: FONTS.ui }}>
      <TeacherDashboardTopBar active="readiness" />
      <main style={{ maxWidth: 1260, margin: '0 auto', padding: '28px 20px 56px' }}>
        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: C.gray, fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
                PRECISION EXPLICIT INSTRUCTION
              </div>
              <h1 style={{ color: C.dark, fontSize: 34, lineHeight: 1.08, margin: '8px 0' }}>
                Teaching Readiness Board
              </h1>
              <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.55, margin: 0, maxWidth: 820 }}>
                See every ELA 9 standard broken into teachable skill moves. Each row answers:
                what can I teach, with which excerpt, and is it strong enough to project tomorrow?
              </p>
            </div>
            <div style={{ alignSelf: 'start', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={loadBoard}
                style={{
                  alignItems: 'center',
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.dark,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  minHeight: 40,
                  padding: '0 13px',
                }}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
              <a
                href="/api/teacher/teaching-readiness/audit?format=markdown&target=5"
                target="_blank"
                rel="noreferrer"
                style={{
                  alignItems: 'center',
                  background: C.blue,
                  border: `1px solid ${C.blue}`,
                  borderRadius: 6,
                  color: C.white,
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  minHeight: 40,
                  padding: '0 13px',
                  textDecoration: 'none',
                }}
              >
                Run full audit
              </a>
              <a
                href="/teacher-dashboard/official-teachable-corpus"
                style={{
                  alignItems: 'center',
                  background: C.white,
                  border: `1px solid ${C.blue}`,
                  borderRadius: 6,
                  color: C.blue,
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  minHeight: 40,
                  padding: '0 13px',
                  textDecoration: 'none',
                }}
              >
                Official corpus
              </a>
              <a
                href="/teacher-dashboard/workbook-builder"
                style={{
                  alignItems: 'center',
                  background: C.green,
                  border: `1px solid ${C.green}`,
                  borderRadius: 6,
                  color: C.white,
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  minHeight: 40,
                  padding: '0 13px',
                  textDecoration: 'none',
                }}
              >
                Workbook builder
              </a>
            </div>
          </div>

          {board ? (
            <>
              <div
                style={{
                  background: C.light,
                  borderRadius: 8,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 10,
                  marginTop: 16,
                  padding: 12,
                }}
              >
                <div>
                  <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Strong pull-outs</div>
                  <div style={{ color: C.dark, fontSize: 28, fontWeight: 900 }}>
                    {board.totalStrong}/{board.targetStrong}
                  </div>
                </div>
                <div>
                  <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Target per skill</div>
                  <div style={{ color: C.dark, fontSize: 28, fontWeight: 900 }}>
                    {board.targetPerSkill}
                  </div>
                </div>
                <div>
                  <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Teacher use</div>
                  <div style={{ color: C.dark, fontSize: 18, fontWeight: 900, marginTop: 5 }}>
                    Standard → skill → excerpt
                  </div>
                </div>
              </div>

              <label style={{ display: 'grid', gap: 6, marginTop: 14, maxWidth: 420 }}>
                <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Filter by standard</span>
                <select
                  value={standardFilter}
                  onChange={(event) => setStandardFilter(event.target.value)}
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.dark,
                    fontSize: 14,
                    minHeight: 42,
                    padding: '0 10px',
                  }}
                >
                  <option value="all">All standards</option>
                  {board.standards.map((standard) => (
                    <option key={standard.code} value={standard.code}>
                      {priorityMarker(standard.assessmentWeight.priority)}
                      {standard.code} - {standard.title}
                    </option>
                  ))}
                </select>
              </label>

              {selectedStandard ? (
                <section
                  style={{
                    background: '#FBFCFF',
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    display: 'grid',
                    gap: 14,
                    marginTop: 14,
                    padding: 14,
                  }}
                >
                  <div>
                    <div style={{ color: C.blue, fontSize: 12, fontWeight: 900 }}>
                      STANDARD WORKSPACE
                    </div>
                    <h2 style={{ color: C.dark, fontSize: 22, margin: '4px 0' }}>
                      {selectedStandard.code}: {selectedStandard.title}
                    </h2>
                    <p style={{ color: C.dark, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                      {selectedStandard.standardText}
                    </p>
                    <div
                      style={{
                        alignItems: 'center',
                        background: '#FFF8E1',
                        border: `1px solid ${priorityColor(selectedStandard.assessmentWeight.priority)}`,
                        borderRadius: 8,
                        color: C.dark,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginTop: 10,
                        padding: '8px 10px',
                      }}
                    >
                      <span
                        style={{
                          color: priorityColor(selectedStandard.assessmentWeight.priority),
                          fontSize: 12,
                          fontWeight: 950,
                          textTransform: 'uppercase',
                        }}
                      >
                        FAST weight: {selectedStandard.assessmentWeight.percentOfTest}
                      </span>
                      <span style={{ color: C.dark, fontSize: 12, fontWeight: 900 }}>
                        {selectedStandard.assessmentWeight.category}
                      </span>
                      <span style={{ color: C.gray, fontSize: 12 }}>
                        {selectedStandard.assessmentWeight.note}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gap: 10,
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    }}
                  >
                    <div>
                      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Assessment demand</div>
                      <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, margin: '4px 0 0' }}>
                        {selectedStandard.fastDemand}
                      </p>
                    </div>
                    <div>
                      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Core strategy</div>
                      <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, margin: '4px 0 0' }}>
                        {selectedStandard.strategy}
                      </p>
                    </div>
                    <div>
                      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Question shape</div>
                      <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, margin: '4px 0 0' }}>
                        {selectedStandard.itemShape}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gap: 10,
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    }}
                  >
                    <div
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                        Students need to know
                      </div>
                      <ul
                        style={{
                          color: C.dark,
                          display: 'grid',
                          gap: 6,
                          fontSize: 12,
                          lineHeight: 1.4,
                          margin: '8px 0 0',
                          paddingLeft: 18,
                        }}
                      >
                        {selectedStandard.studentsNeedToKnow.map((need) => (
                          <li key={need}>{need}</li>
                        ))}
                      </ul>
                    </div>
                    <div
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                        State / FAST guidance
                      </div>
                      <ul
                        style={{
                          color: C.dark,
                          display: 'grid',
                          gap: 6,
                          fontSize: 12,
                          lineHeight: 1.4,
                          margin: '8px 0 0',
                          paddingLeft: 18,
                        }}
                      >
                        {selectedStandard.stateGuidance.slice(0, 4).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                        {selectedStandard.fastReportQuestions.slice(0, 2).map((question) => (
                          <li key={question}>FAST report next step: {question}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                      Official texts GOGI has for this standard
                    </div>
                    {selectedStandard.availableTexts.length ? (
                      <>
                        <p style={{ color: C.gray, fontSize: 12, lineHeight: 1.4, margin: '4px 0 0' }}>
                          Click a text to filter the teaching excerpts below.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {textFilter ? (
                            <button
                              type="button"
                              onClick={() => {
                                setTextFilter(null);
                                setOpenCard(null);
                                setCardIndexes({});
                              }}
                              style={{
                                background: C.dark,
                                border: `1px solid ${C.dark}`,
                                borderRadius: 999,
                                color: C.white,
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 900,
                                padding: '6px 10px',
                              }}
                            >
                              Show all texts
                            </button>
                          ) : null}
                          {selectedStandard.availableTexts.map((text) => {
                            const excerptCount = selectedStandard.skills.reduce(
                              (sum, skill) =>
                                sum + skill.pullOuts.filter((row) => pullOutMatchesText(row, text.title)).length,
                              0
                            );
                            const isActive = textFilter === text.title;
                            return (
                              <span
                                key={`${text.title}-${text.author ?? ''}`}
                                style={{
                                  alignItems: 'center',
                                  background: isActive ? C.green : text.hasLocalText ? '#ECFDF3' : '#F8FAFC',
                                  border: `1px solid ${isActive ? C.green : text.hasLocalText ? C.green : C.border}`,
                                  borderRadius: 999,
                                  color: isActive ? C.white : text.hasLocalText ? C.green : C.gray,
                                  display: 'inline-flex',
                                  gap: 6,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: '4px 5px 4px 9px',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTextFilter(isActive ? null : text.title);
                                    setOpenCard(null);
                                    setCardIndexes({});
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'inherit',
                                    cursor: 'pointer',
                                    font: 'inherit',
                                    padding: 0,
                                  }}
                                >
                                  {text.title}
                                  {text.author ? ` — ${text.author}` : ''}
                                  {excerptCount ? ` · ${excerptCount}` : ''}
                                </button>
                                {text.hasLocalText ? (
                                  <button
                                    type="button"
                                    onClick={() => openFullText(text.title)}
                                    disabled={fullTextLoading === text.title}
                                    style={{
                                      background: isActive ? C.white : C.dark,
                                      border: 'none',
                                      borderRadius: 999,
                                      color: isActive ? C.green : C.white,
                                      cursor: fullTextLoading === text.title ? 'wait' : 'pointer',
                                      fontSize: 10,
                                      fontWeight: 950,
                                      padding: '4px 7px',
                                    }}
                                  >
                                    {fullTextLoading === text.title ? 'Opening' : 'Open text'}
                                  </button>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                        {fullTextError ? (
                          <div style={{ color: C.red, fontSize: 12, fontWeight: 900, marginTop: 8 }}>
                            {fullTextError}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div
                        style={{
                          background: '#F8FAFC',
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          color: C.gray,
                          fontSize: 13,
                          lineHeight: 1.45,
                          marginTop: 8,
                          padding: 12,
                        }}
                      >
                        No official Florida text map is attached to this standard yet. Use the skill rows below for
                        vocabulary practice, or attach this standard to passages during content curation.
                      </div>
                    )}
                  </div>
                  {selectedStandard.argumentLabs?.length ? (
                    <div
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        display: 'grid',
                        gap: 10,
                        padding: 12,
                      }}
                    >
                      <div>
                        <div style={{ color: C.blue, fontSize: 11, fontWeight: 1000 }}>
                          ARGUMENT LABS
                        </div>
                        <h3 style={{ color: C.dark, fontSize: 17, margin: '3px 0' }}>
                          Full R.2.4 DBQ-style lessons
                        </h3>
                        <p style={{ color: C.gray, fontSize: 12, lineHeight: 1.45, margin: 0 }}>
                          Longer paired-argument lessons built from the same gold cards. Use these when
                          students need a full claim/evidence chart and written evaluation, not just a quick rep.
                        </p>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedStandard.argumentLabs.map((lab) => {
                          const isOpen = openLab === lab.id;
                          return (
                            <div
                              key={lab.id}
                              style={{
                                background: '#FBFCFF',
                                border: `1px solid ${isOpen ? C.blue : C.border}`,
                                borderRadius: 8,
                                display: 'grid',
                                gap: 8,
                                padding: 10,
                              }}
                            >
                              <div
                                style={{
                                  alignItems: 'start',
                                  display: 'flex',
                                  gap: 10,
                                  justifyContent: 'space-between',
                                }}
                              >
                                <div>
                                  <div style={{ color: C.dark, fontSize: 14, fontWeight: 950 }}>
                                    {lab.title}
                                  </div>
                                  <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.4, marginTop: 3 }}>
                                    {lab.durationMinutes} min · {lab.sourcePair}
                                  </div>
                                  <div style={{ color: C.blue, fontSize: 13, fontWeight: 900, marginTop: 6 }}>
                                    {lab.issueQuestion}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOpenLab(isOpen ? null : lab.id)}
                                  style={{
                                    background: isOpen ? C.dark : C.blue,
                                    border: 'none',
                                    borderRadius: 6,
                                    color: C.white,
                                    cursor: 'pointer',
                                    flex: '0 0 auto',
                                    fontSize: 12,
                                    fontWeight: 900,
                                    padding: '8px 10px',
                                  }}
                                >
                                  {isOpen ? 'Collapse lab' : 'Open lab'}
                                </button>
                              </div>
                              {isOpen ? (
                                <div
                                  style={{
                                    borderTop: `1px solid ${C.border}`,
                                    display: 'grid',
                                    gap: 12,
                                    paddingTop: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'grid',
                                      gap: 10,
                                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                                    }}
                                  >
                                    <div>
                                      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                                        Teacher setup
                                      </div>
                                      <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, margin: '4px 0 0' }}>
                                        {lab.teacherSetup}
                                      </p>
                                    </div>
                                    <div>
                                      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                                        Student product
                                      </div>
                                      <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, margin: '4px 0 0' }}>
                                        {lab.studentProduct}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                                      Lesson flow
                                    </div>
                                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                                      {lab.sequence.map((step) => (
                                        <div
                                          key={`${lab.id}-${step.label}`}
                                          style={{
                                            background: C.white,
                                            border: `1px solid ${C.border}`,
                                            borderRadius: 6,
                                            display: 'grid',
                                            gap: 4,
                                            padding: 9,
                                          }}
                                        >
                                          <div style={{ color: C.dark, fontSize: 12, fontWeight: 950 }}>
                                            {step.label} · {step.minutes} min
                                          </div>
                                          <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.4 }}>
                                            Teacher: {step.teacherMove}
                                          </div>
                                          <div style={{ color: C.dark, fontSize: 12, lineHeight: 1.4 }}>
                                            Student: {step.studentTask}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                                      Gold cards inside this lab
                                    </div>
                                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                                      {lab.cards.map((card, cardIndex) => (
                                        <div
                                          key={`${lab.id}-${card.skillFocus}-${cardIndex}`}
                                          style={{
                                            background: C.white,
                                            border: `1px solid ${C.border}`,
                                            borderRadius: 6,
                                            padding: 9,
                                          }}
                                        >
                                          <div style={{ color: C.blue, fontSize: 12, fontWeight: 950 }}>
                                            {card.skillFocus}
                                          </div>
                                          <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, margin: '4px 0' }}>
                                            {card.anchorQuestion.stem}
                                          </p>
                                          <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.4 }}>
                                            {card.selection} · {card.exactLinesOrParagraphs}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
        </section>

        {loading ? (
          <div style={{ alignItems: 'center', color: C.gray, display: 'flex', gap: 10, padding: 24 }}>
            <Loader2 size={18} className="animate-spin" />
            Checking standards and sub-skills...
          </div>
        ) : error ? (
          <div style={{ color: C.red, fontWeight: 900, padding: 24 }}>{error}</div>
        ) : board ? (
          <section style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            {visibleStandards.map((standard) => {
              const activeTextFilter = selectedStandard?.code === standard.code ? textFilter : null;
              const visibleSkillsForStandard = activeTextFilter
                ? standard.skills.filter((skill) =>
                    skill.pullOuts.some((row) => pullOutMatchesText(row, activeTextFilter))
                  )
                : standard.skills;

              return (
                <article
                key={standard.code}
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    display: 'flex',
                    gap: 12,
                    justifyContent: 'space-between',
                    padding: 14,
                  }}
                >
                  <div>
                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>{standard.code}</div>
                    <h2 style={{ color: C.dark, fontSize: 22, margin: '3px 0 0' }}>
                      {standard.title}
                    </h2>
                  </div>
                  <div style={{ color: C.blue, fontSize: 13, fontWeight: 900 }}>
                    {standard.strongCount}/{standard.targetStrong} strong
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10, padding: 14 }}>
                  {activeTextFilter ? (
                    <div
                      style={{
                        background: '#FBFCFF',
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        color: C.dark,
                        fontSize: 13,
                        fontWeight: 900,
                        padding: 10,
                      }}
                    >
                      Showing usable teaching excerpts from {activeTextFilter}.
                    </div>
                  ) : null}

                  {visibleSkillsForStandard.length === 0 ? (
                    <div style={{ color: C.gray, fontSize: 13, padding: 10 }}>
                      GOGI does not have a teacher-ready excerpt from {activeTextFilter} for this standard yet.
                    </div>
                  ) : null}

                  {visibleSkillsForStandard.map((skill) => {
                    const skillKey = `${standard.code}-${skill.strandId}`;
                    const availablePullOuts = activeTextFilter
                      ? skill.pullOuts.filter((row) => pullOutMatchesText(row, activeTextFilter))
                      : skill.pullOuts;
                    const selectedCardIndex = Math.min(
                      cardIndexes[skillKey] ?? 0,
                      Math.max(0, availablePullOuts.length - 1)
                    );
                    const pullOutsToShow = availablePullOuts[selectedCardIndex]
                      ? [availablePullOuts[selectedCardIndex]]
                      : [];

                    return (
                    <div key={skillKey}>
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
                        <div>
                          <div
                            style={{
                              color: statusColor(skill.status),
                              fontSize: 11,
                              fontWeight: 900,
                              textTransform: 'uppercase',
                            }}
                          >
                            {statusLabel(skill.status)} · {skill.strongCount}/{skill.minimumPullOuts}
                            {skill.emergingCount ? ` · ${skill.emergingCount} skim` : ''}
                          </div>
                          <h3 style={{ color: C.dark, fontSize: 17, margin: '3px 0' }}>
                            Teach {standard.code}: {skill.label}
                          </h3>
                          <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.45, margin: 0 }}>
                            {skill.studentMove}
                          </p>
                        </div>
                        <div style={{ alignSelf: 'start', display: 'grid', gap: 8, justifyItems: 'end' }}>
                          <div
                            style={{
                              background:
                                skill.status === 'ready'
                                  ? '#ECFDF3'
                                  : skill.status === 'building'
                                    ? '#FFF8E1'
                                    : '#FEF3F2',
                              border: `1px solid ${statusColor(skill.status)}`,
                              borderRadius: 6,
                              color: statusColor(skill.status),
                              fontSize: 12,
                              fontWeight: 900,
                              padding: '9px 12px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {skill.status === 'ready'
                              ? 'Ready to teach'
                              : skill.status === 'building'
                                ? `Need ${Math.max(0, skill.minimumPullOuts - skill.strongCount)} more`
                                : 'Build needed'}
                          </div>
                          {skill.strongCount >= 3 ? (
                            <a
                              href={lessonLaunchHref({
                                standardCode: standard.code,
                                subSkillId: skill.strandId,
                                label: skill.label,
                              })}
                              style={{
                                background: C.blue,
                                border: `1px solid ${C.blue}`,
                                borderRadius: 6,
                                color: C.white,
                                fontSize: 12,
                                fontWeight: 900,
                                padding: '9px 12px',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Build 90-min lesson
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {availablePullOuts.length > 1 ? (
                        <div
                          style={{
                            alignItems: 'center',
                            display: 'flex',
                            gap: 8,
                            marginTop: 8,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setCardIndexes((current) => ({
                                ...current,
                                [skillKey]:
                                  (selectedCardIndex - 1 + availablePullOuts.length) % availablePullOuts.length,
                              }));
                              setOpenCard(null);
                            }}
                            style={{
                              background: C.white,
                              border: `1px solid ${C.border}`,
                              borderRadius: 6,
                              color: C.blue,
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 900,
                              padding: '8px 10px',
                            }}
                          >
                            Previous
                          </button>
                          <div style={{ color: C.dark, fontSize: 12, fontWeight: 900 }}>
                            Card {selectedCardIndex + 1} of {availablePullOuts.length}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCardIndexes((current) => ({
                                ...current,
                                [skillKey]: (selectedCardIndex + 1) % availablePullOuts.length,
                              }));
                              setOpenCard(null);
                            }}
                            style={{
                              background: C.blue,
                              border: `1px solid ${C.blue}`,
                              borderRadius: 6,
                              color: C.white,
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 900,
                              padding: '8px 10px',
                            }}
                          >
                            Next card
                          </button>
                        </div>
                      ) : null}

                      {pullOutsToShow.length ? (
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                          {pullOutsToShow.map((pullOut, index) => {
                          const cardKey = `${standard.code}-${skill.strandId}-${activeTextFilter ?? 'best'}-${index}`;
                          const isOpen = openCard === cardKey;
                          return (
                            <div
                              key={cardKey}
                              style={{
                                background: '#FBFCFF',
                                border: `1px solid ${C.border}`,
                                borderRadius: 6,
                                display: 'grid',
                                gap: 8,
                                padding: 10,
                                textAlign: 'left',
                                userSelect: 'text',
                              }}
                            >
                              <div
                                style={{
                                  alignItems: 'center',
                                  display: 'flex',
                                  gap: 10,
                                  justifyContent: 'space-between',
                                }}
                              >
                                <div style={{ color: C.blue, fontSize: 12, fontWeight: 900 }}>
                                  With this passage: {pullOut.selection} ·{' '}
                                  {pullOut.exactLinesOrParagraphs}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOpenCard(isOpen ? null : cardKey)}
                                  style={{
                                    background: isOpen ? C.dark : C.blue,
                                    border: 'none',
                                    borderRadius: 6,
                                    color: C.white,
                                    cursor: 'pointer',
                                    flex: '0 0 auto',
                                    fontSize: 12,
                                    fontWeight: 900,
                                    padding: '7px 9px',
                                  }}
                                >
                                  {isOpen ? 'Collapse' : 'Open card'}
                                </button>
                              </div>
                              <p
                                style={{
                                  color: C.dark,
                                  fontFamily: FONTS.passage,
                                  fontSize: 13,
                                  lineHeight: 1.55,
                                  margin: 0,
                                  whiteSpace: isOpen ? 'pre-wrap' : 'normal',
                                }}
                              >
                                {isOpen ? pullOut.excerpt : compact(pullOut.excerpt)}
                              </p>
                              <div style={{ color: C.dark, fontSize: 13, fontWeight: 900 }}>
                                {pullOut.anchorQuestion.stem}
                              </div>
                              {isOpen ? (
                                <div
                                  style={{
                                    borderTop: `1px solid ${C.border}`,
                                    display: 'grid',
                                    gap: 12,
                                    marginTop: 4,
                                    paddingTop: 12,
                                  }}
                                >
                                  {pullOut.qualityGate ? (
                                    <div
                                      style={{
                                        background:
                                          pullOut.qualityGate.status === 'gold'
                                            ? '#ECFDF3'
                                            : pullOut.qualityGate.status === 'candidate'
                                              ? '#FFF8E6'
                                              : '#FEF3F2',
                                        border: `1px solid ${
                                          pullOut.qualityGate.status === 'gold'
                                            ? C.green
                                            : pullOut.qualityGate.status === 'candidate'
                                              ? C.amber
                                              : C.red
                                        }`,
                                        borderRadius: 8,
                                        padding: 10,
                                      }}
                                    >
                                      <div
                                        style={{
                                          color:
                                            pullOut.qualityGate.status === 'gold'
                                              ? C.green
                                              : pullOut.qualityGate.status === 'candidate'
                                                ? C.amber
                                                : C.red,
                                          fontSize: 11,
                                          fontWeight: 1000,
                                          textTransform: 'uppercase',
                                        }}
                                      >
                                        {pullOut.qualityGate.label}
                                      </div>
                                      <div
                                        style={{
                                          color: C.dark,
                                          display: 'flex',
                                          flexWrap: 'wrap',
                                          gap: 6,
                                          marginTop: 8,
                                        }}
                                      >
                                        {pullOut.qualityGate.checks.map((check) => (
                                          <span
                                            key={check}
                                            style={{
                                              background: C.white,
                                              border: `1px solid ${C.border}`,
                                              borderRadius: 999,
                                              fontSize: 11,
                                              fontWeight: 800,
                                              padding: '4px 8px',
                                            }}
                                          >
                                            {check}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  <div>
                                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                                      Why this works
                                    </div>
                                    <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, margin: '4px 0 0' }}>
                                      {pullOut.whyThisExcerpt}
                                    </p>
                                  </div>
                                  <div>
                                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                                      Skill strategy
                                    </div>
                                    <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, margin: '4px 0 0' }}>
                                      {pullOut.moveStatementTemplate}
                                    </p>
                                  </div>
                                  <div>
                                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                                      Evidence points
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                      {pullOut.teacherTrust.evidencePoints.map((point, evidenceIndex) => (
                                        <span
                                          key={`${point}-${evidenceIndex}`}
                                          style={{
                                            background: '#EEF4FF',
                                            border: `1px solid ${C.blueMid}`,
                                            borderRadius: 999,
                                            color: C.navy,
                                            fontSize: 11,
                                            fontWeight: 800,
                                            padding: '4px 8px',
                                          }}
                                        >
                                          {point}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                                      FAST-style check
                                    </div>
                                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                                      {pullOut.anchorQuestion.choices.map((choice) => (
                                        <div
                                          key={choice.label}
                                          style={{
                                            color: choice.correct ? C.green : C.dark,
                                            fontSize: 13,
                                            fontWeight: choice.correct ? 900 : 600,
                                            lineHeight: 1.35,
                                          }}
                                        >
                                          {choice.label}. {choice.text}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        </div>
                      ) : (
                        <div style={{ color: C.gray, fontSize: 13 }}>
                          No classroom-ready excerpt found yet for this skill move.
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </article>
              );
            })}
          </section>
        ) : null}
      </main>
      {fullText ? (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.55)',
            bottom: 0,
            display: 'grid',
            left: 0,
            padding: 24,
            placeItems: 'center',
            position: 'fixed',
            right: 0,
            top: 0,
            zIndex: 50,
          }}
        >
          <section
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.24)',
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              maxHeight: '86vh',
              maxWidth: 960,
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <div
              style={{
                alignItems: 'start',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                gap: 14,
                justifyContent: 'space-between',
                padding: 14,
              }}
            >
              <div>
                <div style={{ color: C.blue, fontSize: 11, fontWeight: 1000 }}>
                  FULL SOURCE TEXT
                </div>
                <h2 style={{ color: C.dark, fontSize: 20, margin: '4px 0' }}>
                  {fullText.title}
                  {fullText.author ? ` — ${fullText.author}` : ''}
                </h2>
                <div style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>
                  {fullText.wordCount.toLocaleString()} words
                  {fullText.sourceKind === 'manual_upload_full' ? ' · manual full text' : ''}
                  {fullText.sourceKind === 'manual_upload' ? ' · manual upload excerpts' : ''}
                </div>
              </div>
              <button
                type="button"
              onClick={() => {
                setFullText(null);
                setSelectedTextSection(null);
              }}
                style={{
                  background: C.dark,
                  border: 'none',
                  borderRadius: 6,
                  color: C.white,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '8px 10px',
                }}
              >
                Close
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '280px minmax(0, 1fr)',
                minHeight: 0,
                overflow: 'auto',
              }}
            >
              <aside
                style={{
                  borderRight: `1px solid ${C.border}`,
                  display: 'grid',
                  gap: 8,
                  minHeight: 0,
                  overflow: 'auto',
                  padding: 12,
                }}
              >
                <div style={{ color: C.gray, fontSize: 11, fontWeight: 1000 }}>
                  TEXT MAP
                </div>
                {fullText.sections.map((section) => {
                  const isSelected = selectedTextSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setSelectedTextSection(section.id)}
                      style={{
                        background: isSelected ? '#EEF4FF' : C.white,
                        border: `1px solid ${isSelected ? C.blue : C.border}`,
                        borderRadius: 7,
                        color: C.dark,
                        cursor: 'pointer',
                        display: 'grid',
                        gap: 4,
                        padding: 9,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ color: isSelected ? C.blue : C.dark, fontSize: 12, fontWeight: 950 }}>
                        {section.label}
                      </span>
                      <span style={{ color: C.gray, fontSize: 11, lineHeight: 1.35 }}>
                        {section.wordCount.toLocaleString()} words · lines {section.startLine}-{section.endLine}
                      </span>
                      <span style={{ color: C.gray, fontSize: 11, lineHeight: 1.35 }}>
                        {section.preview}
                      </span>
                    </button>
                  );
                })}
              </aside>
              <section
                style={{
                  display: 'grid',
                  gridTemplateRows: 'auto minmax(0, 1fr)',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {(() => {
                  const section =
                    fullText.sections.find((item) => item.id === selectedTextSection) ??
                    fullText.sections[0] ?? {
                      label: 'Full text',
                      startLine: 1,
                      endLine: 1,
                      wordCount: fullText.wordCount,
                      content: fullText.content,
                    };
                  return (
                    <>
                      <div
                        style={{
                          background: '#FBFCFF',
                          borderBottom: `1px solid ${C.border}`,
                          padding: 12,
                        }}
                      >
                        <div style={{ color: C.blue, fontSize: 13, fontWeight: 950 }}>
                          {section.label}
                        </div>
                        <div style={{ color: C.gray, fontSize: 12, fontWeight: 800, marginTop: 3 }}>
                          {section.wordCount.toLocaleString()} words · lines {section.startLine}-{section.endLine}
                        </div>
                      </div>
                      <pre
                        style={{
                          color: C.dark,
                          fontFamily: FONTS.passage,
                          fontSize: 13,
                          lineHeight: 1.65,
                          margin: 0,
                          overflow: 'auto',
                          padding: 16,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {section.content}
                      </pre>
                    </>
                  );
                })()}
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
