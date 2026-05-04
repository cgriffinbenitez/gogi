'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, FONTS } from '@/lib/constants/design';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';

type Band = 'low' | 'mid' | 'adequate';
type Load = 'standard' | 'reduced' | 'maximum_reduction';
type RunMode = 'all' | 'research' | 'demo';
type DimensionKey = 'workingMemory' | 'attention' | 'speed' | 'consistency';

type DemoParticipant = {
  id: string;
  participant_label: string;
  tester_type: string;
  context_note: string | null;
  created_at: string;
};

type Layer0Assessment = {
  id: string;
  demo_participant_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  dsb_max_span: number | null;
  dsb_total_correct: number | null;
  dsb_band: Band | null;
  cpt_commission_errors: number | null;
  cpt_omission_errors: number | null;
  cpt_mean_rt_ms: number | null;
  cpt_rt_cv: number | null;
  cpt_band: Band | null;
  sdst_correct: number | null;
  sdst_attempted: number | null;
  sdst_band: Band | null;
  rtv_band: Band | null;
  layer0_composite: string | null;
  load_calibration: Load | null;
  teacher_review_flag: boolean | null;
};

type ResultRow = {
  participant: DemoParticipant;
  assessment: Layer0Assessment | null;
};

const BAND_LABEL: Record<Band, string> = {
  low: 'Needs support',
  mid: 'Developing',
  adequate: 'Ready',
};

const LOAD_LABEL: Record<Load, string> = {
  standard: 'Standard support',
  reduced: 'Reduced load',
  maximum_reduction: 'Maximum load reduction',
};

const LOAD_INSIGHT: Record<Load, string> = {
  standard:
    'Use normal intervention pacing. Keep evidence work active and fade scaffolds on schedule.',
  reduced: 'Shorten chunks, keep directions visible, and ask for one thinking move at a time.',
  maximum_reduction:
    'Use very small chunks, visible models, fewer choices, and frequent teacher review.',
};

const DIMENSION_LABEL: Record<DimensionKey, string> = {
  workingMemory: 'Working memory',
  attention: 'Attention control',
  speed: 'Processing speed',
  consistency: 'Response consistency',
};

export default function DemoResultsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [modeFilter, setModeFilter] = useState<RunMode>('research');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function load() {
      setLoading(true);
      setError('');
      try {
        const supabase = createClient();
        const { data: participants, error: participantError } = await supabase
          .from('demo_participants')
          .select('id, participant_label, tester_type, context_note, created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        if (participantError) {
          setError(participantError.message);
          setLoading(false);
          return;
        }

        const participantRows = (participants ?? []) as DemoParticipant[];
        const ids = participantRows.map((p) => p.id);

        let assessments: Layer0Assessment[] = [];
        if (ids.length) {
          const { data: assessmentRows, error: assessmentError } = await supabase
            .from('layer0_assessments')
            .select(
              'id, demo_participant_id, status, started_at, completed_at, dsb_max_span, dsb_total_correct, dsb_band, cpt_commission_errors, cpt_omission_errors, cpt_mean_rt_ms, cpt_rt_cv, cpt_band, sdst_correct, sdst_attempted, sdst_band, rtv_band, layer0_composite, load_calibration, teacher_review_flag'
            )
            .in('demo_participant_id', ids)
            .order('started_at', { ascending: false });

          if (assessmentError) {
            setError(assessmentError.message);
            setLoading(false);
            return;
          }
          assessments = (assessmentRows ?? []) as Layer0Assessment[];
        }

        const latestByParticipant = new Map<string, Layer0Assessment>();
        assessments.forEach((assessment) => {
          if (
            assessment.demo_participant_id &&
            !latestByParticipant.has(assessment.demo_participant_id)
          ) {
            latestByParticipant.set(assessment.demo_participant_id, assessment);
          }
        });

        setRows(
          participantRows.map((participant) => ({
            participant,
            assessment: latestByParticipant.get(participant.id) ?? null,
          }))
        );
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load demo results.');
        setLoading(false);
      }
    }

    load();
  }, [authLoading, router, user]);

  const filteredRows = useMemo(() => {
    if (modeFilter === 'all') return rows;
    return rows.filter((row) => getRunMode(row.participant) === modeFilter);
  }, [modeFilter, rows]);

  const summary = useMemo(() => {
    const complete = filteredRows.filter((row) => row.assessment?.status === 'completed');
    const completedLoads = complete
      .map((row) => row.assessment?.load_calibration)
      .filter((load): load is Load => Boolean(load));
    const averageComposite =
      completedLoads.length === 0
        ? null
        : (
            completedLoads.reduce((sum, load) => sum + loadWeight(load), 0) / completedLoads.length
          ).toFixed(1);
    return {
      testers: filteredRows.length,
      completed: complete.length,
      reviewFlags: complete.filter((row) => row.assessment?.teacher_review_flag).length,
      maxReduction: complete.filter(
        (row) => row.assessment?.load_calibration === 'maximum_reduction'
      ).length,
      averageComposite,
    };
  }, [filteredRows]);

  const cohortInsights = useMemo(() => buildCohortInsights(filteredRows), [filteredRows]);

  function exportCsv() {
    const csv = buildCsv(filteredRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gogi-layer0-${modeFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (authLoading || loading) {
    return (
      <Shell>
        <p style={muted}>Loading demo data...</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <header style={header}>
        <div>
          <div style={kicker}>Layer 0 demo data</div>
          <h1 style={title}>Cognitive availability dashboard</h1>
          <p style={body}>
            Use this to see who tested, what GOGI learned, and how the intervention should adapt.
          </p>
        </div>
        <div style={headerActions}>
          <button style={secondaryButton} onClick={exportCsv}>
            Export CSV
          </button>
          <button style={button} onClick={() => router.push('/demo/start')}>
            New demo run
          </button>
        </div>
      </header>

      {error && <div style={errorBox}>{error}</div>}

      <section style={filterBar}>
        {(['research', 'demo', 'all'] as RunMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setModeFilter(mode)}
            style={modeFilter === mode ? filterActive : filterButton}
          >
            {mode === 'all' ? 'All runs' : mode === 'research' ? 'Research runs' : 'Quick demos'}
          </button>
        ))}
      </section>

      <section style={summaryGrid}>
        <Metric label="Testers" value={summary.testers} />
        <Metric label="Completed" value={summary.completed} />
        <Metric label="Teacher review" value={summary.reviewFlags} />
        <Metric label="Max reduction" value={summary.maxReduction} />
        <Metric label="Avg load score" value={summary.averageComposite ?? '-'} />
      </section>

      <section style={analyticsGrid}>
        <Card>
          <div style={kicker}>Cohort signal</div>
          <h2 style={sectionTitle}>{cohortInsights.headline}</h2>
          <p style={{ ...body, marginTop: 8 }}>{cohortInsights.sampleNote}</p>
          <div style={distributionList}>
            {cohortInsights.loadDistribution.map((item) => (
              <DistributionRow
                key={item.label}
                label={item.label}
                count={item.count}
                total={cohortInsights.completedCount}
              />
            ))}
          </div>
        </Card>

        <Card>
          <div style={kicker}>Likely constraints</div>
          <h2 style={sectionTitle}>What is most often limiting access?</h2>
          <div style={distributionList}>
            {cohortInsights.dimensionDistribution.map((item) => (
              <DistributionRow
                key={item.label}
                label={item.label}
                count={item.count}
                total={cohortInsights.completedCount}
              />
            ))}
          </div>
        </Card>

        <Card>
          <div style={kicker}>Research read</div>
          <h2 style={sectionTitle}>What this lets you investigate next</h2>
          <ul style={insightList}>
            {cohortInsights.researchQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </Card>
      </section>

      {!filteredRows.length ? (
        <Card>
          <h2 style={sectionTitle}>No runs in this view yet.</h2>
          <p style={body}>
            Start a research run, collect tester info, complete Layer 0, then results will appear
            here.
          </p>
        </Card>
      ) : (
        <section style={list}>
          {filteredRows.map((row) => (
            <ResultCard key={row.participant.id} row={row} />
          ))}
        </section>
      )}
    </Shell>
  );
}

function ResultCard({ row }: { row: ResultRow }) {
  const a = row.assessment;
  const load = a?.load_calibration;
  const mode = getRunMode(row.participant);
  const contextNote = getCleanContextNote(row.participant);

  return (
    <Card>
      <div style={cardTop}>
        <div>
          <h2 style={sectionTitle}>{row.participant.participant_label}</h2>
          <p style={meta}>
            {modeLabel(mode)} | {row.participant.tester_type} |{' '}
            {formatDate(row.participant.created_at)}
          </p>
        </div>
        <StatusPill status={a?.status ?? 'not started'} />
      </div>

      {contextNote && <p style={note}>{contextNote}</p>}

      {!a ? (
        <p style={body}>This tester has an intake record but no Layer 0 assessment yet.</p>
      ) : a.status !== 'completed' ? (
        <p style={body}>
          Layer 0 started but is not complete yet. Completed results will appear after the final
          save.
        </p>
      ) : (
        <>
          <div style={bandGrid}>
            <BandTile
              label="Working memory"
              band={a.dsb_band}
              detail={`Max span ${a.dsb_max_span ?? '-'}`}
            />
            <BandTile
              label="Attention"
              band={a.cpt_band}
              detail={`${a.cpt_commission_errors ?? '-'} commission | ${a.cpt_omission_errors ?? '-'} omission`}
            />
            <BandTile
              label="Speed"
              band={a.sdst_band}
              detail={`${a.sdst_correct ?? '-'} correct / ${a.sdst_attempted ?? '-'} tried`}
            />
            <BandTile
              label="Consistency"
              band={a.rtv_band}
              detail={`RT CV ${a.cpt_rt_cv ?? '-'}`}
            />
          </div>

          <div style={insightBox}>
            <div style={kicker}>Instructional read</div>
            <h3 style={insightTitle}>{load ? LOAD_LABEL[load] : 'Support profile pending'}</h3>
            <p style={body}>
              {load
                ? LOAD_INSIGHT[load]
                : 'GOGI needs a completed assessment before assigning load calibration.'}
            </p>
            <ul style={insightList}>
              {dimensionInsights(a).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={metric}>
      <div style={metricValue}>{value}</div>
      <div style={meta}>{label}</div>
    </div>
  );
}

function DistributionRow({ label, count, total }: { label: string; count: number; total: number }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div style={distributionTop}>
        <span>{label}</span>
        <span>
          {count} · {percent}%
        </span>
      </div>
      <div style={barTrack}>
        <div style={{ ...barFill, width: `${percent}%` }} />
      </div>
    </div>
  );
}

function BandTile({ label, band, detail }: { label: string; band: Band | null; detail: string }) {
  const resolved = band ?? 'mid';
  return (
    <div style={{ ...bandTile, borderColor: bandColor(resolved), background: bandBg(resolved) }}>
      <div style={bandLabel}>{label}</div>
      <div style={{ ...bandValue, color: bandColor(resolved) }}>
        {band ? BAND_LABEL[band] : 'Pending'}
      </div>
      <div style={meta}>{detail}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const complete = status === 'completed';
  return (
    <span
      style={{
        ...pill,
        background: complete ? C.greenLight : C.amberLight,
        color: complete ? C.green : C.amber,
      }}
    >
      {status}
    </span>
  );
}

function dimensionInsights(a: Layer0Assessment) {
  const insights: string[] = [];
  if (a.dsb_band === 'low')
    insights.push(
      'Working memory is likely the first constraint: reduce chunk size and avoid multi-step directions.'
    );
  if (a.cpt_band === 'low')
    insights.push(
      'Attention control needs support: use shorter loops, immediate feedback, and fewer distractors.'
    );
  if (a.sdst_band === 'low')
    insights.push(
      'Processing speed is a constraint: remove timed pressure and give more wait time.'
    );
  if (a.rtv_band === 'low')
    insights.push(
      'Response consistency is uneven: keep layout stable and avoid rapid visual changes.'
    );
  if (!insights.length)
    insights.push(
      'No major Layer 0 constraint emerged; instruction can focus more directly on the reading skill.'
    );
  return insights;
}

function buildCohortInsights(rows: ResultRow[]) {
  const complete = rows.filter((row) => row.assessment?.status === 'completed');
  const completedCount = complete.length;
  const loadCounts = countLoads(complete);
  const dimensionCounts = countLowDimensions(complete);
  const dominantLoad = loadCounts.reduce((best, item) => (item.count > best.count ? item : best), {
    label: 'No completed data yet',
    count: 0,
  });
  const dominantDimension = dimensionCounts.reduce(
    (best, item) => (item.count > best.count ? item : best),
    { label: 'No dominant constraint yet', count: 0 }
  );

  const headline =
    completedCount === 0
      ? 'No completed Layer 0 runs yet'
      : `${dominantLoad.label} is the most common current profile`;
  const sampleNote =
    completedCount < 10
      ? `Only ${completedCount} completed run${completedCount === 1 ? '' : 's'} in this view. Treat this as early signal until you have at least 10-15.`
      : `${completedCount} completed runs gives you a useful first cohort read.`;

  return {
    completedCount,
    headline,
    sampleNote,
    loadDistribution: loadCounts,
    dimensionDistribution: dimensionCounts,
    researchQuestions: [
      dominantDimension.count > 0
        ? `Do students with ${dominantDimension.label.toLowerCase()} constraints need a different scaffold density to show the same ELA growth?`
        : 'Do students without major Layer 0 constraints progress faster through standard intervention pacing?',
      'Which Layer 0 profile predicts the need for reduced choices, visible models, or shorter reading chunks?',
      'After intervention, does the exit Layer 0 profile shift alongside literacy diagnostic growth?',
    ],
  };
}

function countLoads(rows: ResultRow[]) {
  const counts: Record<Load, number> = {
    standard: 0,
    reduced: 0,
    maximum_reduction: 0,
  };
  rows.forEach((row) => {
    const load = row.assessment?.load_calibration;
    if (load) counts[load] += 1;
  });
  return [
    { label: LOAD_LABEL.standard, count: counts.standard },
    { label: LOAD_LABEL.reduced, count: counts.reduced },
    { label: LOAD_LABEL.maximum_reduction, count: counts.maximum_reduction },
  ];
}

function countLowDimensions(rows: ResultRow[]) {
  const counts: Record<DimensionKey, number> = {
    workingMemory: 0,
    attention: 0,
    speed: 0,
    consistency: 0,
  };
  rows.forEach((row) => {
    const a = row.assessment;
    if (!a) return;
    if (a.dsb_band === 'low') counts.workingMemory += 1;
    if (a.cpt_band === 'low') counts.attention += 1;
    if (a.sdst_band === 'low') counts.speed += 1;
    if (a.rtv_band === 'low') counts.consistency += 1;
  });
  return [
    { label: DIMENSION_LABEL.workingMemory, count: counts.workingMemory },
    { label: DIMENSION_LABEL.attention, count: counts.attention },
    { label: DIMENSION_LABEL.speed, count: counts.speed },
    { label: DIMENSION_LABEL.consistency, count: counts.consistency },
  ].sort((a, b) => b.count - a.count);
}

function buildCsv(rows: ResultRow[]) {
  const headers = [
    'participant_label',
    'run_mode',
    'tester_type',
    'context_note',
    'status',
    'started_at',
    'completed_at',
    'load_calibration',
    'teacher_review_flag',
    'layer0_composite',
    'dsb_max_span',
    'dsb_total_correct',
    'dsb_band',
    'cpt_commission_errors',
    'cpt_omission_errors',
    'cpt_mean_rt_ms',
    'cpt_rt_cv',
    'cpt_band',
    'sdst_correct',
    'sdst_attempted',
    'sdst_band',
    'rtv_band',
  ];
  const lines = rows.map((row) => {
    const a = row.assessment;
    return [
      row.participant.participant_label,
      getRunMode(row.participant),
      row.participant.tester_type,
      getCleanContextNote(row.participant),
      a?.status ?? 'not_started',
      a?.started_at ?? '',
      a?.completed_at ?? '',
      a?.load_calibration ?? '',
      a?.teacher_review_flag ?? '',
      a?.layer0_composite ?? '',
      a?.dsb_max_span ?? '',
      a?.dsb_total_correct ?? '',
      a?.dsb_band ?? '',
      a?.cpt_commission_errors ?? '',
      a?.cpt_omission_errors ?? '',
      a?.cpt_mean_rt_ms ?? '',
      a?.cpt_rt_cv ?? '',
      a?.cpt_band ?? '',
      a?.sdst_correct ?? '',
      a?.sdst_attempted ?? '',
      a?.sdst_band ?? '',
      a?.rtv_band ?? '',
    ];
  });
  return [headers, ...lines].map((line) => line.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string | number | boolean | null) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function getRunMode(participant: DemoParticipant): Exclude<RunMode, 'all'> {
  if (participant.context_note?.startsWith('[run_mode:demo]')) return 'demo';
  return 'research';
}

function getCleanContextNote(participant: DemoParticipant) {
  return participant.context_note?.replace(/^\[run_mode:(demo|research)\]\s*/, '').trim() ?? '';
}

function modeLabel(mode: Exclude<RunMode, 'all'>) {
  return mode === 'research' ? 'Research run' : 'Quick demo';
}

function loadWeight(load: Load) {
  if (load === 'maximum_reduction') return 3;
  if (load === 'reduced') return 2;
  return 1;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function bandColor(band: Band) {
  if (band === 'low') return C.red;
  if (band === 'mid') return C.amber;
  return C.green;
}

function bandBg(band: Band) {
  if (band === 'low') return C.redLight;
  if (band === 'mid') return C.amberLight;
  return C.greenLight;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main style={shell}>{children}</main>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <article style={card}>{children}</article>;
}

const shell: React.CSSProperties = {
  background: '#F7F3EA',
  color: C.dark,
  fontFamily: FONTS.ui,
  minHeight: '100vh',
  padding: 28,
};
const header: React.CSSProperties = {
  alignItems: 'flex-start',
  display: 'flex',
  gap: 18,
  justifyContent: 'space-between',
  margin: '0 auto 18px',
  maxWidth: 1180,
};
const headerActions: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  justifyContent: 'flex-end',
};
const kicker: React.CSSProperties = {
  color: C.amber,
  fontSize: 10,
  fontWeight: 850,
  letterSpacing: 1.2,
  marginBottom: 8,
  textTransform: 'uppercase',
};
const title: React.CSSProperties = {
  color: C.dark,
  fontSize: 34,
  lineHeight: 1.05,
  margin: '0 0 8px',
};
const sectionTitle: React.CSSProperties = {
  color: C.dark,
  fontSize: 20,
  lineHeight: 1.15,
  margin: 0,
};
const insightTitle: React.CSSProperties = {
  color: C.dark,
  fontSize: 18,
  lineHeight: 1.2,
  margin: '0 0 8px',
};
const body: React.CSSProperties = { color: C.gray, fontSize: 14, lineHeight: 1.5, margin: 0 };
const muted: React.CSSProperties = { color: C.gray, fontSize: 14, textAlign: 'center' };
const meta: React.CSSProperties = {
  color: C.gray,
  fontSize: 12,
  lineHeight: 1.35,
  margin: '4px 0 0',
  textTransform: 'capitalize',
};
const note: React.CSSProperties = {
  ...body,
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  borderRadius: 8,
  margin: '14px 0',
  padding: 10,
};
const button: React.CSSProperties = {
  background: C.navy,
  border: 'none',
  borderRadius: 8,
  color: C.white,
  cursor: 'pointer',
  fontFamily: FONTS.ui,
  fontSize: 14,
  fontWeight: 850,
  minHeight: 44,
  padding: '0 16px',
  whiteSpace: 'nowrap',
};
const secondaryButton: React.CSSProperties = {
  ...button,
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  color: C.dark,
};
const errorBox: React.CSSProperties = {
  background: C.redLight,
  border: `1px solid ${C.red}`,
  borderRadius: 8,
  color: C.red,
  margin: '0 auto 16px',
  maxWidth: 1180,
  padding: 12,
};
const filterBar: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  margin: '0 auto 14px',
  maxWidth: 1180,
};
const filterButton: React.CSSProperties = {
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  borderRadius: 8,
  color: C.gray,
  cursor: 'pointer',
  fontFamily: FONTS.ui,
  fontSize: 13,
  fontWeight: 850,
  minHeight: 38,
  padding: '0 14px',
};
const filterActive: React.CSSProperties = {
  ...filterButton,
  background: C.navy,
  borderColor: C.navy,
  color: C.white,
};
const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  margin: '0 auto 18px',
  maxWidth: 1180,
};
const analyticsGrid: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  gridTemplateColumns: '1.1fr 1fr 1.1fr',
  margin: '0 auto 18px',
  maxWidth: 1180,
};
const metric: React.CSSProperties = {
  background: C.white,
  border: '1px solid #D7C9AE',
  borderRadius: 10,
  padding: 16,
};
const metricValue: React.CSSProperties = {
  color: C.dark,
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1,
};
const list: React.CSSProperties = { display: 'grid', gap: 14, margin: '0 auto', maxWidth: 1180 };
const card: React.CSSProperties = {
  background: C.white,
  border: '1px solid #D7C9AE',
  borderRadius: 10,
  boxShadow: '0 14px 28px rgba(31, 78, 121, 0.06)',
  padding: 18,
};
const distributionList: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14,
};
const distributionTop: React.CSSProperties = {
  alignItems: 'center',
  color: C.dark,
  display: 'flex',
  fontSize: 13,
  fontWeight: 800,
  justifyContent: 'space-between',
};
const barTrack: React.CSSProperties = {
  background: '#EFE7D7',
  borderRadius: 999,
  height: 8,
  marginTop: 6,
  overflow: 'hidden',
};
const barFill: React.CSSProperties = {
  background: C.navy,
  borderRadius: 999,
  height: '100%',
};
const cardTop: React.CSSProperties = {
  alignItems: 'flex-start',
  display: 'flex',
  gap: 12,
  justifyContent: 'space-between',
};
const pill: React.CSSProperties = {
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 850,
  padding: '6px 10px',
  textTransform: 'uppercase',
};
const bandGrid: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  marginTop: 16,
};
const bandTile: React.CSSProperties = { border: '1px solid', borderRadius: 8, padding: 12 };
const bandLabel: React.CSSProperties = {
  color: C.gray,
  fontSize: 11,
  fontWeight: 850,
  textTransform: 'uppercase',
};
const bandValue: React.CSSProperties = { fontSize: 16, fontWeight: 900, marginTop: 4 };
const insightBox: React.CSSProperties = {
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  borderRadius: 8,
  marginTop: 14,
  padding: 14,
};
const insightList: React.CSSProperties = {
  color: C.dark,
  fontSize: 14,
  lineHeight: 1.55,
  margin: '10px 0 0',
  paddingLeft: 20,
};
