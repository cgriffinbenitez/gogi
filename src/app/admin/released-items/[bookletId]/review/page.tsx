'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { createClient } from '@/lib/supabase/client';

type PageProps = {
  params: Promise<{ bookletId: string }>;
};

type ClassificationRow = {
  classification_code: string;
  weight: number;
  confidence: number;
  rationale: string;
};

type ReviewRow = {
  id: string;
  status: string;
  review_notes: string | null;
  automated_classification_summary: Record<string, unknown>;
  released_items: {
    id: string;
    item_number: number;
    benchmark_code: string;
    reporting_category: string;
    item_type: string;
    prompt_text: string;
    options: Array<{ letter: string; text: string }>;
    correct_answer: string;
    released_item_classifications: ClassificationRow[];
    released_item_tiers: {
      tier: string;
      tier_rationale: string;
    } | null;
    released_item_roles: Array<{ role: string; priority: number }>;
  } | null;
};

type ReleasedItemReview = NonNullable<ReviewRow['released_items']>;
type ReleasedItemTier = NonNullable<ReleasedItemReview['released_item_tiers']>;

type RawReviewRow = Omit<ReviewRow, 'released_items'> & {
  released_items:
    | (Omit<ReleasedItemReview, 'released_item_tiers'> & {
        released_item_tiers: ReleasedItemTier | ReleasedItemTier[] | null;
      })
    | Array<
        Omit<ReleasedItemReview, 'released_item_tiers'> & {
          released_item_tiers: ReleasedItemTier | ReleasedItemTier[] | null;
        }
      >
    | null;
};

type BookletRow = {
  id: string;
  booklet_name: string;
  grade: number;
  release_year: number;
  total_items_extracted: number;
  total_items_promoted: number;
};

function formatPercent(value: number) {
  return `${Math.round(Number(value) * 100)}%`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function normalizeReviewRow(row: RawReviewRow): ReviewRow {
  const releasedItem = Array.isArray(row.released_items)
    ? row.released_items[0]
    : row.released_items;
  const tier = Array.isArray(releasedItem?.released_item_tiers)
    ? releasedItem.released_item_tiers[0]
    : releasedItem?.released_item_tiers;

  return {
    ...row,
    released_items: releasedItem ? { ...releasedItem, released_item_tiers: tier ?? null } : null,
  };
}

export default function ReleasedItemReviewPage({ params }: PageProps) {
  const { bookletId } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [booklet, setBooklet] = useState<BookletRow | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReviewQueue() {
    setLoading(true);
    setError(null);

    const { data: bookletData, error: bookletError } = await supabase
      .from('released_test_booklets')
      .select('id, booklet_name, grade, release_year, total_items_extracted, total_items_promoted')
      .eq('id', bookletId)
      .maybeSingle();

    if (bookletError) {
      setError(bookletError.message);
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from('released_item_review_queue')
      .select(
        'id, status, review_notes, automated_classification_summary, released_items(id, item_number, benchmark_code, reporting_category, item_type, prompt_text, options, correct_answer, released_item_classifications(classification_code, weight, confidence, rationale), released_item_tiers(tier, tier_rationale), released_item_roles(role, priority))'
      )
      .eq('released_items.booklet_id', bookletId)
      .order('created_at', { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setBooklet(bookletData as BookletRow | null);
    setRows(
      ((data ?? []) as unknown as RawReviewRow[])
        .map(normalizeReviewRow)
        .filter((row) => row.released_items)
    );
    setLoading(false);
  }

  useEffect(() => {
    loadReviewQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookletId]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const counts = useMemo(
    () =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {}),
    [rows]
  );

  async function updateStatus(row: ReviewRow, status: string) {
    setWorkingId(row.id);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/released-items/review/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = (await response.json()) as { error?: string };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not update review status.');
      return;
    }

    setMessage(`Item ${row.released_items?.item_number ?? ''} marked ${statusLabel(status)}.`);
    await loadReviewQueue();
  }

  async function promote(row: ReviewRow) {
    setWorkingId(row.id);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/released-items/review/${row.id}/promote`, {
      method: 'POST',
    });
    const body = (await response.json()) as { error?: string; already_promoted?: boolean };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not promote item.');
      return;
    }

    setMessage(
      body.already_promoted
        ? `Item ${row.released_items?.item_number ?? ''} was already promoted.`
        : `Item ${row.released_items?.item_number ?? ''} promoted to the question bank.`
    );
    await loadReviewQueue();
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TeacherDashboardTopBar active="released" />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <button
          type="button"
          onClick={() => router.push('/admin/released-items')}
          className="mb-4 text-sm font-semibold text-[#2563EB]"
        >
          Back to released booklets
        </button>

        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
            Released Item Review
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            {booklet?.booklet_name ?? 'Released FAST Booklet'}
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            Grade {booklet?.grade ?? '—'} · {booklet?.release_year ?? '—'} · Extracted{' '}
            {booklet?.total_items_extracted ?? 0} · Promoted {booklet?.total_items_promoted ?? 0}
          </p>
        </div>

        {error ? (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {['all', 'pending', 'approved', 'rejected', 'flagged_for_revision'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                statusFilter === status
                  ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                  : 'border-[#CBD5E1] bg-white text-[#334155]'
              }`}
            >
              {status === 'all'
                ? `All ${rows.length}`
                : `${statusLabel(status)} ${counts[status] ?? 0}`}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-[#64748B]">Loading review queue...</p>
        ) : filteredRows.length ? (
          <div className="space-y-4">
            {filteredRows.map((row) => {
              const item = row.released_items;
              if (!item) return null;
              const classifications = [...item.released_item_classifications].sort(
                (a, b) => Number(b.weight) - Number(a.weight)
              );

              return (
                <article
                  key={row.id}
                  className="rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Item {item.item_number} · {item.benchmark_code} · {item.reporting_category}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold">{item.prompt_text}</h2>
                    </div>
                    <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#2563EB]">
                      {statusLabel(row.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Answer choices
                      </p>
                      <div className="space-y-2">
                        {item.options.map((option) => (
                          <div
                            key={`${item.id}-${option.letter}-${option.text}`}
                            className={`rounded-md border p-3 text-sm ${
                              item.correct_answer.split(',').includes(option.letter)
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-[#E2E8F0] bg-[#F8FAFC]'
                            }`}
                          >
                            <span className="font-semibold">{option.letter}.</span> {option.text}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                          GOGI signal
                        </p>
                        <div className="mt-2 space-y-2">
                          {classifications.map((classification) => (
                            <div key={classification.classification_code}>
                              <div className="flex justify-between gap-3 text-sm">
                                <span className="font-semibold">
                                  {classification.classification_code.replace(/_/g, ' ')}
                                </span>
                                <span>
                                  {formatPercent(classification.weight)} ·{' '}
                                  {formatPercent(classification.confidence)}
                                </span>
                              </div>
                              <p className="text-xs leading-5 text-[#64748B]">
                                {classification.rationale}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div className="rounded-md border border-[#E2E8F0] p-3">
                          <p className="text-xs font-semibold uppercase text-[#64748B]">Tier</p>
                          <p className="font-semibold">
                            {item.released_item_tiers?.tier ?? 'Not tiered'}
                          </p>
                        </div>
                        <div className="rounded-md border border-[#E2E8F0] p-3">
                          <p className="text-xs font-semibold uppercase text-[#64748B]">Roles</p>
                          <p className="font-semibold">
                            {item.released_item_roles
                              .sort((a, b) => a.priority - b.priority)
                              .map((role) => role.role)
                              .join(', ') || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={workingId === row.id}
                      onClick={() => updateStatus(row, 'approved')}
                      className="rounded-md bg-[#16A34A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={workingId === row.id}
                      onClick={() => promote(row)}
                      className="rounded-md bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Promote
                    </button>
                    <button
                      type="button"
                      disabled={workingId === row.id}
                      onClick={() => updateStatus(row, 'flagged_for_revision')}
                      className="rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A] disabled:opacity-60"
                    >
                      Flag
                    </button>
                    <button
                      type="button"
                      disabled={workingId === row.id}
                      onClick={() => updateStatus(row, 'rejected')}
                      className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
            No review items found for this filter.
          </p>
        )}
      </div>
    </main>
  );
}
