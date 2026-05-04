'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { createClient } from '@/lib/supabase/client';
import { FAST_GRADE9_READING_DEMANDS } from '@/lib/reading-wins/fastSkillMap';
import {
  evaluateOriginalItemQuality,
  isOriginalBenchmark,
  ORIGINAL_ITEM_BENCHMARKS,
  ORIGINAL_PASSAGE_TYPES,
  type OriginalItemDraft,
  type OriginalItemQualityGate,
  type OriginalItemBenchmark,
  type OriginalPassageType,
} from '@/lib/original-items/engine';

type OriginalDraftRow = {
  id: string;
  benchmark_code: string;
  reporting_category: string;
  grade: number;
  passage_type: string;
  passage_title: string;
  passage_text: string;
  passage_word_count: number;
  item_type: string;
  stem_pattern: string;
  prompt_text: string;
  options: Array<{ letter: string; text: string }>;
  correct_answer: string;
  correct_rationale: string;
  distractor_rationales: Record<string, string>;
  remediation_hint: string;
  reassessment_plan: string;
  difficulty_estimate: number;
  status: string;
  created_at: string;
};

function label(value: string) {
  return value.replace(/_/g, ' ');
}

function qualityLabel(status: OriginalItemQualityGate['status']) {
  if (status === 'strong_signal') return 'Strong FAST fit';
  if (status === 'emerging_signal') return 'Needs review';
  return 'Weak fit';
}

function qualityBadgeLabel(quality: OriginalItemQualityGate) {
  if (quality.decision === 'reject') return 'Blocked';
  return qualityLabel(quality.status);
}

function qualityClasses(decision: OriginalItemQualityGate['decision']) {
  if (decision === 'pass') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (decision === 'review') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-rose-200 bg-rose-50 text-rose-800';
}

function qualityForDraft(draft: OriginalDraftRow) {
  if (!isOriginalBenchmark(draft.benchmark_code)) return null;

  return evaluateOriginalItemQuality({
    benchmark_code: draft.benchmark_code,
    reporting_category: draft.reporting_category as OriginalItemDraft['reporting_category'],
    grade: draft.grade,
    passage_type: draft.passage_type as OriginalItemDraft['passage_type'],
    passage_title: draft.passage_title,
    passage_text: draft.passage_text,
    passage_word_count: draft.passage_word_count,
    item_type: draft.item_type as OriginalItemDraft['item_type'],
    stem_pattern: draft.stem_pattern,
    prompt_text: draft.prompt_text,
    options: draft.options,
    correct_answer: draft.correct_answer,
    correct_rationale: draft.correct_rationale,
    distractor_rationales: draft.distractor_rationales,
    remediation_hint: draft.remediation_hint,
    reassessment_plan: draft.reassessment_plan,
    difficulty_estimate: draft.difficulty_estimate,
  });
}

function draftDecision(draft: OriginalDraftRow) {
  if (draft.status === 'promoted') return 'promoted';
  return qualityForDraft(draft)?.decision ?? 'review';
}

export default function OriginalItemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const benchmarkParam = searchParams.get('benchmark');
  const initialBenchmark = isOriginalBenchmark(benchmarkParam ?? '')
    ? (benchmarkParam as OriginalItemBenchmark)
    : 'ELA.9.R.2.2';
  const [benchmarkCode, setBenchmarkCode] = useState<OriginalItemBenchmark>(initialBenchmark);
  const [passageType, setPassageType] = useState<OriginalPassageType>('informational');
  const [draftStatus, setDraftStatus] = useState<'active' | 'draft' | 'promoted' | 'all'>('active');
  const [topic, setTopic] = useState('');
  const [draftCount, setDraftCount] = useState(5);
  const [drafts, setDrafts] = useState<OriginalDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDrafts() {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('original_item_drafts')
      .select(
        'id, benchmark_code, reporting_category, grade, passage_type, passage_title, passage_text, passage_word_count, item_type, stem_pattern, prompt_text, options, correct_answer, correct_rationale, distractor_rationales, remediation_hint, reassessment_plan, difficulty_estimate, status, created_at'
      )
      .eq('benchmark_code', benchmarkCode);

    if (draftStatus === 'active') {
      query = query.in('status', ['draft', 'review']);
    } else if (draftStatus !== 'all') {
      query = query.eq('status', draftStatus);
    }

    const { data, error: loadError } = await query
      .order('created_at', { ascending: false })
      .limit(12);

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setDrafts((data ?? []) as OriginalDraftRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchmarkCode, draftStatus]);

  async function generateDraft(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setGenerating(true);

    const response = await fetch('/api/original-items/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        benchmark_code: benchmarkCode,
        passage_type: passageType,
        topic,
        grade: 9,
        count: draftCount,
      }),
    });
    const body = (await response.json()) as {
      error?: string;
      draft?: OriginalDraftRow;
      drafts?: OriginalDraftRow[];
      quality_gates?: OriginalItemQualityGate[];
    };
    setGenerating(false);

    if (!response.ok || !body.drafts?.length) {
      setError(body.error ?? 'Could not generate original item.');
      return;
    }

    setMessage(
      `${body.drafts.length} ${benchmarkCode} original draft${body.drafts.length === 1 ? '' : 's'} created.`
    );
    await loadDrafts();
  }

  async function promoteDraft(draft: OriginalDraftRow) {
    setError(null);
    setMessage(null);
    setPromotingId(draft.id);

    const response = await fetch(`/api/original-items/${draft.id}/promote`, {
      method: 'POST',
    });
    const body = (await response.json()) as { error?: string; already_promoted?: boolean };
    setPromotingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not promote original item.');
      return;
    }

    setMessage(
      body.already_promoted
        ? `${draft.benchmark_code} draft was already in the question bank.`
        : `Added to question bank. Recheck Library Readiness for ${draft.benchmark_code}.`
    );
    await loadDrafts();
  }

  function goToReadiness() {
    router.push('/admin/reading-win-coverage');
  }

  const visibleDrafts =
    draftStatus === 'active'
      ? drafts.filter((draft) => qualityForDraft(draft)?.decision !== 'reject')
      : drafts;

  const selectedDemand = FAST_GRADE9_READING_DEMANDS.find(
    (demand) => demand.standardCode === benchmarkCode
  );

  const draftSummary = drafts.reduce(
    (summary, draft) => {
      const decision = draftDecision(draft);
      if (decision === 'pass') summary.usable += 1;
      if (decision === 'review') summary.review += 1;
      if (decision === 'reject') summary.blocked += 1;
      if (decision === 'promoted') summary.promoted += 1;
      return summary;
    },
    { usable: 0, review: 0, blocked: 0, promoted: 0 }
  );

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TeacherDashboardTopBar active="original" />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
              FAST-Aligned Original Item Engine
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Item Builder</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
              Build one standard at a time: generate FAST-aligned drafts, review the usable ones,
              then promote the strongest items into the student question bank.
            </p>
          </div>
          <button
            type="button"
            onClick={goToReadiness}
            className="rounded-md border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#334155]"
          >
            Back to Library Readiness
          </button>
        </div>

        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Building now
              </p>
              <h2 className="mt-1 text-xl font-semibold">{benchmarkCode}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#475569]">
                {selectedDemand?.teacherTitle ??
                  'Generate grade-level reading practice aligned to this benchmark.'}
              </p>
              {selectedDemand ? (
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  Student target: {selectedDemand.studentTitle}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-lg font-semibold text-emerald-900">{draftSummary.usable}</p>
                <p className="text-[10px] font-semibold uppercase text-emerald-700">Usable</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-lg font-semibold text-amber-900">{draftSummary.review}</p>
                <p className="text-[10px] font-semibold uppercase text-amber-700">Review</p>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-lg font-semibold text-rose-900">{draftSummary.blocked}</p>
                <p className="text-[10px] font-semibold uppercase text-rose-700">Blocked</p>
              </div>
              <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2">
                <p className="text-lg font-semibold text-[#1D4ED8]">{draftSummary.promoted}</p>
                <p className="text-[10px] font-semibold uppercase text-[#2563EB]">Promoted</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <form
            onSubmit={generateDraft}
            className="rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm"
          >
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">Step 1</p>
              <h2 className="mt-1 text-lg font-semibold">Generate a content set</h2>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">
                Start with five drafts. Keep the best, promote only what passes the FAST-fit check.
              </p>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold">Benchmark</span>
              <select
                value={benchmarkCode}
                onChange={(event) => {
                  setBenchmarkCode(event.target.value as OriginalItemBenchmark);
                  setDraftStatus('active');
                }}
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              >
                {ORIGINAL_ITEM_BENCHMARKS.map((benchmark) => (
                  <option key={benchmark} value={benchmark}>
                    {benchmark}
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold">Passage type</span>
              <select
                value={passageType}
                onChange={(event) => setPassageType(event.target.value as OriginalPassageType)}
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              >
                {ORIGINAL_PASSAGE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold">Optional topic seed</span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Leave blank, or add a quiet context like school phone policy"
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs leading-5 text-[#64748B]">
                The seed guides the passage context. It will not be pasted into the title.
              </span>
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold">Draft count</span>
              <input
                type="number"
                min={1}
                max={25}
                value={draftCount}
                onChange={(event) => setDraftCount(Number(event.target.value))}
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </label>

            {error ? (
              <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            {message ? (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <p>{message}</p>
                {message.includes('question bank') ? (
                  <button
                    type="button"
                    onClick={goToReadiness}
                    className="mt-3 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Recheck readiness
                  </button>
                ) : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={generating}
              className="w-full rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {generating ? 'Generating...' : 'Generate original set'}
            </button>
            <p className="mt-3 text-xs leading-5 text-[#64748B]">
              Nothing goes to students from this page until you promote it into the question bank.
            </p>
          </form>

          <section className="space-y-4">
            <div className="rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                    Step 2
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Review usable drafts</h2>
                  <p className="mt-1 text-sm text-[#64748B]">
                    Showing {benchmarkCode} only. Default view hides blocked drafts so review stays
                    focused.
                  </p>
                </div>
                <select
                  value={draftStatus}
                  onChange={(event) =>
                    setDraftStatus(event.target.value as 'active' | 'draft' | 'promoted' | 'all')
                  }
                  className="rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
                >
                  <option value="active">Needs action</option>
                  <option value="draft">Draft only</option>
                  <option value="promoted">Promoted</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-[#64748B]">Loading drafts...</p>
            ) : visibleDrafts.length ? (
              visibleDrafts.map((draft) => {
                const quality = qualityForDraft(draft);

                return (
                  <article
                    key={draft.id}
                    className="rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                          {draft.benchmark_code} · {draft.reporting_category} ·{' '}
                          {label(draft.item_type)}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">{draft.passage_title}</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {quality ? (
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${qualityClasses(
                              quality.decision
                            )}`}
                          >
                            {qualityBadgeLabel(quality)} · {quality.score}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#2563EB]">
                          {draft.status}
                        </span>
                      </div>
                    </div>

                    {quality ? (
                      <div className="mt-4 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                          Teacher check
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#334155]">{quality.summary}</p>
                      </div>
                    ) : null}

                    {quality ? (
                      <details className="mt-3 rounded-md border border-[#E2E8F0] bg-white p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0F172A]">
                          Show quality gate details · {quality.score}/100 ·{' '}
                          {qualityBadgeLabel(quality)}
                        </summary>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                              FAST Blueprint Quality Gate
                            </p>
                            <p className="mt-1 text-sm text-[#334155]">{quality.summary}</p>
                            <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                              Pattern: {quality.pattern.name}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[#64748B]">
                              Evidence demand: {quality.pattern.evidenceDemand}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[#64748B]">
                              FAST reference: {quality.pattern.releasedFastEvidence}
                            </p>
                          </div>
                          <p className="text-lg font-semibold text-[#0F172A]">
                            {quality.score}/100
                          </p>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {quality.checks.map((check) => (
                            <div
                              key={`${draft.id}-${check.key}`}
                              className={`rounded-md border p-2 text-xs ${
                                check.passed
                                  ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                                  : 'border-amber-100 bg-amber-50 text-amber-800'
                              }`}
                            >
                              <p className="font-semibold">
                                {check.passed ? 'Pass' : 'Review'} · {check.label}
                              </p>
                              <p className="mt-1 leading-5">{check.note}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="mt-4 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Passage · {draft.passage_word_count} words
                      </p>
                      <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6">
                        {draft.passage_text}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Student question
                      </p>
                      <p className="mt-1 text-sm font-semibold">{draft.prompt_text}</p>
                      <div className="mt-2 grid gap-2">
                        {draft.options.map((option) => (
                          <div
                            key={`${draft.id}-${option.letter}`}
                            className={`rounded-md border p-2 text-sm ${
                              draft.correct_answer.split(',').includes(option.letter)
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-[#E2E8F0]'
                            }`}
                          >
                            <span className="font-semibold">{option.letter}.</span> {option.text}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <div className="rounded-md border border-[#E2E8F0] p-3">
                        <p className="text-xs font-semibold uppercase text-[#64748B]">
                          Why correct
                        </p>
                        <p className="mt-1 text-[#334155]">{draft.correct_rationale}</p>
                      </div>
                      <div className="rounded-md border border-[#E2E8F0] p-3">
                        <p className="text-xs font-semibold uppercase text-[#64748B]">
                          Remediation
                        </p>
                        <p className="mt-1 text-[#334155]">{draft.remediation_hint}</p>
                      </div>
                      <div className="rounded-md border border-[#E2E8F0] p-3">
                        <p className="text-xs font-semibold uppercase text-[#64748B]">
                          Reassessment
                        </p>
                        <p className="mt-1 text-[#334155]">{draft.reassessment_plan}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        disabled={
                          promotingId === draft.id ||
                          draft.status === 'promoted' ||
                          quality?.decision === 'reject'
                        }
                        onClick={() => promoteDraft(draft)}
                        className="rounded-md bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {draft.status === 'promoted'
                          ? 'Already in question bank'
                          : promotingId === draft.id
                            ? 'Promoting...'
                            : quality?.decision === 'reject'
                              ? 'Quality gate blocked'
                              : 'Send to question bank'}
                      </button>
                      {quality?.decision === 'review' ? (
                        <p className="mt-2 text-xs leading-5 text-[#64748B]">
                          Review signal: usable with teacher judgment before sending to students.
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-lg border border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
                No {draftStatus === 'active' ? 'actionable' : draftStatus} drafts found for{' '}
                {benchmarkCode}.
              </p>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
