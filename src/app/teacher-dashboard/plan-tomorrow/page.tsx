'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';
import { FAST_GRADE9_READING_DEMANDS } from '@/lib/reading-wins/fastSkillMap';

type PlanResponse = {
  ok: boolean;
  error?: string;
  standard?: {
    code: string;
    title: string;
    standardText: string;
    fastDemand: string;
    studentMove: string;
    itemShape: string;
  };
  recommendation?: {
    passage_id: string;
    text: string;
    source_title: string | null;
    source_author: string | null;
    excerpt: string;
    word_count: number | null;
    coverage_strand_label: string | null;
    target_signal: string | null;
    approval_status: string | null;
    confidence: 'ready' | 'teacher_skim' | 'needs_content';
    skill_focus: string;
    why_this_text: string[];
    tomorrow_flow: Array<{ label: string; minutes: number; move: string }>;
    cornell_notes: Array<{ cue: string; notes: string }>;
    exit_ticket: string;
  } | null;
  alternatives?: Array<{
    passage_id: string;
    text: string;
    coverage_strand_label: string | null;
    word_count: number | null;
    confidence: 'ready' | 'teacher_skim' | 'needs_content';
    excerpt: string;
  }>;
  empty_state?: string | null;
};

const standardOptions = FAST_GRADE9_READING_DEMANDS.map((demand) => ({
  code: demand.standardCode,
  title: demand.teacherTitle,
}));

function confidenceLabel(value: string | undefined) {
  if (value === 'ready') return 'Ready';
  if (value === 'teacher_skim') return 'Teacher skim';
  return 'Needs content';
}

function confidenceColor(value: string | undefined) {
  if (value === 'ready') return C.green;
  if (value === 'teacher_skim') return C.amber;
  return C.red;
}

function Chip({ children, color = C.blue }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        border: `1px solid ${color}`,
        borderRadius: 6,
        color,
        display: 'inline-flex',
        fontSize: 11,
        fontWeight: 800,
        padding: '4px 8px',
      }}
    >
      {children}
    </span>
  );
}

export default function PlanTomorrowPage() {
  const router = useRouter();
  const [standardCode, setStandardCode] = useState('ELA.9.R.1.1');
  const [minutes, setMinutes] = useState(90);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedStandard = useMemo(
    () => standardOptions.find((option) => option.code === standardCode),
    [standardCode]
  );

  async function loadPlan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/plan-tomorrow?standard_code=${encodeURIComponent(
          standardCode
        )}&minutes=${minutes}`
      );
      const json = (await res.json()) as PlanResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not build the plan.');
      setPlan(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the plan.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardCode, minutes]);

  const recommendation = plan?.recommendation ?? null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.light,
        color: C.dark,
        fontFamily: FONTS.ui,
      }}
    >
      <TeacherDashboardTopBar active="plan" />

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 56px' }}>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          <div>
            <div style={{ color: C.gray, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>
              TEACHER WORKFLOW
            </div>
            <h1 style={{ color: C.dark, fontSize: 36, lineHeight: 1.05, margin: '8px 0 10px' }}>
              Plan Tomorrow
            </h1>
            <p style={{ color: C.gray, fontSize: 16, lineHeight: 1.55, maxWidth: 700 }}>
              Pick the standard. GOGI pulls the strongest official-text excerpt it has and turns it
              into a clean lesson starting point.
            </p>
          </div>

          <div
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 16,
              display: 'grid',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: C.gray, fontSize: 11, fontWeight: 800 }}>Standard</span>
              <select
                value={standardCode}
                onChange={(event) => setStandardCode(event.target.value)}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.dark,
                  fontSize: 14,
                  minHeight: 42,
                  padding: '0 10px',
                }}
              >
                {standardOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} - {option.title}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: C.gray, fontSize: 11, fontWeight: 800 }}>Class length</span>
              <select
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.dark,
                  fontSize: 14,
                  minHeight: 42,
                  padding: '0 10px',
                }}
              >
                <option value={90}>90 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={45}>45 minutes</option>
              </select>
            </label>

            <button
              type="button"
              onClick={loadPlan}
              style={{
                background: C.blue,
                border: 'none',
                borderRadius: 6,
                color: C.white,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 800,
                minHeight: 42,
              }}
            >
              Refresh plan
            </button>
          </div>
        </section>

        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            marginTop: 18,
            padding: 20,
          }}
        >
          {loading ? (
            <div style={{ color: C.gray, fontSize: 15 }}>Building the cleanest plan...</div>
          ) : error ? (
            <div style={{ color: C.red, fontSize: 15, fontWeight: 700 }}>{error}</div>
          ) : !recommendation ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <h2 style={{ color: C.dark, fontSize: 24, margin: 0 }}>
                {selectedStandard?.code}: {selectedStandard?.title}
              </h2>
              <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.55, margin: 0 }}>
                {plan?.empty_state ??
                  'GOGI does not have a usable excerpt for this standard yet.'}
              </p>
              <button
                type="button"
                onClick={() => router.push(`/admin/gutenberg-library?standard=${standardCode}`)}
                style={{
                  background: C.navy,
                  border: 'none',
                  borderRadius: 6,
                  color: C.white,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 800,
                  justifySelf: 'start',
                  padding: '10px 14px',
                }}
              >
                Open Content Library
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 20 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Chip>{plan?.standard?.code}</Chip>
                    <Chip color={confidenceColor(recommendation.confidence)}>
                      {confidenceLabel(recommendation.confidence)}
                    </Chip>
                    {recommendation.word_count ? (
                      <Chip color={C.gray}>{recommendation.word_count} words</Chip>
                    ) : null}
                  </div>
                  <h2 style={{ color: C.dark, fontSize: 28, lineHeight: 1.15, margin: 0 }}>
                    {plan?.standard?.title}
                  </h2>
                  <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.55, margin: '8px 0 0' }}>
                    {plan?.standard?.standardText}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/admin/gutenberg-library?standard=${standardCode}&view=library`)
                    }
                    style={{
                      background: C.white,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.dark,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '9px 12px',
                    }}
                  >
                    View library
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/teacher-dashboard/literary-intelligence')}
                    style={{
                      background: C.navy,
                      border: 'none',
                      borderRadius: 6,
                      color: C.white,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '9px 12px',
                    }}
                  >
                    Build full lesson
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.72fr)',
                  gap: 16,
                }}
              >
                <article
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: 16,
                    background: '#FBFCFF',
                  }}
                >
                  <div style={{ color: C.gray, fontSize: 11, fontWeight: 800 }}>BEST TEXT</div>
                  <h3 style={{ color: C.dark, fontSize: 20, margin: '6px 0 4px' }}>
                    {recommendation.text}
                  </h3>
                  <div style={{ color: C.blue, fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
                    Focus: {recommendation.skill_focus}
                  </div>
                  <p
                    style={{
                      color: C.dark,
                      fontFamily: FONTS.passage,
                      fontSize: 17,
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {recommendation.excerpt}
                  </p>
                </article>

                <aside
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: 16,
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 800 }}>
                      FAST MOVE
                    </div>
                    <p style={{ color: C.dark, fontSize: 15, lineHeight: 1.5, margin: '5px 0 0' }}>
                      {plan?.standard?.studentMove}
                    </p>
                  </div>
                  <div>
                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 800 }}>
                      WHY THIS ONE
                    </div>
                    <ul style={{ color: C.dark, fontSize: 13, lineHeight: 1.5, paddingLeft: 18 }}>
                      {recommendation.why_this_text.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div
                    style={{
                      background: C.light,
                      borderRadius: 6,
                      color: C.gray,
                      fontSize: 12,
                      lineHeight: 1.45,
                      padding: 10,
                    }}
                  >
                    {recommendation.confidence === 'ready'
                      ? 'This is ready to use as a teacher-reviewed starting point.'
                      : 'Skim this excerpt before class. GOGI selected it as the strongest available match, but it still needs teacher eyes.'}
                  </div>
                </aside>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
                  gap: 16,
                }}
              >
                <section style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                  <h3 style={{ color: C.dark, fontSize: 18, margin: '0 0 12px' }}>
                    Tomorrow&apos;s Flow
                  </h3>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {recommendation.tomorrow_flow.map((step) => (
                      <div
                        key={step.label}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '92px 1fr',
                          gap: 10,
                          alignItems: 'start',
                        }}
                      >
                        <div style={{ color: C.blue, fontSize: 12, fontWeight: 900 }}>
                          {step.label}
                          <div style={{ color: C.gray, fontSize: 11, fontWeight: 700 }}>
                            {step.minutes} min
                          </div>
                        </div>
                        <div style={{ color: C.dark, fontSize: 14, lineHeight: 1.45 }}>
                          {step.move}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                  <h3 style={{ color: C.dark, fontSize: 18, margin: '0 0 12px' }}>
                    Cornell Notes
                  </h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recommendation.cornell_notes.map((row) => (
                      <div
                        key={row.cue}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(120px, 0.42fr) minmax(0, 1fr)',
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            background: '#FFF8E1',
                            color: C.dark,
                            fontSize: 12,
                            fontWeight: 800,
                            padding: 10,
                          }}
                        >
                          {row.cue}
                        </div>
                        <div style={{ color: C.dark, fontSize: 13, lineHeight: 1.45, padding: 10 }}>
                          {row.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section
                style={{
                  background: C.navy,
                  borderRadius: 8,
                  color: C.white,
                  padding: 16,
                }}
              >
                <div style={{ color: C.blueMid, fontSize: 11, fontWeight: 800 }}>EXIT TICKET</div>
                <p style={{ fontSize: 16, lineHeight: 1.5, margin: '6px 0 0' }}>
                  {recommendation.exit_ticket}
                </p>
              </section>

              {plan?.alternatives?.length ? (
                <section style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                  <h3 style={{ color: C.dark, fontSize: 18, margin: '0 0 10px' }}>
                    Other Available Excerpts
                  </h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {plan.alternatives.map((alt) => (
                      <div
                        key={alt.passage_id}
                        style={{
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            color: C.dark,
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'space-between',
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          <span>{alt.text || 'Official text excerpt'}</span>
                          <span style={{ color: confidenceColor(alt.confidence) }}>
                            {confidenceLabel(alt.confidence)}
                          </span>
                        </div>
                        <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
                          {alt.coverage_strand_label ? `${alt.coverage_strand_label} · ` : ''}
                          {alt.word_count ? `${alt.word_count} words · ` : ''}
                          {alt.excerpt}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
