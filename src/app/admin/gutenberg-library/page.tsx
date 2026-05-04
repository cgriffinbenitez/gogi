'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, RefreshCw, Send, XCircle } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { FAST_GRADE9_READING_DEMANDS } from '@/lib/reading-wins/fastSkillMap';
import { getGutenbergStandardBlueprint } from '@/pipeline/standardBlueprints';

type PromotedQuestion = {
  id: string;
  title: string | null;
  option_a_text: string | null;
  option_b_text: string | null;
  option_c_text: string | null;
  option_d_text: string | null;
  correct_option: string | null;
  rationale: string | null;
  difficulty_level: number | null;
};

type GutenbergPassageRow = {
  id: string;
  classification: string;
  standard_code: string | null;
  paragraph_text: string;
  word_count: number;
  source_title: string | null;
  source_author: string | null;
  source_year: number | null;
  intervention_tier: number | null;
  target_signal: string | null;
  supporting_evidence: Array<{ element: string; rationale: string }> | null;
  non_supporting_evidence: Array<{ element: string; rationale: string }> | null;
  approval_status: string | null;
  approved: boolean | null;
  rejection_reason: string | null;
  promoted_question_count: number;
  promoted_questions: PromotedQuestion[];
};

type HarvestStatus = {
  file: string;
  log_path: string;
  modified_at: string;
  status: 'starting' | 'fetching' | 'filtering' | 'writing' | 'complete' | 'failed' | 'quiet';
  tail: string[];
};

type HarvestIntelligence = {
  totals: {
    candidates_seen: number;
    suitable: number;
    rejected: number;
    write_errors: number;
    inserted: number;
  };
  books: Array<{
    title: string;
    author: string;
    total: number;
    suitable: number;
    rejected: number;
    errors: number;
    yield_rate: number;
    recommendation: string;
  }>;
  rejection_buckets: Array<{ label: string; count: number }>;
  recommendations: string[];
};

function displayStatus(row: GutenbergPassageRow) {
  if (row.approval_status === 'approved' || row.approved) return 'approved';
  if (row.approval_status === 'rejected') return 'rejected';
  return 'pending_review';
}

function statusClasses(status: string) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function sourceLabel(row: GutenbergPassageRow) {
  const title = row.source_title?.trim() || 'Public domain passage';
  const author = row.source_author?.trim();
  const year = row.source_year ? ` (${row.source_year})` : '';
  return author ? `${title} — ${author}${year}` : `${title}${year}`;
}

function truncate(value: string, max = 560) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
}

export default function GutenbergLibraryPage() {
  const [standardCode, setStandardCode] = useState('ELA.9.R.3.1');
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState<GutenbergPassageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [harvestStatus, setHarvestStatus] = useState<HarvestStatus | null>(null);
  const [harvestIntelligence, setHarvestIntelligence] = useState<HarvestIntelligence | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDemand = FAST_GRADE9_READING_DEMANDS.find(
    (demand) => demand.standardCode === standardCode
  );
  const selectedBlueprint = getGutenbergStandardBlueprint(standardCode);

  const counts = useMemo(() => {
    return rows.reduce(
      (map, row) => {
        const next = displayStatus(row);
        map[next] += 1;
        if (row.promoted_question_count > 0) map.promoted += 1;
        return map;
      },
      { approved: 0, pending_review: 0, rejected: 0, promoted: 0 }
    );
  }, [rows]);

  async function loadRows() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      standard_code: standardCode,
      status,
      limit: '120',
    });
    const response = await fetch(`/api/reading-wins/gutenberg/passages?${params.toString()}`);
    const body = (await response.json()) as { rows?: GutenbergPassageRow[]; error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(body.error ?? 'Could not load Gutenberg passages.');
      setRows([]);
      return;
    }

    setRows(body.rows ?? []);
  }

  async function loadHarvestStatus() {
    const params = new URLSearchParams({ standard_code: standardCode });
    const response = await fetch(
      `/api/reading-wins/gutenberg/standard-harvest/status?${params.toString()}`
    );
    const body = (await response.json().catch(() => ({}))) as {
      latest?: HarvestStatus | null;
    };
    if (response.ok) setHarvestStatus(body.latest ?? null);
  }

  async function loadHarvestIntelligence() {
    const params = new URLSearchParams({ standard_code: standardCode });
    const response = await fetch(
      `/api/reading-wins/gutenberg/standard-harvest/intelligence?${params.toString()}`
    );
    const body = (await response.json().catch(() => ({}))) as {
      intelligence?: HarvestIntelligence | null;
    };
    if (response.ok) setHarvestIntelligence(body.intelligence ?? null);
  }

  async function updatePassage(passageId: string, nextStatus: 'approved' | 'rejected') {
    setWorkingId(passageId);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/reading-wins/gutenberg/passages/${passageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not update passage.');
      return;
    }

    setMessage(
      nextStatus === 'approved'
        ? 'Passage approved. It moved to Approved; click Promote set to generate Reading Win questions.'
        : 'Passage rejected.'
    );
    if (nextStatus === 'approved' && status === 'pending') {
      setStatus('approved');
      return;
    }
    if (nextStatus === 'rejected' && status === 'pending') {
      setStatus('rejected');
      return;
    }
    await loadRows();
  }

  async function promotePassage(passageId: string) {
    setWorkingId(passageId);
    setError(null);
    setMessage(null);
    const response = await fetch('/api/reading-wins/gutenberg/promote-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passage_ids: [passageId], standard_code: standardCode }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      promoted_count?: number;
    };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not promote passage.');
      return;
    }

    setMessage(body.message ?? `Promoted ${body.promoted_count ?? 0} question rows.`);
    await loadRows();
  }

  async function startStandardHarvest() {
    setHarvesting(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/reading-wins/gutenberg/standard-harvest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        standard_code: standardCode,
        max: 12,
        max_books: 5,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      log_path?: string;
      classifications?: string[];
      coverage_strands?: Array<{ label: string }>;
    };
    setHarvesting(false);

    if (!response.ok) {
      setError(body.error ?? 'Could not start standard harvest.');
      return;
    }

    setMessage(
      [
        body.message ?? `${standardCode} harvest started.`,
        body.coverage_strands?.length
          ? `Strand-focused runs: ${body.coverage_strands.map((item) => item.label).join(', ')}.`
          : body.classifications?.length
            ? `Running: ${body.classifications.map((item) => item.replace(/_/g, ' ')).join(', ')}.`
            : null,
        body.log_path ? `Log: ${body.log_path}` : null,
      ]
        .filter(Boolean)
        .join(' ')
    );
    await loadHarvestStatus();
    await loadHarvestIntelligence();
  }

  useEffect(() => {
    loadRows();
    loadHarvestStatus();
    loadHarvestIntelligence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardCode, status]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TeacherDashboardTopBar active="gutenberg" />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
              Gutenberg Library
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Public Domain Content Workbench</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
              Choose a FAST standard, inspect real literature passages from the pipeline, approve
              the strongest excerpts, and promote them into Reading Win question sets.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRows}
            className="inline-flex items-center gap-2 rounded-md bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Pipeline logic
              </p>
              <h2 className="mt-1 text-xl font-semibold">The trusted content path</h2>
              <div className="mt-3 grid gap-2 text-sm text-[#475569] md:grid-cols-4">
                {[
                  'Run Gutenberg pipeline',
                  'Approve curated passages',
                  'Promote to Reading Wins',
                  'Assign only ready standards',
                ].map((step, index) => (
                  <div key={step} className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-xs font-semibold uppercase text-[#2563EB]">
                      Step {index + 1}
                    </p>
                    <p className="mt-1 font-semibold text-[#0F172A]">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                Run outside the browser for now
              </p>
              <p className="mt-2 text-sm leading-6 text-[#1E3A8A]">
                The app manages the standard plan, review, and promotion. The harvest runs as a
                controlled background job so Claude/Gutendex work does not freeze the demo UI.
              </p>
              <code className="mt-3 block rounded-md bg-white p-3 text-xs text-[#0F172A]">
                {selectedBlueprint?.recommendedCommand ??
                  'npm run pipeline:standard -- --standard ELA.9.R.3.1 --max-books 5 --max 12'}
              </code>
              <button
                type="button"
                disabled={harvesting}
                onClick={startStandardHarvest}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:bg-[#94A3B8]"
              >
                <Send className="h-4 w-4" />
                {harvesting ? 'Starting harvest...' : 'Start standard harvest'}
              </button>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                FAST standard
              </span>
              <select
                value={standardCode}
                onChange={(event) => setStandardCode(event.target.value)}
                className="min-w-[280px] rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              >
                {FAST_GRADE9_READING_DEMANDS.map((demand) => (
                  <option key={demand.standardCode} value={demand.standardCode}>
                    {demand.standardCode} · {demand.teacherTitle}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Passage status
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <div className="ml-auto grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-amber-700">Pending</p>
                <p className="font-semibold">{counts.pending_review}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-emerald-700">Approved</p>
                <p className="font-semibold">{counts.approved}</p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-blue-700">Promoted</p>
                <p className="font-semibold">{counts.promoted}</p>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-rose-700">Rejected</p>
                <p className="font-semibold">{counts.rejected}</p>
              </div>
            </div>
          </div>
          {selectedDemand ? (
            <p className="mt-3 rounded-md bg-[#F8FAFC] p-3 text-sm leading-6 text-[#475569]">
              <span className="font-semibold text-[#0F172A]">{selectedDemand.studentTitle}:</span>{' '}
              {selectedDemand.fastDemand}
            </p>
          ) : null}
          {selectedBlueprint ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] p-3">
                <p className="text-xs font-semibold uppercase text-[#2563EB]">
                  Standard-first harvest
                </p>
                <p className="mt-2 text-sm leading-6 text-[#1E3A8A]">
                  {selectedBlueprint.harvestGoal}
                </p>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">
                  Fallback harvest lenses
                </p>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  These are broad internal lenses. Strand cards below narrow the actual harvest.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedBlueprint.classifications.map((classification) => (
                    <span
                      key={classification}
                      className="rounded-full border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#334155]"
                    >
                      {classification.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Trust gate</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Approve only excerpts with clear evidence, teachable 9th-grade access, and no
                  whole-book or schema-gated dependency.
                </p>
              </div>
            </div>
          ) : null}
          {selectedBlueprint?.coverageStrands?.length ? (
            <div className="mt-3 rounded-md border border-[#CBD5E1] bg-white p-3">
              <p className="text-xs font-semibold uppercase text-[#64748B]">
                Standard coverage strands
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedBlueprint.coverageStrands.map((strand) => (
                  <div
                    key={strand.id}
                    className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                  >
                    <p className="text-sm font-semibold text-[#0F172A]">{strand.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#475569]">{strand.studentCanDo}</p>
                    <p className="mt-3 text-[11px] font-semibold uppercase text-[#64748B]">
                      Strand harvest lenses
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(strand.classifications ?? selectedBlueprint.classifications).map(
                        (classification) => (
                          <span
                            key={classification}
                            className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-[11px] font-semibold text-[#1D4ED8]"
                          >
                            {classification.replace(/_/g, ' ')}
                          </span>
                        )
                      )}
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase text-[#64748B]">
                      Harvest signals
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {strand.harvestSignals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-[#CBD5E1] bg-white px-2 py-1 text-[11px] font-semibold text-[#334155]"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {selectedBlueprint ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Must have</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-[#475569]">
                  {selectedBlueprint.passageRequirements.map((requirement) => (
                    <li key={requirement}>- {requirement}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-semibold uppercase text-rose-700">Reject if</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-rose-900">
                  {selectedBlueprint.rejectIf.map((rule) => (
                    <li key={rule}>- {rule}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
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

        {harvestStatus ? (
          <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Latest harvest status
                </p>
                <h2 className="mt-1 text-lg font-semibold capitalize">
                  {harvestStatus.status === 'quiet'
                    ? 'No recent log activity'
                    : harvestStatus.status}
                </h2>
                <p className="mt-1 text-xs text-[#64748B]">
                  Updated {new Date(harvestStatus.modified_at).toLocaleString()} ·{' '}
                  {harvestStatus.log_path}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  loadHarvestStatus();
                  loadHarvestIntelligence();
                  loadRows();
                }}
                className="inline-flex items-center gap-2 rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#334155]"
              >
                <RefreshCw className="h-4 w-4" />
                Check now
              </button>
            </div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-[#0F172A] p-3 text-xs leading-5 text-[#E2E8F0]">
              {harvestStatus.tail.join('\n')}
            </pre>
          </section>
        ) : null}

        {harvestIntelligence ? (
          <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Harvest intelligence
                </p>
                <h2 className="mt-1 text-lg font-semibold">Source yield and failure patterns</h2>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {[
                  ['Seen', harvestIntelligence.totals.candidates_seen],
                  ['Suitable', harvestIntelligence.totals.suitable],
                  ['Rejected', harvestIntelligence.totals.rejected],
                  ['Inserted', harvestIntelligence.totals.inserted],
                  ['Errors', harvestIntelligence.totals.write_errors],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                  >
                    <p className="font-semibold text-[#64748B]">{label}</p>
                    <p className="mt-1 text-base font-semibold text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {harvestIntelligence.recommendations.length ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase text-amber-700">Recommendations</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
                  {harvestIntelligence.recommendations.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Book yield</p>
                <div className="mt-2 space-y-2">
                  {harvestIntelligence.books.slice(0, 6).map((book) => (
                    <div
                      key={book.title}
                      className="rounded-md border border-[#E2E8F0] bg-white p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{book.title}</p>
                          <p className="text-xs text-[#64748B]">{book.author}</p>
                        </div>
                        <p className="rounded-full border border-[#CBD5E1] px-2 py-1 text-xs font-semibold">
                          {(book.yield_rate * 100).toFixed(1)}% yield
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#475569]">
                        {book.suitable}/{book.total} suitable · {book.errors} write errors ·{' '}
                        {book.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Rejection patterns</p>
                <div className="mt-2 space-y-2">
                  {harvestIntelligence.rejection_buckets.map((bucket) => (
                    <div
                      key={bucket.label}
                      className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-white p-3 text-sm"
                    >
                      <span className="font-semibold capitalize text-[#334155]">
                        {bucket.label}
                      </span>
                      <span className="font-semibold text-[#0F172A]">{bucket.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {loading ? (
          <p className="rounded-lg border border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
            Loading Gutenberg passages...
          </p>
        ) : rows.length ? (
          <div className="grid gap-4">
            {rows.map((row) => {
              const rowStatus = displayStatus(row);
              const approved = rowStatus === 'approved';
              const promoted = row.promoted_question_count > 0;
              return (
                <article
                  key={row.id}
                  className="rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses(
                            rowStatus
                          )}`}
                        >
                          {rowStatus.replace('_', ' ')}
                        </span>
                        <span className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-xs font-semibold text-[#2563EB]">
                          {row.classification.replace(/_/g, ' ')}
                        </span>
                        <span className="rounded-full border border-[#E2E8F0] px-2 py-1 text-xs font-semibold text-[#64748B]">
                          Tier {row.intervention_tier ?? '?'} · {row.word_count} words
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold">{sourceLabel(row)}</h2>
                      <p className="mt-1 text-sm text-[#64748B]">
                        Target signal: {row.target_signal ?? 'not tagged'} · Feeds{' '}
                        {row.standard_code ?? 'unmapped'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rowStatus !== 'approved' ? (
                        <button
                          type="button"
                          disabled={workingId === row.id}
                          onClick={() => updatePassage(row.id, 'approved')}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-[#94A3B8]"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </button>
                      ) : null}
                      {rowStatus !== 'rejected' ? (
                        <button
                          type="button"
                          disabled={workingId === row.id}
                          onClick={() => updatePassage(row.id, 'rejected')}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:text-[#94A3B8]"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!approved || promoted || workingId === row.id}
                        onClick={() => promotePassage(row.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                      >
                        <Send className="h-4 w-4" />
                        {promoted ? 'Promoted' : 'Promote set'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        <BookOpenCheck className="h-4 w-4" />
                        Passage
                      </p>
                      <p className="whitespace-pre-line text-sm leading-7 text-[#334155]">
                        {truncate(row.paragraph_text)}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-semibold uppercase text-emerald-700">
                          Supporting evidence
                        </p>
                        {(row.supporting_evidence ?? []).slice(0, 3).map((item) => (
                          <p key={item.element} className="mt-2 text-xs leading-5 text-emerald-900">
                            “{item.element}” · {item.rationale}
                          </p>
                        ))}
                      </div>
                      <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                        <p className="text-xs font-semibold uppercase text-[#64748B]">
                          Promoted questions
                        </p>
                        {row.promoted_questions.length ? (
                          <div className="mt-2 space-y-2">
                            {row.promoted_questions.slice(0, 5).map((question) => (
                              <div
                                key={question.id}
                                className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-2 text-xs leading-5"
                              >
                                <p className="font-semibold text-[#0F172A]">
                                  Correct: {question.correct_option} · Difficulty{' '}
                                  {question.difficulty_level ?? '?'}
                                </p>
                                <p className="text-[#64748B]">
                                  A. {question.option_a_text} B. {question.option_b_text}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs leading-5 text-[#64748B]">
                            No generated Reading Win questions yet. Approve and promote this passage
                            to create the set.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
            No Gutenberg passages found for this standard/status yet. Run the batch pipeline for a
            mapped classification, then return here to curate.
          </p>
        )}
      </div>
    </main>
  );
}
