'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, ClipboardList, Download, FileText, Loader2, NotebookPen, Sparkles } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { FAST_GRADE9_READING_DEMANDS } from '@/lib/reading-wins/fastSkillMap';
import {
  OFFICIAL_FAST_TEXT_MODELS,
  type OfficialFastTextModel,
} from '@/lib/reading-wins/officialFastSources';

type LessonSection = {
  title: string;
  teacher_move: string;
  student_notes: string;
};

type LiteraryLesson = {
  title: string;
  standard_code: string;
  standard_text: string;
  anchor_text: string;
  objective: string;
  plain_english_standard: string;
  skill_overview: string;
  how_to_identify: string[];
  how_to_solve: string[];
  vocabulary: Array<{ term: string; meaning: string; example: string }>;
  cornell_sequence: LessonSection[];
  worked_example: {
    element: string;
    evidence: string;
    effect: string;
  };
  guided_practice: string[];
  independent_practice: string[];
  cue_questions: string[];
  summary_frame: string;
  exit_ticket: string;
  teacher_key: string[];
  ppt_sequence?: Array<{
    slide: number;
    title: string;
    minutes: number;
    teacher_action: string;
    student_task: string;
  }>;
  trust_chain?: string[];
  source: 'claude' | 'template';
};

type PassageRow = {
  id: string;
  source_title: string | null;
  source_author: string | null;
  paragraph_text: string;
  standard_code: string | null;
  coverage_strand_label: string | null;
  approval_status: string | null;
  target_signal: string | null;
  word_count: number | null;
  promoted_question_count?: number;
};

type LessonPacket = {
  id: string;
  file: string;
  status: 'ready' | 'needs_cleanup';
  title: string;
  author: string;
  chapter_or_section: string;
  standards_supported: string[];
  text_clean: string;
  word_count: number;
  vocab: Array<{
    word: string;
    pos: string;
    student_friendly_def: string;
    example_sentence_from_text: string;
  }>;
  worked_examples: Array<{
    standardCode: string;
    element_named: string;
    evidence_quoted: string;
    evidence_location: string;
    layer_identified: string;
    effect_explanation: string;
  }>;
  errors: string[];
  warnings: string[];
};

function textKey(model: OfficialFastTextModel) {
  return `${model.title}::${model.author ?? ''}`;
}

function compact(value: string | null | undefined, max = 220) {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function normalizeTextIdentity(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function passageMatchesOfficialText(passage: PassageRow, model: OfficialFastTextModel) {
  const passageTitle = normalizeTextIdentity(passage.source_title);
  const modelTitle = normalizeTextIdentity(model.title);
  const passageAuthor = normalizeTextIdentity(passage.source_author);
  const modelAuthor = normalizeTextIdentity(model.author);

  const titleMatch = passageTitle === modelTitle;
  const authorMatch =
    !modelAuthor ||
    !passageAuthor ||
    passageAuthor.includes(modelAuthor.split(' ')[0]) ||
    passageAuthor.includes(modelAuthor.split(' ').at(-1) ?? modelAuthor);

  return titleMatch && authorMatch;
}

const standardLabels: Record<string, string> = {
  ...FAST_GRADE9_READING_DEMANDS.reduce<Record<string, string>>((map, demand) => {
    map[demand.standardCode] = demand.teacherTitle;
    return map;
  }, {}),
  'ELA.9.R.1.4': 'Characters, structures, and themes of epic poetry',
  'ELA.9.R.3.2': 'Paraphrase grade-level text',
};

function dedupeOfficialTexts() {
  const map = new Map<string, OfficialFastTextModel>();

  for (const model of OFFICIAL_FAST_TEXT_MODELS) {
    const key = textKey(model);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...model, standards: [...model.standards] });
      continue;
    }

    map.set(key, {
      ...existing,
      standards: [...new Set([...existing.standards, ...model.standards])],
      gutenbergIds: [...new Set([...(existing.gutenbergIds ?? []), ...(model.gutenbergIds ?? [])])],
      gutendexSearchTerms: [
        ...new Set([...(existing.gutendexSearchTerms ?? []), ...(model.gutendexSearchTerms ?? [])]),
      ],
      itemNumbers: [...new Set([...(existing.itemNumbers ?? []), ...(model.itemNumbers ?? [])])],
      pipelineUse:
        existing.pipelineUse === 'priority_seed' || model.pipelineUse === 'priority_seed'
          ? 'priority_seed'
          : existing.pipelineUse,
      access:
        existing.access === 'public_domain' || model.access === 'public_domain'
          ? 'public_domain'
          : existing.access,
    });
  }

  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function lessonAsText(lesson: LiteraryLesson) {
  const lines = [
    lesson.title,
    '',
    `Standard: ${lesson.standard_code}`,
    `B.E.S.T. wording: ${lesson.standard_text}`,
    `Anchor text: ${lesson.anchor_text}`,
    `Objective: ${lesson.objective}`,
    '',
    'Plain English Standard',
    lesson.plain_english_standard,
    '',
    'Skill Overview',
    lesson.skill_overview,
    '',
    'How To Identify',
    ...lesson.how_to_identify.map((item) => `- ${item}`),
    '',
    'How To Solve',
    ...lesson.how_to_solve.map((item) => `- ${item}`),
    '',
    'Vocabulary Anchor',
    ...lesson.vocabulary.map((item) => `- ${item.term}: ${item.meaning} Example: ${item.example}`),
    '',
    'Cornell Sequence',
    ...lesson.cornell_sequence.flatMap((section) => [
      `- ${section.title}`,
      `  Teacher: ${section.teacher_move}`,
      `  Student notes: ${section.student_notes}`,
    ]),
    '',
    'Worked Example',
    `Element: ${lesson.worked_example.element}`,
    `Evidence: ${lesson.worked_example.evidence}`,
    `Effect: ${lesson.worked_example.effect}`,
    '',
    'Guided Practice',
    ...lesson.guided_practice.map((item) => `- ${item}`),
    '',
    'Independent Practice',
    ...lesson.independent_practice.map((item) => `- ${item}`),
    '',
    'Cue Questions',
    ...lesson.cue_questions.map((item) => `- ${item}`),
    '',
    'Summary Frame',
    lesson.summary_frame,
    '',
    'Exit Ticket',
    lesson.exit_ticket,
    '',
    'Teacher Key',
    ...lesson.teacher_key.map((item) => `- ${item}`),
  ];

  return lines.join('\n');
}

export default function LiteraryIntelligencePage() {
  const officialTexts = useMemo(() => dedupeOfficialTexts(), []);
  const allStandards = useMemo(
    () =>
      [
        ...new Set(
          officialTexts
            .flatMap((model) => model.standards)
            .map((standard) => String(standard))
        ),
      ].sort(),
    [officialTexts]
  );
  const [standardCode, setStandardCode] = useState<string>('ELA.9.R.1.1');
  const textsForStandard = useMemo(
    () => officialTexts.filter((model) => model.standards.some((standard) => standard === standardCode)),
    [officialTexts, standardCode]
  );
  const [selectedTextKey, setSelectedTextKey] = useState(() => textKey(officialTexts[0]));
  const selectedText = officialTexts.find((model) => textKey(model) === selectedTextKey) ?? officialTexts[0];
  const [studentLevel, setStudentLevel] = useState<'support' | 'grade_level' | 'stretch'>('grade_level');
  const [lessonFocus, setLessonFocus] = useState('');
  const [standardPassages, setStandardPassages] = useState<PassageRow[]>([]);
  const [passages, setPassages] = useState<PassageRow[]>([]);
  const [selectedPassageId, setSelectedPassageId] = useState<string>('');
  const [lessonPackets, setLessonPackets] = useState<LessonPacket[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState<string>('');
  const selectedPassage = passages.find((row) => row.id === selectedPassageId) ?? passages[0] ?? null;
  const selectedPacket =
    lessonPackets.find((packet) => packet.id === selectedPacketId) ?? lessonPackets[0] ?? null;
  const [loadingPassages, setLoadingPassages] = useState(false);
  const [loadingPackets, setLoadingPackets] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [lesson, setLesson] = useState<LiteraryLesson | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textExcerptCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const model of textsForStandard) {
      map.set(
        textKey(model),
        standardPassages.filter((passage) => passageMatchesOfficialText(passage, model)).length
      );
    }
    return map;
  }, [standardPassages, textsForStandard]);

  const recommendedText =
    [...textsForStandard].sort((a, b) => {
      const countDelta = (textExcerptCounts.get(textKey(b)) ?? 0) - (textExcerptCounts.get(textKey(a)) ?? 0);
      if (countDelta !== 0) return countDelta;
      if (a.pipelineUse !== b.pipelineUse) return a.pipelineUse === 'priority_seed' ? -1 : 1;
      if (a.access !== b.access) return a.access === 'public_domain' ? -1 : 1;
      return a.title.localeCompare(b.title);
    })[0] ?? officialTexts[0];

  useEffect(() => {
    if (!textsForStandard.some((model) => textKey(model) === selectedTextKey)) {
      setSelectedTextKey(textKey(recommendedText ?? textsForStandard[0] ?? officialTexts[0]));
    }
    setLesson(null);
    setSelectedPassageId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardCode]);

  useEffect(() => {
    async function loadLessonPackets() {
      setLoadingPackets(true);
      const response = await fetch(
        `/api/teacher/lesson-excerpts?standard_code=${encodeURIComponent(standardCode)}`
      );
      const body = await response.json();
      if (!response.ok) {
        setLessonPackets([]);
        setSelectedPacketId('');
        setLoadingPackets(false);
        return;
      }
      const packets = (body.packets ?? []) as LessonPacket[];
      setLessonPackets(packets);
      setSelectedPacketId(packets[0]?.id ?? '');
      setLoadingPackets(false);
    }

    loadLessonPackets();
  }, [standardCode]);

  useEffect(() => {
    async function loadPassages() {
      setLoadingPassages(true);
      setError(null);
      const response = await fetch(
        `/api/reading-wins/gutenberg/passages?standard_code=${encodeURIComponent(
          standardCode
        )}&status=all&limit=160`
      );
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? 'Could not load GOGI excerpts for this standard.');
        setStandardPassages([]);
        setPassages([]);
        setLoadingPassages(false);
        return;
      }

      setStandardPassages((body.rows ?? []) as PassageRow[]);
      setLoadingPassages(false);
    }

    loadPassages();
  }, [standardCode]);

  useEffect(() => {
    const rows = standardPassages.filter((row) => passageMatchesOfficialText(row, selectedText));
    setPassages(rows);
    setSelectedPassageId(rows[0]?.id ?? '');
  }, [selectedText, standardPassages]);

  useEffect(() => {
    const selectedCount = textExcerptCounts.get(selectedTextKey) ?? 0;
    const recommendedCount = textExcerptCounts.get(textKey(recommendedText)) ?? 0;

    if (recommendedCount > 0 && selectedCount === 0) {
      setSelectedTextKey(textKey(recommendedText));
    }
  }, [recommendedText, selectedTextKey, textExcerptCounts]);

  async function generateLesson() {
    setGenerating(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/teacher/literary-intelligence/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        standard_code: standardCode,
        text_title: selectedPacket?.title ?? selectedText.title,
        text_author: selectedPacket?.author ?? selectedText.author,
        excerpt: selectedPacket?.text_clean || selectedPassage?.paragraph_text,
        excerpts: selectedPacket
          ? [selectedPacket.text_clean]
          : passages.slice(0, 3).map((passage) => passage.paragraph_text),
        curated_vocab: selectedPacket?.vocab,
        curated_worked_example: selectedPacket?.worked_examples.find(
          (example) => example.standardCode === standardCode
        ),
        lesson_focus:
          lessonFocus ||
          selectedPacket?.worked_examples.find((example) => example.standardCode === standardCode)
            ?.element_named ||
          standardLabels[standardCode],
        student_level: studentLevel,
        lesson_minutes: 90,
      }),
    });

    const body = await response.json();
    setGenerating(false);

    if (!response.ok) {
      setError(body.error ?? 'Could not generate the lesson.');
      return;
    }

    setLesson(body.lesson);
    setMessage(
      body.lesson?.source === 'claude'
        ? 'Cornell lesson generated with Claude.'
        : 'Cornell lesson generated from the GOGI template.'
    );
  }

  async function copyLesson() {
    if (!lesson) return;
    await navigator.clipboard.writeText(lessonAsText(lesson));
    setMessage('Lesson copied.');
  }

  async function exportPowerPoint() {
    if (!lesson) return;
    setExportingPptx(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/teacher/literary-intelligence/pptx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? 'Could not export the PowerPoint.');
      setExportingPptx(false);
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    link.href = url;
    link.download = filenameMatch?.[1] ?? `${lesson.standard_code}-gogi-cornell-lesson.pptx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setExportingPptx(false);
    setMessage('PowerPoint exported.');
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#101828]">
      <TeacherDashboardTopBar active="literary" />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <section className="rounded-lg border border-[#D9E2EF] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#C8D7EA] bg-[#F3F7FD] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#315C93]">
                <BookOpenCheck size={14} />
                Lesson Builder
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[#101828]">
                Build 90-minute Cornell decks from ready-to-teach sources
              </h1>
              <p className="mt-2 text-base leading-7 text-[#667085]">
                Pick the standard, choose a ready source, and generate the Promethean-ready
                Cornell lesson. GOGI uses staged excerpts only as a backup when a ready source
                has not been curated yet.
              </p>
            </div>
            <div className="grid min-w-[280px] grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-3">
                <p className="text-2xl font-black text-[#101828]">{officialTexts.length}</p>
                <p className="text-xs font-semibold text-[#667085]">official texts</p>
              </div>
              <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-3">
                <p className="text-2xl font-black text-[#101828]">{textsForStandard.length}</p>
                <p className="text-xs font-semibold text-[#667085]">texts for standard</p>
              </div>
              <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-3">
                <p className="text-2xl font-black text-[#101828]">{passages.length}</p>
                <p className="text-xs font-semibold text-[#667085]">GOGI excerpts</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-[#D9E2EF] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <NotebookPen size={20} className="text-[#315C93]" />
              <h2 className="text-lg font-black">1. Choose the lesson</h2>
            </div>

            <label className="mb-2 block text-sm font-bold text-[#344054]" htmlFor="standard">
              Benchmark to teach
            </label>
            <select
              id="standard"
              value={standardCode}
              onChange={(event) => {
                setStandardCode(event.target.value);
                setLesson(null);
              }}
              className="mb-4 w-full rounded-lg border border-[#C8D7EA] bg-white px-3 py-2.5 text-sm font-semibold text-[#101828] outline-none focus:border-[#315C93]"
            >
              {allStandards.map((standard) => (
                <option key={standard} value={standard}>
                  {standard} - {standardLabels[standard] ?? 'Official benchmark'}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-sm font-bold text-[#344054]" htmlFor="official-text">
              Official text
            </label>
            <select
              id="official-text"
              value={selectedTextKey}
              onChange={(event) => setSelectedTextKey(event.target.value)}
              className="mb-4 w-full rounded-lg border border-[#C8D7EA] bg-white px-3 py-2.5 text-sm font-semibold text-[#101828] outline-none focus:border-[#315C93]"
            >
              {textsForStandard.map((model) => (
                <option key={textKey(model)} value={textKey(model)}>
                  {model.title}
                  {model.author ? ` - ${model.author}` : ''} ·{' '}
                  {textExcerptCounts.get(textKey(model)) ?? 0} GOGI excerpts
                </option>
              ))}
            </select>

            <div className="mb-4 rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-3">
              <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
                Teachable texts for {standardCode}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
                GOGI auto-selects the strongest mapped text with usable excerpts. You can override it
                when you want a different anchor.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {textsForStandard.slice(0, 8).map((model) => (
                  <button
                    key={textKey(model)}
                    type="button"
                    onClick={() => setSelectedTextKey(textKey(model))}
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${
                      textKey(model) === selectedTextKey
                        ? 'border-[#245BDB] bg-[#EEF4FF] text-[#245BDB]'
                        : 'border-[#D9E2EF] bg-white text-[#475467]'
                    }`}
                  >
                    {model.title}
                    {(textExcerptCounts.get(textKey(model)) ?? 0) > 0
                      ? ` (${textExcerptCounts.get(textKey(model))})`
                      : ''}
                  </button>
                ))}
              </div>
              {textsForStandard.length > 8 && (
                <p className="mt-2 text-xs font-semibold text-[#667085]">
                  {textsForStandard.length - 8} more official text
                  {textsForStandard.length - 8 === 1 ? '' : 's'} available in the dropdown.
                </p>
              )}
            </div>

            <div className="mb-4 rounded-lg border border-[#C8D7EA] bg-[#F8FBFF] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#315C93]">
                  2. Ready-to-teach sources
                </p>
                {loadingPackets && <Loader2 size={14} className="animate-spin text-[#667085]" />}
              </div>
              {lessonPackets.length === 0 ? (
                <p className="text-xs font-semibold leading-5 text-[#667085]">
                  No ready source yet for this standard. GOGI can still use backup excerpts,
                  but the clean 30-slide workflow starts once a ready source exists.
                </p>
              ) : (
                <div className="grid gap-2">
                  {lessonPackets.map((packet) => {
                    const selected = selectedPacket?.id === packet.id;
                    return (
                      <button
                        key={packet.id}
                        type="button"
                        onClick={() => {
                          setSelectedPacketId(packet.id);
                          setLesson(null);
                        }}
                        className={`rounded-lg border p-3 text-left ${
                          selected
                            ? 'border-[#245BDB] bg-white shadow-sm'
                            : 'border-[#D9E2EF] bg-[#FBFCFE] hover:bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                              packet.status === 'ready'
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {packet.status === 'ready' ? 'Ready to teach' : 'Needs cleanup'}
                          </span>
                          <span className="text-[11px] font-bold text-[#667085]">
                            {packet.word_count} words · {packet.vocab.length} vocab
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-black text-[#101828]">
                          {packet.title} — {packet.author}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
                          {packet.chapter_or_section}
                        </p>
                        {packet.errors.length > 0 && (
                          <p className="mt-1 text-xs font-bold text-rose-700">
                            {packet.errors[0]}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="mb-2 block text-sm font-bold text-[#344054]" htmlFor="lesson-focus">
              Lesson focus
            </label>
            <input
              id="lesson-focus"
              value={lessonFocus}
              onChange={(event) => setLessonFocus(event.target.value)}
              placeholder={standardLabels[standardCode] ?? 'Skill focus'}
              className="mb-4 w-full rounded-lg border border-[#C8D7EA] bg-white px-3 py-2.5 text-sm font-semibold text-[#101828] outline-none focus:border-[#315C93]"
            />

            <label className="mb-2 block text-sm font-bold text-[#344054]" htmlFor="level">
              Student level
            </label>
            <select
              id="level"
              value={studentLevel}
              onChange={(event) =>
                setStudentLevel(event.target.value as 'support' | 'grade_level' | 'stretch')
              }
              className="mb-5 w-full rounded-lg border border-[#C8D7EA] bg-white px-3 py-2.5 text-sm font-semibold text-[#101828] outline-none focus:border-[#315C93]"
            >
              <option value="support">Support</option>
              <option value="grade_level">Grade level</option>
              <option value="stretch">Stretch</option>
            </select>

            <button
              type="button"
              onClick={generateLesson}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#245BDB] px-4 py-3 text-sm font-black text-white transition hover:bg-[#1E4EBC] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Build lesson preview
            </button>

            {message && (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                {message}
              </p>
            )}
            {error && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {selectedPacket && (
              <section className="rounded-lg border border-[#245BDB] bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                      {selectedPacket.status === 'ready' ? 'Ready source selected' : 'Source needs cleanup'}
                    </div>
                    <h2 className="text-xl font-black text-[#101828]">
                      {selectedPacket.title} — {selectedPacket.author}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">
                      {selectedPacket.chapter_or_section} · {selectedPacket.word_count} words
                    </p>
                  </div>
                  <p className="max-w-sm text-sm font-semibold leading-6 text-[#667085]">
                    This is the clean input for the deck: passage, vocab, and worked example are
                    already locked before Claude designs the lesson.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-4">
                    <p className="mb-2 text-sm font-black text-[#101828]">Clean passage</p>
                    <p className="max-h-56 overflow-auto text-sm leading-7 text-[#344054]">
                      {selectedPacket.text_clean}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <div className="rounded-lg border border-[#E4EAF3] bg-[#FFF8E1] p-4">
                      <p className="text-sm font-black text-[#101828]">Vocab anchor</p>
                      <div className="mt-2 grid gap-2">
                        {selectedPacket.vocab.map((item) => (
                          <p key={item.word} className="text-sm leading-5 text-[#344054]">
                            <span className="font-black">{item.word}</span> ({item.pos}) —{' '}
                            {item.student_friendly_def}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#E4EAF3] bg-white p-4">
                      <p className="text-sm font-black text-[#101828]">Worked example</p>
                      {selectedPacket.worked_examples
                        .filter((example) => example.standardCode === standardCode)
                        .slice(0, 1)
                        .map((example) => (
                          <div key={example.standardCode} className="mt-2 text-sm leading-6 text-[#344054]">
                            <p>
                              <span className="font-black">Element:</span> {example.element_named}
                            </p>
                            <p>
                              <span className="font-black">Evidence:</span> “{example.evidence_quoted}”
                            </p>
                            <p>
                              <span className="font-black">Effect:</span> {example.effect_explanation}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-lg border border-[#D9E2EF] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-[#315C93]" />
                  <h2 className="text-lg font-black">
                    {selectedPacket ? 'Backup staged excerpts' : '2. Choose a backup excerpt'}
                  </h2>
                </div>
                {loadingPassages && (
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#667085]">
                    <Loader2 size={16} className="animate-spin" />
                    Loading
                  </span>
                )}
              </div>

              {!loadingPassages && passages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#C8D7EA] bg-[#F8FAFD] p-5">
                  <p className="font-bold text-[#101828]">No staged excerpt yet for this text and benchmark.</p>
                  <p className="mt-1 text-sm leading-6 text-[#667085]">
                    Use the Gutenberg Library to harvest or upload this text. Once GOGI has excerpts,
                    this lesson builder will use them for the worked example and practice.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {passages.slice(0, 4).map((passage) => {
                    const selected = selectedPassage?.id === passage.id;
                    return (
                      <button
                        key={passage.id}
                        type="button"
                        onClick={() => setSelectedPassageId(passage.id)}
                        className={`rounded-lg border p-4 text-left transition ${
                          selected
                            ? 'border-[#245BDB] bg-[#F3F7FF]'
                            : 'border-[#E4EAF3] bg-white hover:border-[#A9BFE0]'
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-xs font-black text-[#245BDB]">
                            {passage.coverage_strand_label ?? standardLabels[standardCode] ?? standardCode}
                          </span>
                          <span className="text-xs font-semibold text-[#667085]">
                            {passage.approval_status ?? 'pending'} · {passage.word_count ?? '?'} words
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-[#344054]">
                          {compact(passage.paragraph_text, 360)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-[#D9E2EF] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList size={20} className="text-[#315C93]" />
                  <h2 className="text-lg font-black">3. Generate and export</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyLesson}
                    disabled={!lesson}
                    className="rounded-lg border border-[#C8D7EA] px-3 py-2 text-sm font-bold text-[#315C93] transition hover:bg-[#F3F7FD] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy lesson
                  </button>
                  <button
                    type="button"
                    onClick={exportPowerPoint}
                    disabled={!lesson || exportingPptx}
                    className="flex items-center gap-2 rounded-lg bg-[#101828] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#263142] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportingPptx ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Export PowerPoint
                  </button>
                </div>
              </div>

              {!lesson ? (
                <div className="rounded-lg border border-dashed border-[#C8D7EA] bg-[#F8FAFD] p-8 text-center">
                  <p className="text-lg font-black text-[#101828]">Ready when you are.</p>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                    Generate a lesson to see the teacher move, student notes, worked example,
                    guided practice, cue questions, summary frame, and exit ticket.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
                      {lesson.standard_code}
                    </p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-[#101828]">
                      {lesson.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#667085]">{lesson.objective}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-4">
                      <p className="text-sm font-black text-[#101828]">Plain English Standard</p>
                      <p className="mt-2 text-sm leading-6 text-[#344054]">
                        {lesson.plain_english_standard}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-4">
                      <p className="text-sm font-black text-[#101828]">Skill Overview</p>
                      <p className="mt-2 text-sm leading-6 text-[#344054]">{lesson.skill_overview}</p>
                    </div>
                  </div>

                  {lesson.vocabulary && lesson.vocabulary.length > 0 && (
                    <div className="rounded-lg border border-[#E4EAF3] bg-[#FFF8E1] p-4">
                      <p className="text-sm font-black text-[#101828]">Vocabulary Anchor</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {lesson.vocabulary.map((item) => (
                          <div key={item.term} className="rounded-md bg-white p-3">
                            <p className="text-sm font-black text-[#101828]">{item.term}</p>
                            <p className="mt-1 text-sm leading-6 text-[#344054]">{item.meaning}</p>
                            <p className="mt-1 text-xs leading-5 text-[#667085]">{item.example}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <ListBlock title="How to identify it" items={lesson.how_to_identify} />
                    <ListBlock title="How to solve it" items={lesson.how_to_solve} />
                  </div>

                  <div className="rounded-lg border border-[#E4EAF3] bg-white">
                    <div className="border-b border-[#E4EAF3] px-4 py-3">
                      <p className="text-sm font-black text-[#101828]">Cornell notes flow</p>
                    </div>
                    <div className="divide-y divide-[#E4EAF3]">
                      {lesson.cornell_sequence.map((section) => (
                        <div key={section.title} className="grid gap-3 p-4 md:grid-cols-[180px_1fr_1fr]">
                          <p className="text-sm font-black text-[#101828]">{section.title}</p>
                          <p className="text-sm leading-6 text-[#344054]">
                            <span className="font-bold">Teacher: </span>
                            {section.teacher_move}
                          </p>
                          <p className="text-sm leading-6 text-[#344054]">
                            <span className="font-bold">Student notes: </span>
                            {section.student_notes}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-4">
                    <p className="text-sm font-black text-[#101828]">Worked Example</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <MiniColumn label="Element" value={lesson.worked_example.element} />
                      <MiniColumn label="Evidence" value={lesson.worked_example.evidence} />
                      <MiniColumn label="Effect" value={lesson.worked_example.effect} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <ListBlock title="Guided practice" items={lesson.guided_practice} />
                    <ListBlock title="Independent practice" items={lesson.independent_practice} />
                    <ListBlock title="Cue questions" items={lesson.cue_questions} />
                  </div>

                  {lesson.ppt_sequence && lesson.ppt_sequence.length > 0 && (
                    <div className="rounded-lg border border-[#E4EAF3] bg-white">
                      <div className="border-b border-[#E4EAF3] px-4 py-3">
                        <p className="text-sm font-black text-[#101828]">
                          90-minute PowerPoint build plan
                        </p>
                      </div>
                      <div className="divide-y divide-[#E4EAF3]">
                        {lesson.ppt_sequence.map((slide) => (
                          <div
                            key={`${slide.slide}-${slide.title}`}
                            className="grid gap-3 p-4 md:grid-cols-[70px_190px_1fr_1fr]"
                          >
                            <p className="text-sm font-black text-[#245BDB]">
                              {slide.slide}
                              <span className="block text-xs font-bold text-[#667085]">
                                {slide.minutes}m
                              </span>
                            </p>
                            <p className="text-sm font-black text-[#101828]">{slide.title}</p>
                            <p className="text-sm leading-6 text-[#344054]">
                              <span className="font-bold">Teacher: </span>
                              {slide.teacher_action}
                            </p>
                            <p className="text-sm leading-6 text-[#344054]">
                              <span className="font-bold">Student: </span>
                              {slide.student_task}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-4">
                      <p className="text-sm font-black text-[#101828]">Summary Frame</p>
                      <p className="mt-2 text-sm leading-6 text-[#344054]">{lesson.summary_frame}</p>
                    </div>
                    <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-4">
                      <p className="text-sm font-black text-[#101828]">Exit Ticket</p>
                      <p className="mt-2 text-sm leading-6 text-[#344054]">{lesson.exit_ticket}</p>
                    </div>
                  </div>

                  {lesson.trust_chain && lesson.trust_chain.length > 0 && (
                    <ListBlock title="Teacher trust chain" items={lesson.trust_chain} />
                  )}
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-[#E4EAF3] bg-[#FBFCFE] p-4">
      <p className="text-sm font-black text-[#101828]">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-[#344054]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniColumn({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#344054]">{value}</p>
    </div>
  );
}
