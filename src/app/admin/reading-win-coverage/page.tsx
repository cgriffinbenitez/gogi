'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CircleAlert, CircleDashed, RefreshCw } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { createClient } from '@/lib/supabase/client';
import {
  FAST_GRADE9_READING_DEMANDS,
  type FastGrade9ReadingDemand,
} from '@/lib/reading-wins/fastSkillMap';
import {
  analyzeReadingWinCoverage,
  extractReadingWinQuestionTaxonomy,
  type PromotedReadingWinQuestion,
  type ReadingWinCoverageAnalysis,
} from '@/lib/reading-wins/sessionBuilder';
import { getGutenbergStandardBlueprint } from '@/pipeline/standardBlueprints';

type QuestionBankRow = PromotedReadingWinQuestion & {
  source_classification: string | null;
};

type CoverageRow = {
  demand: FastGrade9ReadingDemand;
  analysis: ReadingWinCoverageAnalysis;
  strandCoverage: StrandCoverageRow[];
};

type StrandCoverageRow = {
  id: string;
  label: string;
  studentCanDo: string;
  approvedRows: number;
  qualityRows: number;
  distinctPassages: number;
  estimatedFreshSessions: number;
  status: 'ready' | 'thin' | 'blocked';
  sourceCounts: {
    gutenberg: number;
    released: number;
    original: number;
  };
};

type GutenbergStatusRow = {
  standard_code: string;
  teacher_title: string;
  approved_passages: number;
  pending_review_passages: number;
  rejected_passages: number;
  unpromoted_approved_passages: number;
  promoted_question_rows: number;
  trusted_promoted_question_rows: number;
  audit_promoted_question_rows: number;
  sample_titles: string[];
};

type GutenbergStatusTotals = {
  approved_passages: number;
  pending_review_passages: number;
  unpromoted_approved_passages: number;
  promoted_question_rows: number;
  trusted_promoted_question_rows?: number;
  audit_promoted_question_rows?: number;
};

function statusLabel(status: ReadingWinCoverageAnalysis['status']) {
  if (status === 'ready') return 'Ready';
  if (status === 'thin') return 'Thin';
  return 'Blocked';
}

function statusClasses(status: ReadingWinCoverageAnalysis['status']) {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'thin') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-rose-200 bg-rose-50 text-rose-800';
}

function statusIcon(status: ReadingWinCoverageAnalysis['status']) {
  if (status === 'ready') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'thin') return <CircleDashed className="h-4 w-4" />;
  return <CircleAlert className="h-4 w-4" />;
}

function nextAction(row: CoverageRow) {
  const { analysis } = row;
  if (analysis.ready) return 'Assignable today';
  if (analysis.viableRows === 0) return 'Needs first content set';
  if (analysis.viableRows < 6) return 'Add enough quality reps for a full loop';
  if (analysis.distinctPassages < 2) return 'Add a second passage for transfer';
  return 'Review item quality';
}

function rowGuidance(row: CoverageRow) {
  const { analysis } = row;
  if (analysis.ready) {
    if (analysis.depthStatus === 'pilot_depth') {
      return `Enough for ${analysis.estimatedFreshSessions} estimated fresh sessions. Strong enough for repeated pilot use.`;
    }
    if (analysis.depthStatus === 'pilot_sequence') {
      return `Enough for about ${analysis.estimatedFreshSessions} fresh sessions. Keep building toward pilot depth.`;
    }
    return 'Enough for one Reading Win today, but not enough for a sustained pilot sequence yet.';
  }
  if (analysis.approvedRows === 0) {
    return null;
  }
  if (analysis.viableRows === 0) {
    return `${analysis.approvedRows} approved item${
      analysis.approvedRows === 1 ? '' : 's'
    } exist, but none pass the Reading Win quality gate yet.`;
  }
  if (analysis.viableRows < 6) {
    return `${analysis.viableRows} quality rep${
      analysis.viableRows === 1 ? '' : 's'
    } available. Build to six so GOGI can assign a complete loop.`;
  }
  if (analysis.distinctPassages < 2) {
    return 'Practice reps exist, but GOGI still needs a second passage for transfer proof.';
  }
  return 'Approved content exists, but the current mix still needs review before assigning.';
}

function readinessSortValue(row: CoverageRow) {
  if (row.analysis.status === 'blocked') return 0;
  if (row.analysis.status === 'thin') return 1;
  return 2;
}

function section(content: string | null, label: string) {
  if (!content) return '';
  const pattern = new RegExp(`${label}:\\n([\\s\\S]*?)(?=\\n\\n[A-Z_ ]+:\\n|$)`, 'i');
  return content.match(pattern)?.[1]?.trim() ?? '';
}

function passageSignature(content: string | null) {
  return section(content, 'PASSAGE')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function sourceBucket(question: QuestionBankRow) {
  if (
    question.source === 'gutenberg_public_domain' ||
    question.source === 'rights_managed_literature'
  ) {
    return 'gutenberg';
  }
  if (question.is_released_item || question.source === 'released_fast') return 'released';
  return 'original';
}

function questionMatchesStrand(question: QuestionBankRow, strandLabel: string) {
  const taxonomy = extractReadingWinQuestionTaxonomy(question);
  const targetSkill = taxonomy.targetSkill?.toLowerCase().trim();
  return targetSkill === strandLabel.toLowerCase().trim();
}

function questionPassesItemGate(question: QuestionBankRow) {
  const taxonomy = extractReadingWinQuestionTaxonomy(question);
  return /strong signal|emerging signal/i.test(taxonomy.quality ?? '');
}

function buildStrandCoverage(standardCode: string, questions: QuestionBankRow[]) {
  const blueprint = getGutenbergStandardBlueprint(standardCode);
  return (blueprint?.coverageStrands ?? []).map<StrandCoverageRow>((strand) => {
    const matching = questions.filter((question) => questionMatchesStrand(question, strand.label));
    const quality = matching.filter(questionPassesItemGate);
    const signatures = new Set(
      quality.map((question) => passageSignature(question.content)).filter(Boolean)
    );
    const estimatedFreshSessions = Math.max(
      0,
      Math.min(Math.floor(quality.length / 6), Math.max(0, signatures.size - 1))
    );
    const status =
      quality.length >= 6 && signatures.size >= 2
        ? 'ready'
        : quality.length > 0
          ? 'thin'
          : 'blocked';
    const sourceCounts = quality.reduce(
      (counts, question) => {
        counts[sourceBucket(question)] += 1;
        return counts;
      },
      { gutenberg: 0, released: 0, original: 0 }
    );

    return {
      id: strand.id,
      label: strand.label,
      studentCanDo: strand.studentCanDo,
      approvedRows: matching.length,
      qualityRows: quality.length,
      distinctPassages: signatures.size,
      estimatedFreshSessions,
      status,
      sourceCounts,
    };
  });
}

export default function ReadingWinCoveragePage() {
  const router = useRouter();
  const supabase = createClient();
  const [questions, setQuestions] = useState<QuestionBankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingStandard, setGeneratingStandard] = useState<string | null>(null);
  const [buildingLibrary, setBuildingLibrary] = useState(false);
  const [promotingGutenberg, setPromotingGutenberg] = useState(false);
  const [targetPerStandard, setTargetPerStandard] = useState(24);
  const [selectedStandardCode, setSelectedStandardCode] = useState('all');
  const [gutenbergRows, setGutenbergRows] = useState<GutenbergStatusRow[]>([]);
  const [gutenbergTotals, setGutenbergTotals] = useState<GutenbergStatusTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadCoverage() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const [{ data, error: loadError }, gutenbergResponse] = await Promise.all([
      supabase
        .from('questions')
        .select(
          'id, content, cognitive_skill_targeted, source_classification, difficulty_level, title, option_a_text, option_b_text, option_c_text, option_d_text, correct_option, rationale, source, is_released_item'
        )
        .eq('approved', true)
        .eq('flagged', false)
        .order('created_at', { ascending: false })
        .limit(800),
      fetch('/api/reading-wins/gutenberg/status'),
    ]);

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    if (gutenbergResponse.ok) {
      const body = (await gutenbergResponse.json()) as {
        rows?: GutenbergStatusRow[];
        totals?: GutenbergStatusTotals;
      };
      setGutenbergRows(body.rows ?? []);
      setGutenbergTotals(body.totals ?? null);
    } else {
      setGutenbergRows([]);
      setGutenbergTotals(null);
    }

    setQuestions((data ?? []) as QuestionBankRow[]);
    setLoading(false);
  }

  async function generateMissing(row: CoverageRow) {
    setGeneratingStandard(row.demand.standardCode);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/reading-wins/coverage/generate-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ standard_code: row.demand.standardCode }),
    });
    const body = (await response.json()) as {
      error?: string;
      message?: string;
      generated_count?: number;
      promoted_count?: number;
      after?: ReadingWinCoverageAnalysis;
    };

    setGeneratingStandard(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not generate missing coverage.');
      return;
    }

    setMessage(
      body.message ??
        `${row.demand.standardCode}: generated ${body.generated_count ?? 0}, promoted ${
          body.promoted_count ?? 0
        }.`
    );
    await loadCoverage();
  }

  async function buildPilotLibrary() {
    setBuildingLibrary(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/reading-wins/library/build-pilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_per_standard: targetPerStandard }),
    });
    const body = (await response.json()) as {
      error?: string;
      message?: string;
      ready_count?: number;
      standard_count?: number;
      generated_count?: number;
      promoted_count?: number;
    };

    setBuildingLibrary(false);

    if (!response.ok) {
      setError(body.error ?? 'Could not build pilot library.');
      return;
    }

    setMessage(
      body.message ??
        `Library build complete: ${body.ready_count ?? 0}/${body.standard_count ?? 0} ready; ${
          body.promoted_count ?? 0
        } items promoted.`
    );
    await loadCoverage();
  }

  async function promoteApprovedGutenberg() {
    setPromotingGutenberg(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/reading-wins/gutenberg/promote-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 60 }),
    });
    const body = (await response.json()) as {
      error?: string;
      message?: string;
      promoted_count?: number;
    };

    setPromotingGutenberg(false);

    if (!response.ok) {
      setError(body.error ?? 'Could not promote approved Gutenberg passages.');
      return;
    }

    setMessage(
      body.message ??
        `Promoted ${body.promoted_count ?? 0} approved Gutenberg passages into Reading Wins.`
    );
    await loadCoverage();
  }

  useEffect(() => {
    loadCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coverageRows = useMemo<CoverageRow[]>(() => {
    return FAST_GRADE9_READING_DEMANDS.map((demand) => {
      const matchingQuestions = questions.filter(
        (question) =>
          question.cognitive_skill_targeted === demand.standardCode ||
          question.source_classification === demand.standardCode
      );
      return {
        demand,
        analysis: analyzeReadingWinCoverage({
          demand,
          questions: matchingQuestions,
        }),
        strandCoverage: buildStrandCoverage(demand.standardCode, matchingQuestions),
      };
    });
  }, [questions]);

  const summary = useMemo(() => {
    const ready = coverageRows.filter((row) => row.analysis.status === 'ready').length;
    const thin = coverageRows.filter((row) => row.analysis.status === 'thin').length;
    const blocked = coverageRows.filter((row) => row.analysis.status === 'blocked').length;
    const strands = coverageRows.flatMap((row) => row.strandCoverage);
    const readyStrands = strands.filter((strand) => strand.status === 'ready').length;
    const thinStrands = strands.filter((strand) => strand.status === 'thin').length;
    const blockedStrands = strands.filter((strand) => strand.status === 'blocked').length;
    return {
      ready,
      thin,
      blocked,
      total: coverageRows.length,
      readyStrands,
      thinStrands,
      blockedStrands,
      totalStrands: strands.length,
    };
  }, [coverageRows]);

  const sortedCoverageRows = useMemo(() => {
    const filtered =
      selectedStandardCode === 'all'
        ? coverageRows
        : coverageRows.filter((row) => row.demand.standardCode === selectedStandardCode);
    return [...filtered].sort((a, b) => {
      const statusDelta = readinessSortValue(a) - readinessSortValue(b);
      if (statusDelta !== 0) return statusDelta;
      return a.demand.standardCode.localeCompare(b.demand.standardCode);
    });
  }, [coverageRows, selectedStandardCode]);

  const selectedCoverageRow = useMemo(
    () =>
      selectedStandardCode === 'all'
        ? null
        : coverageRows.find((row) => row.demand.standardCode === selectedStandardCode) ?? null,
    [coverageRows, selectedStandardCode]
  );

  const visibleGutenbergRows = useMemo(
    () =>
      selectedStandardCode === 'all'
        ? gutenbergRows
        : gutenbergRows.filter((row) => row.standard_code === selectedStandardCode),
    [gutenbergRows, selectedStandardCode]
  );

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TeacherDashboardTopBar active="coverage" />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
              Reading Win Coverage
            </p>
            <h1 className="mt-1 text-3xl font-semibold">FAST Remediation Readiness Board</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
              See which Grade 9 FAST standards are ready for daily student work. A standard is ready
              only when the question bank can form five quality reps and one transfer item.
            </p>
          </div>
          <button
            type="button"
            onClick={loadCoverage}
            className="inline-flex items-center gap-2 rounded-md bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <section className="mb-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-[#CBD5E1] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Standards
            </p>
            <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ready</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{summary.ready}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Thin</p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">{summary.thin}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Blocked</p>
            <p className="mt-1 text-2xl font-semibold text-rose-900">{summary.blocked}</p>
          </div>
        </section>

        <section className="mb-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-[#CBD5E1] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Required Strands
            </p>
            <p className="mt-1 text-2xl font-semibold">{summary.totalStrands}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Strand Ready
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">
              {summary.readyStrands}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Strand Thin
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">{summary.thinStrands}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              Strand Gaps
            </p>
            <p className="mt-1 text-2xl font-semibold text-rose-900">
              {summary.blockedStrands}
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                Standard Inspector
              </p>
              <h2 className="mt-1 text-xl font-semibold">Check one standard at a time</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
                Pick a benchmark to narrow the pipeline, promoted items, required strands, and
                action buttons to only that standard.
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Benchmark
              </span>
              <select
                value={selectedStandardCode}
                onChange={(event) => setSelectedStandardCode(event.target.value)}
                className="min-w-[320px] rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              >
                <option value="all">All standards</option>
                {coverageRows.map((row) => (
                  <option key={row.demand.standardCode} value={row.demand.standardCode}>
                    {row.demand.standardCode} · {row.demand.teacherTitle}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {coverageRows.map((row) => (
              <button
                key={row.demand.standardCode}
                type="button"
                onClick={() => setSelectedStandardCode(row.demand.standardCode)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                  selectedStandardCode === row.demand.standardCode
                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                    : row.analysis.status === 'ready'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : row.analysis.status === 'thin'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {row.demand.standardCode}
              </button>
            ))}
            {selectedStandardCode !== 'all' ? (
              <button
                type="button"
                onClick={() => setSelectedStandardCode('all')}
                className="rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#334155]"
              >
                Show all
              </button>
            ) : null}
          </div>
          {selectedCoverageRow ? (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Status</p>
                <p className="mt-1 font-semibold">{statusLabel(selectedCoverageRow.analysis.status)}</p>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Quality reps</p>
                <p className="mt-1 font-semibold">
                  {selectedCoverageRow.analysis.viableRows}/{selectedCoverageRow.analysis.approvedRows}
                </p>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Passages</p>
                <p className="mt-1 font-semibold">{selectedCoverageRow.analysis.distinctPassages}</p>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Fresh sessions</p>
                <p className="mt-1 font-semibold">
                  {selectedCoverageRow.analysis.estimatedFreshSessions}/
                  {selectedCoverageRow.analysis.pilotDepthTarget}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                Trusted Content Foundry
              </p>
              <h2 className="mt-1 text-xl font-semibold">Promote real literature first</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
                Approved Gutenberg passages are real public-domain literature. Promote those into
                Reading Win rows first, then use original generated content only to fill remaining
                gaps.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                disabled={promotingGutenberg}
                onClick={promoteApprovedGutenberg}
                className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
              >
                {promotingGutenberg ? 'Promoting...' : 'Promote Approved Gutenberg'}
              </button>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Target per standard
                </span>
                <input
                  type="number"
                  min={6}
                  max={60}
                  value={targetPerStandard}
                  disabled={buildingLibrary}
                  onChange={(event) => setTargetPerStandard(Number(event.target.value))}
                  className="w-32 rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={buildingLibrary}
                onClick={buildPilotLibrary}
                className="rounded-md bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
              >
                {buildingLibrary ? 'Building library...' : 'Build Pilot Library'}
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm leading-6 text-[#475569]">
            <span className="font-semibold text-[#0F172A]">Pilot readiness:</span> {summary.ready}/
            {summary.total} standards are assignable today. The board lists blocked standards first
            so the next build action is obvious. “Needs first content set” means no approved Reading
            Win items exist yet for that standard. “Gutenberg” source counts mean the set is built
            from approved public-domain literature. Pilot depth means at least four estimated fresh
            sessions for the same standard. Strand readiness shows whether each required subskill
            inside the standard has its own FAST-style content, not just whether the broad band has
            any questions.
          </div>
        </section>

        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                Gutenberg Pipeline
              </p>
              <h2 className="mt-1 text-xl font-semibold">Real literature intake</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
                This is the trusted path: pipeline harvests public-domain excerpts, review approves
                them, then promotion turns them into FAST-aligned Reading Win sets.
              </p>
            </div>
            <div className="grid min-w-[420px] grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Pending</p>
                <p className="mt-1 text-xl font-semibold">
                  {gutenbergTotals?.pending_review_passages ?? 0}
                </p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Approved</p>
                <p className="mt-1 text-xl font-semibold text-emerald-900">
                  {gutenbergTotals?.approved_passages ?? 0}
                </p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase text-blue-700">Unpromoted</p>
                <p className="mt-1 text-xl font-semibold text-blue-900">
                  {gutenbergTotals?.unpromoted_approved_passages ?? 0}
                </p>
              </div>
              <div className="rounded-md border border-[#CBD5E1] bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Rows</p>
                <p className="mt-1 text-xl font-semibold">
                  {gutenbergTotals?.promoted_question_rows ?? 0}
                </p>
              </div>
            </div>
          </div>

          {visibleGutenbergRows.length ? (
            <div className="mt-4 overflow-hidden rounded-md border border-[#E2E8F0]">
              <div className="grid grid-cols-[0.8fr_0.7fr_0.7fr_1.4fr] gap-3 bg-[#F8FAFC] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                <span>Standard</span>
                <span>Pipeline</span>
                <span>Promoted</span>
                <span>Examples</span>
              </div>
              <div className="divide-y divide-[#E2E8F0]">
                {visibleGutenbergRows.map((row) => (
                  <div
                    key={row.standard_code}
                    className="grid grid-cols-[0.8fr_0.7fr_0.7fr_1.4fr] gap-3 px-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{row.standard_code}</p>
                      <p className="mt-1 text-xs text-[#64748B]">{row.teacher_title}</p>
                    </div>
                    <div>
                      <p className="font-semibold">
                        {row.approved_passages} approved · {row.pending_review_passages} pending
                      </p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        {row.unpromoted_approved_passages} approved not promoted
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold">{row.promoted_question_rows}</p>
                      <p className="mt-1 text-xs text-[#64748B]">question rows</p>
                      <p className="mt-1 text-xs text-emerald-700">
                        {row.trusted_promoted_question_rows} trusted
                      </p>
                      {row.audit_promoted_question_rows > 0 ? (
                        <p className="mt-1 text-xs font-semibold text-amber-700">
                          {row.audit_promoted_question_rows} need audit
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs leading-5 text-[#64748B]">
                      {row.sample_titles.length ? row.sample_titles.join(' • ') : 'No examples yet'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#64748B]">
              No Gutenberg passage rows are visible yet. Run the pipeline, review passages, then
              promote approved passages into Reading Wins.
            </p>
          )}
        </section>

        {error ? (
          <p className="mb-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-[#CBD5E1] bg-white shadow-sm">
          <div className="grid grid-cols-[1.1fr_0.55fr_0.55fr_0.55fr_0.65fr_0.85fr_1.2fr] gap-3 border-b border-[#E2E8F0] bg-[#F1F5F9] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            <span>Standard</span>
            <span>Status</span>
            <span>Quality reps</span>
            <span>Passages</span>
            <span>Fresh sessions</span>
            <span>Sources</span>
            <span>Next action</span>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-[#64748B]">Loading Reading Win coverage...</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {sortedCoverageRows.map((row) => (
                <div
                  key={row.demand.id}
                  className="grid grid-cols-[1.1fr_0.55fr_0.55fr_0.55fr_0.65fr_0.85fr_1.2fr] gap-3 px-4 py-4 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[#0F172A]">{row.demand.standardCode}</p>
                    <p className="mt-1 leading-5 text-[#475569]">{row.demand.teacherTitle}</p>
                    <p className="mt-1 text-xs leading-5 text-[#64748B]">
                      Student: {row.demand.studentTitle}
                    </p>
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses(
                        row.analysis.status
                      )}`}
                    >
                      {statusIcon(row.analysis.status)}
                      {statusLabel(row.analysis.status)}
                    </span>
                  </div>

                  <div>
                    <p className="font-semibold">
                      {row.analysis.viableRows}/{row.analysis.approvedRows}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">pass gate / approved</p>
                  </div>

                  <div>
                    <p className="font-semibold">{row.analysis.distinctPassages}</p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {row.analysis.distinctPassages >= 2 ? 'transfer-ready' : 'needs transfer'}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold">
                      {row.analysis.estimatedFreshSessions}/{row.analysis.pilotDepthTarget}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {row.analysis.depthStatus === 'pilot_depth'
                        ? 'pilot depth'
                        : row.analysis.depthStatus === 'pilot_sequence'
                          ? 'sequence'
                          : row.analysis.depthStatus === 'one_session'
                            ? 'one day'
                            : 'none'}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold">
                      {row.analysis.gutenbergRows} Gutenberg · {row.analysis.originalRows} original
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {row.analysis.releasedRows} released ·{' '}
                      {row.analysis.session?.passageTitle ?? 'No session yet'}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-[#0F172A]">{nextAction(row)}</p>
                    {rowGuidance(row) ? (
                      <p className="mt-1 text-xs leading-5 text-[#64748B]">{rowGuidance(row)}</p>
                    ) : null}
                    {row.strandCoverage.length ? (
                      <div className="mt-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Required strand coverage
                        </p>
                        <div className="mt-2 space-y-2">
                          {row.strandCoverage.map((strand) => (
                            <div
                              key={strand.id}
                              className="rounded-md border border-[#E2E8F0] bg-white p-2"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-[#0F172A]">
                                    {strand.label}
                                  </p>
                                  <p className="mt-1 text-[11px] leading-4 text-[#64748B]">
                                    {strand.studentCanDo}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClasses(
                                    strand.status
                                  )}`}
                                >
                                  {statusLabel(strand.status)}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
                                <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1 py-1">
                                  <span className="font-semibold">{strand.qualityRows}</span> reps
                                </div>
                                <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1 py-1">
                                  <span className="font-semibold">{strand.distinctPassages}</span>{' '}
                                  texts
                                </div>
                                <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1 py-1">
                                  <span className="font-semibold">
                                    {strand.estimatedFreshSessions}
                                  </span>{' '}
                                  sessions
                                </div>
                                <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1 py-1">
                                  <span className="font-semibold">
                                    {strand.sourceCounts.gutenberg}
                                  </span>{' '}
                                  lit
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                        No strand blueprint is defined for this band yet, so GOGI cannot certify
                        subskill coverage.
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          row.analysis.ready || generatingStandard === row.demand.standardCode
                        }
                        onClick={() => generateMissing(row)}
                        className="rounded-md bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                      >
                        {generatingStandard === row.demand.standardCode
                          ? 'Building...'
                          : row.analysis.ready
                            ? 'Pilot ready'
                            : 'Auto-build set'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/admin/gutenberg-library?standard=${encodeURIComponent(row.demand.standardCode)}&status=all&tab=passages`
                          )
                        }
                        className="rounded-md border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#334155]"
                      >
                        View passages
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/admin/gutenberg-library?standard=${encodeURIComponent(row.demand.standardCode)}&status=all&tab=promoted`
                          )
                        }
                        className="rounded-md border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#334155]"
                      >
                        Audit items
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/admin/original-items?benchmark=${encodeURIComponent(row.demand.standardCode)}`
                          )
                        }
                        className="rounded-md border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#334155]"
                      >
                        Original bank
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/standard/${row.demand.standardCode.replace(/\./g, '-')}/intervention?preview=1&demoNav=1`
                          )
                        }
                        className="rounded-md bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
