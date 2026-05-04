'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { createClient } from '@/lib/supabase/client';
import { RELEASED_BOOKLET_GRADES } from '@/lib/released-items/constants';

type BookletRow = {
  id: string;
  booklet_name: string;
  grade: number;
  release_year: number;
  raw_pdf_path: string;
  extraction_status: string;
  total_items_expected: number | null;
  total_items_extracted: number;
  total_items_promoted: number;
  uploaded_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ReleasedItemsAdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [booklets, setBooklets] = useState<BookletRow[]>([]);
  const [bookletName, setBookletName] = useState('2025 Grade 9 FAST ELA Reading');
  const [grade, setGrade] = useState(9);
  const [releaseYear, setReleaseYear] = useState(2025);
  const [sourceUrl, setSourceUrl] = useState('');
  const [totalItemsExpected, setTotalItemsExpected] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadBooklets() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error: loadError } = await supabase
      .from('released_test_booklets')
      .select(
        'id, booklet_name, grade, release_year, raw_pdf_path, extraction_status, total_items_expected, total_items_extracted, total_items_promoted, uploaded_at'
      )
      .order('uploaded_at', { ascending: false })
      .limit(20);

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setBooklets((data ?? []) as BookletRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadBooklets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadBooklet(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!file) {
      setError('Choose a released FAST booklet PDF first.');
      return;
    }

    const form = new FormData();
    form.set('booklet_name', bookletName);
    form.set('grade', String(grade));
    form.set('release_year', String(releaseYear));
    form.set('source_url', sourceUrl);
    form.set('total_items_expected', totalItemsExpected);
    form.set('file', file);

    setUploading(true);
    const response = await fetch('/api/released-items/booklet/upload', {
      method: 'POST',
      body: form,
    });
    const body = (await response.json()) as { error?: string; booklet?: BookletRow };
    setUploading(false);

    if (!response.ok || !body.booklet) {
      setError(body.error ?? 'Could not upload booklet.');
      return;
    }

    setMessage(`${body.booklet.booklet_name} is staged for extraction.`);
    setFile(null);
    await loadBooklets();
  }

  async function runExtraction(booklet: BookletRow) {
    setError(null);
    setMessage(null);
    setExtractingId(booklet.id);

    const response = await fetch(`/api/released-items/booklet/${booklet.id}/extract`, {
      method: 'POST',
    });
    const body = (await response.json()) as {
      error?: string;
      passage_count?: number;
      item_count?: number;
    };
    setExtractingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not extract booklet.');
      await loadBooklets();
      return;
    }

    setMessage(
      `${booklet.booklet_name} extracted ${body.passage_count ?? 0} passages and ${body.item_count ?? 0} items.`
    );
    await loadBooklets();
  }

  async function runClassification(booklet: BookletRow) {
    setError(null);
    setMessage(null);
    setClassifyingId(booklet.id);

    const response = await fetch(`/api/released-items/booklet/${booklet.id}/classify`, {
      method: 'POST',
    });
    const body = (await response.json()) as {
      error?: string;
      item_count?: number;
      classification_count?: number;
      review_count?: number;
    };
    setClassifyingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not classify released items.');
      await loadBooklets();
      return;
    }

    setMessage(
      `${booklet.booklet_name} classified ${body.item_count ?? 0} items, created ${body.classification_count ?? 0} signals, and queued ${body.review_count ?? 0} items for review.`
    );
    await loadBooklets();
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TeacherDashboardTopBar active="released" />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
            Released Item Classifier
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Released FAST Booklets</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
            Stage Florida released FAST ELA Reading PDFs here. This first slice stores the booklet
            safely and creates the database row the extraction pipeline will use next.
          </p>
        </div>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={uploadBooklet}
            className="rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-[#2563EB]" />
              <h2 className="text-lg font-semibold">Upload Booklet PDF</h2>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold">Booklet name</span>
              <input
                value={bookletName}
                onChange={(event) => setBookletName(event.target.value)}
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Grade</span>
                <select
                  value={grade}
                  onChange={(event) => setGrade(Number(event.target.value))}
                  className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
                >
                  {RELEASED_BOOKLET_GRADES.map((value) => (
                    <option key={value} value={value}>
                      Grade {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Release year</span>
                <input
                  type="number"
                  value={releaseYear}
                  onChange={(event) => setReleaseYear(Number(event.target.value))}
                  className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-semibold">Expected items</span>
              <input
                type="number"
                value={totalItemsExpected}
                onChange={(event) => setTotalItemsExpected(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-semibold">Source URL</span>
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-semibold">PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </label>

            {error ? (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={uploading}
              className="mt-4 rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {uploading ? 'Uploading...' : 'Stage booklet'}
            </button>
          </form>

          <section className="rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Staged Booklets</h2>
            {loading ? (
              <p className="text-sm text-[#64748B]">Loading booklets...</p>
            ) : booklets.length ? (
              <div className="space-y-3">
                {booklets.map((booklet) => (
                  <div key={booklet.id} className="rounded-md border border-[#E2E8F0] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{booklet.booklet_name}</p>
                        <p className="mt-1 text-sm text-[#64748B]">
                          Grade {booklet.grade} · {booklet.release_year} ·{' '}
                          {formatDate(booklet.uploaded_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#EFF6FF] px-2 py-1 text-xs font-semibold text-[#2563EB]">
                        {booklet.extraction_status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[#64748B] sm:grid-cols-3">
                      <span>Expected: {booklet.total_items_expected ?? '—'}</span>
                      <span>Extracted: {booklet.total_items_extracted}</span>
                      <span>Promoted: {booklet.total_items_promoted}</span>
                    </div>
                    {['pending', 'extraction_failed'].includes(booklet.extraction_status) ? (
                      <button
                        type="button"
                        onClick={() => runExtraction(booklet)}
                        disabled={extractingId === booklet.id}
                        className="mt-3 rounded-md bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {extractingId === booklet.id ? 'Extracting...' : 'Run extraction'}
                      </button>
                    ) : null}
                    {booklet.extraction_status === 'extracted' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => runClassification(booklet)}
                          disabled={classifyingId === booklet.id}
                          className="rounded-md bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {classifyingId === booklet.id ? 'Classifying...' : 'Classify items'}
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/released-items/${booklet.id}/review`)}
                          className="rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A]"
                        >
                          Review queue
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#64748B]">No released FAST booklets staged yet.</p>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
