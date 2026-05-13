'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';

type CoverageBoard = {
  standardCode: 'ELA.9.R.1.1';
  title: string;
  totalStrong: number;
  targetStrong: number;
  items: Array<{
    strandId: string;
    label: string;
    studentMove: string;
    minimumPullOuts: number;
    strongCount: number;
    emergingCount: number;
    status: 'ready' | 'building' | 'needed';
    bestPullOut: {
      selection: string;
      exactLinesOrParagraphs: string;
      excerpt: string;
      teacherTrust: { confidence: 'strong' | 'emerging' | 'weak'; evidencePoints: string[] };
      anchorQuestion: { stem: string };
    } | null;
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
  return 'Needed';
}

function compact(value: string, max = 300) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

export default function R11CoveragePage() {
  const router = useRouter();
  const [board, setBoard] = useState<CoverageBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBoard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/teacher/r11-coverage');
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not load coverage.');
      setBoard(json.board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load coverage.');
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.dark, fontFamily: FONTS.ui }}>
      <TeacherDashboardTopBar active="r11" />
      <main style={{ maxWidth: 1220, margin: '0 auto', padding: '28px 20px 56px' }}>
        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ color: C.gray, fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
                R.1.1 MINI-CURRICULUM
              </div>
              <h1 style={{ color: C.dark, fontSize: 34, lineHeight: 1.1, margin: '8px 0' }}>
                ELA.9.R.1.1 Coverage Board
              </h1>
              <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.55, margin: 0, maxWidth: 760 }}>
                Track the sub-skills inside R.1.1 so the band stays organized: setting, plot,
                conflict, characterization, point of view, tone/theme, and style.
              </p>
            </div>
            <button
              type="button"
              onClick={loadBoard}
              style={{
                alignItems: 'center',
                alignSelf: 'start',
                background: C.blue,
                border: 'none',
                borderRadius: 6,
                color: C.white,
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
          </div>

          {board ? (
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
                <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Target per sub-skill</div>
                <div style={{ color: C.dark, fontSize: 28, fontWeight: 900 }}>5</div>
              </div>
              <div>
                <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Use case</div>
                <div style={{ color: C.dark, fontSize: 18, fontWeight: 900, marginTop: 5 }}>
                  Promethean pull-outs
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            marginTop: 16,
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ alignItems: 'center', color: C.gray, display: 'flex', gap: 10, padding: 24 }}>
              <Loader2 size={18} className="animate-spin" />
              Checking R.1.1 sub-skill coverage...
            </div>
          ) : error ? (
            <div style={{ color: C.red, fontWeight: 800, padding: 24 }}>{error}</div>
          ) : board ? (
            <div style={{ display: 'grid', gap: 12, padding: 16 }}>
              {board.items.map((item) => (
                <article
                  key={item.strandId}
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    display: 'grid',
                    gap: 12,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: statusColor(item.status),
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 0.8,
                          textTransform: 'uppercase',
                        }}
                      >
                        {statusLabel(item.status)} · {item.strongCount}/{item.minimumPullOuts} strong
                        {item.emergingCount ? ` · ${item.emergingCount} emerging` : ''}
                      </div>
                      <h2 style={{ color: C.dark, fontSize: 20, margin: '4px 0 3px' }}>
                        {item.label}
                      </h2>
                      <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                        {item.studentMove}
                      </p>
                      <p style={{ color: C.gray, fontSize: 12, lineHeight: 1.45, margin: '6px 0 0' }}>
                        Goal: collect 5 strong Promethean-ready pull-outs for this exact skill.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/teacher-dashboard/pull-out-sheets?standard=ELA.9.R.1.1&subSkill=${item.strandId}&rows=5`
                          )
                        }
                        style={{
                          background: C.navy,
                          border: 'none',
                          borderRadius: 6,
                          color: C.white,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 900,
                          padding: '9px 12px',
                        }}
                      >
                        Inspect 5 Candidates
                      </button>
                    </div>
                  </div>

                  {item.bestPullOut ? (
                    <div
                      style={{
                        background: '#FBFCFF',
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        display: 'grid',
                        gap: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ color: C.blue, fontSize: 12, fontWeight: 900 }}>
                        Best candidate to inspect: {item.bestPullOut.selection} ·{' '}
                        {item.bestPullOut.exactLinesOrParagraphs}
                      </div>
                      <p
                        style={{
                          color: C.dark,
                          fontFamily: FONTS.passage,
                          fontSize: 14,
                          lineHeight: 1.6,
                          margin: 0,
                        }}
                      >
                        {compact(item.bestPullOut.excerpt)}
                      </p>
                      <div style={{ color: C.dark, fontSize: 13, fontWeight: 800 }}>
                        {item.bestPullOut.anchorQuestion.stem}
                      </div>
                      <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.45 }}>
                        This is a teacher-inspection candidate, not an automatic student-ready item. Open it,
                        check the excerpt and answer choices, then keep or reject it.
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {item.bestPullOut.teacherTrust.evidencePoints.slice(0, 4).map((point) => (
                          <span
                            key={point}
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
                  ) : (
                    <div style={{ color: C.gray, fontSize: 13, lineHeight: 1.5 }}>
                      No pull-out candidate found yet. Source more text or generate candidates for this sub-skill.
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
