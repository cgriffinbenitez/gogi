'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';

// ─── Pilot standard codes (ordered display) ───────────────────────────────────

const PILOT_CODES = ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PilotStandard {
  id: string;
  code: string;
  title: string;
}

interface StudentRow {
  id: string;
  full_name: string;
  grade_level: string | null;
  teacher_notes?: string | null;
  fast_pm1?: number | null;
  fast_pm2?: number | null;
  fast_target?: number | null;
  fast_pm1_score?: number | null;
  fast_pm2_score?: number | null;
}

interface ProgressRow {
  student_id: string;
  standard_id: string;
  current_status: string;
  sessions_passed: number;
  sessions_attempted: number;
  failed_turns?: number | null;
  teacher_flag?: boolean | null;
  teacher_flag_reason?: string | null;
  mastered_at?: string | null;
}

interface SessionRow {
  id: string;
  student_id: string;
  standard_id: string;
  phase: string;
  started_at: string | null;
  completed_at: string | null;
  dominant_classification: string | null;
  mastery_achieved: boolean | null;
  time_spent_seconds: number | null;
}

interface SchemaRow {
  id: string;
  student_id: string;
  standard_id: string;
  schema_mode: string;
  demand_score: number | null;
  created_at: string;
  readiness_score: number | null;
}

interface CognitiveProfileRow {
  working_memory_score: number | null;
  inferencing_score: number | null;
  vocab_breadth_score: number | null;
  syntax_score: number | null;
  overall_risk: string | null;
  administered_at: string;
}

interface VocabReadinessRow {
  standard_id: string;
  coverage_score: number | null;
  completed_at: string;
}

interface FastRosterProfileRow {
  student_id: string;
  current_achievement_level: number | null;
  next_rung_target: number | null;
  points_to_next_rung: number | null;
  trajectory_data: {
    assessments?: Array<{
      test_reason?: string;
      assessment_grade?: number | null;
      test_year?: number;
      scale_score?: number | null;
      achievement_level?: number | null;
    }>;
  } | null;
}

interface StudentData {
  student: StudentRow;
  progress: ProgressRow[];
  sessions: SessionRow[];
  schemas: SchemaRow[];
  cognitiveProfile: CognitiveProfileRow | null;
  vocabReadiness: VocabReadinessRow[];
  fastProfile: FastRosterProfileRow | null;
}

// ─── Classification labels ────────────────────────────────────────────────────

const CLS_LABELS: Record<string, string> = {
  schema_deficit: 'Schema deficit',
  no_metacognitive_strategy: 'No strategy',
  vocabulary_gap: 'Vocabulary gap',
  morphology_gap: 'Morphology gap',
  syntax_barrier: 'Syntax barrier',
  signal_word_blind: 'Signal word blind',
  inferencing_deficit: 'Inferencing deficit',
  evidence_retrieval_failure: 'Evidence retrieval',
  comprehension_integration_failure: 'Integration failure',
  literal_misreading: 'Literal misreading',
  theme_confusion: 'Theme confusion',
  abstract_reasoning_deficit: 'Abstract reasoning',
  concrete_thinking: 'Concrete thinking',
  theme_evidence_disconnection: 'Theme/evidence gap',
  purpose_failure: 'Purpose failure',
  CORRECT: 'Correct',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function derivePredictedGap(p: CognitiveProfileRow): string {
  const dims = [
    { label: 'Vocab Breadth', score: p.vocab_breadth_score },
    { label: 'Syntactic Awareness', score: p.syntax_score },
    { label: 'Inferencing', score: p.inferencing_score },
    { label: 'Working Memory', score: p.working_memory_score },
  ];
  // Lowest score wins. Ties broken by array order (vocab_breadth wins over syntax, etc.).
  // Strict < keeps the first entry in a tie as the minimum.
  return dims.reduce((min, d) => ((d.score ?? Infinity) < (min.score ?? Infinity) ? d : min)).label;
}

function fmtLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function clsLabel(cls: string | null | undefined): string {
  if (!cls) return '—';
  return CLS_LABELS[cls] ?? cls;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  return `${Math.round(seconds / 60)}min`;
}

function latestFastAssessment(profile: FastRosterProfileRow | null) {
  return profile?.trajectory_data?.assessments?.[0] ?? null;
}

type StatusCfg = { label: string; bg: string; border: string; text: string };

function statusCfg(currentStatus: string | null, teacherFlag?: boolean | null): StatusCfg {
  if (teacherFlag)
    return { label: 'Needs Attention', bg: C.redLight, border: C.red, text: '#791F1F' };
  switch (currentStatus) {
    case 'mastered':
      return { label: 'Mastered', bg: C.greenLight, border: C.green, text: '#27500A' };
    case 'intervening':
    case 'practicing':
      return { label: 'In Intervention', bg: C.amberLight, border: C.amber, text: '#633806' };
    case 'diagnostic':
      return { label: 'In Diagnostic', bg: C.blueLight, border: C.blue, text: '#0C447C' };
    default:
      return { label: 'Not Started', bg: C.light, border: C.border, text: '#5F5E5A' };
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  color,
  sub,
}: {
  value: number;
  label: string;
  color: string;
  sub: string;
}) {
  return (
    <div
      style={{
        background: C.white,
        border: `0.5px solid ${C.border}`,
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function TeacherWorkflowCard({
  label,
  title,
  detail,
  href,
  color,
}: {
  label: string;
  title: string;
  detail: string;
  href: string;
  color: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      style={{
        background: C.white,
        border: `0.5px solid ${C.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        minHeight: 94,
        padding: '12px 14px',
        textAlign: 'left' as const,
      }}
    >
      <div
        style={{
          color,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </div>
      <div style={{ color: C.dark, fontSize: 14, fontWeight: 800, marginTop: 6 }}>{title}</div>
      <div style={{ color: C.gray, fontSize: 11, lineHeight: 1.45, marginTop: 4 }}>{detail}</div>
    </button>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  currentStatus,
  teacherFlag,
}: {
  currentStatus: string | null;
  teacherFlag?: boolean | null;
}) {
  const cfg = statusCfg(currentStatus, teacherFlag);
  return (
    <span
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        borderRadius: 5,
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: 'nowrap' as const,
        display: 'inline-block',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Session dots ─────────────────────────────────────────────────────────────

function SessionDots({ passed, total = 3 }: { passed: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 5 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < passed ? C.green : 'transparent',
            border: `1.5px solid ${i < passed ? C.green : C.border}`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ flex: 1, background: C.light, height: 5, borderRadius: 3, overflow: 'hidden' }}>
      <div
        style={{
          height: 5,
          width: `${Math.min(100, Math.max(0, pct))}%`,
          background: C.blue,
          borderRadius: 3,
        }}
      />
    </div>
  );
}

// ─── Teacher nav ──────────────────────────────────────────────────────────────

type Tab = 'roster' | 'analytics' | 'questions';

function TeacherNav({
  teacherName,
  school,
  activeTab,
  onTabChange,
}: {
  teacherName: string;
  school: string;
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }
  const tabs: { key: Tab; label: string }[] = [
    { key: 'roster', label: 'Roster' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'questions', label: 'Questions' },
  ];
  const actionLinks = [
    { label: 'Upload FAST', href: '/teacher-dashboard/fast-upload' },
    { label: 'Plan Tomorrow', href: '/teacher-dashboard/plan-tomorrow' },
    { label: 'Official Corpus', href: '/teacher-dashboard/official-teachable-corpus' },
    { label: 'Workbook Builder', href: '/teacher-dashboard/workbook-builder' },
    { label: 'Pull-Out Sheets', href: '/teacher-dashboard/pull-out-sheets' },
    { label: 'R.1.1 Coverage', href: '/teacher-dashboard/r11-coverage' },
    { label: 'Content Library', href: '/admin/gutenberg-library' },
    { label: 'Library Readiness', href: '/admin/reading-win-coverage' },
    { label: 'Lesson Builder', href: '/teacher-dashboard/literary-intelligence' },
    { label: 'Question Builder', href: '/admin/original-items' },
  ];

  return (
    <nav
      style={{
        background: C.navy,
        minHeight: 52,
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        boxSizing: 'border-box' as const,
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        <button
          onClick={() => router.push('/dashboard/teacher')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            borderRadius: 6,
            transition: 'background 0.2s',
            marginRight: 16,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
          }}
          title="Back to dashboard"
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: C.white,
              letterSpacing: '-0.5px',
              fontFamily: FONTS.ui,
            }}
          >
            GOGI
          </span>
        </button>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'questions') {
                  router.push('/admin/questions');
                  return;
                }
                onTabChange(tab.key);
              }}
              style={{
                background: 'none',
                border: 'none',
                minHeight: 44,
                padding: '0 12px',
                color: active ? C.white : C.blueMid,
                borderBottom: active ? `2px solid ${C.white}` : '2px solid transparent',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
        {actionLinks.map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(181,212,244,0.24)',
              borderRadius: 6,
              padding: '7px 12px',
              color: C.white,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONTS.ui,
              marginLeft: 4,
            }}
          >
            {link.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            fontSize: 11,
            color: C.blueMid,
            whiteSpace: 'nowrap' as const,
            fontFamily: FONTS.ui,
          }}
        >
          {teacherName}&nbsp;|&nbsp;{school}&nbsp;|&nbsp;Pilot Cohort&nbsp;·&nbsp;Period 3
        </span>
        <button
          onClick={handleSignOut}
          style={{
            background: 'none',
            border: '1px solid rgba(181,212,244,0.3)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            color: C.blueMid,
            cursor: 'pointer',
            fontFamily: FONTS.ui,
            transition: 'background 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.borderColor = 'rgba(181,212,244,0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.borderColor = 'rgba(181,212,244,0.3)';
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

// ─── Student detail panel ─────────────────────────────────────────────────────

function StudentDetailPanel({
  sd,
  standards,
  onClose,
}: {
  sd: StudentData;
  standards: PilotStandard[];
  onClose: () => void;
}) {
  const { student, progress, sessions, schemas, cognitiveProfile, vocabReadiness } = sd;
  const [notes, setNotes] = useState(student.teacher_notes ?? '');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleNotes(val: string) {
    setNotes(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient();
      await supabase.from('students').update({ teacher_notes: val }).eq('id', student.id);
    }, 1000);
  }

  const progressByStd: Record<string, ProgressRow> = {};
  for (const p of progress) progressByStd[p.standard_id] = p;

  const stdIdToCode: Record<string, string> = {};
  for (const s of standards) stdIdToCode[s.id] = s.code;

  const flagged = progress.filter((p) => p.teacher_flag === true);

  const cardStyle: React.CSSProperties = {
    background: C.white,
    border: `0.5px solid ${C.border}`,
    borderRadius: 8,
    padding: '12px 14px',
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    color: C.gray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  };

  const pm1 = student.fast_pm1 ?? student.fast_pm1_score ?? null;
  const pm2 = student.fast_pm2 ?? student.fast_pm2_score ?? null;
  const target = student.fast_target ?? null;

  return (
    <div
      style={{
        background: 'rgba(31,78,121,0.06)',
        border: `1px solid ${C.blueLight}`,
        borderRadius: 10,
        padding: 16,
        marginTop: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>{student.full_name}</div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
            9th Grade · Period 3 · Pilot Cohort
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 11,
            color: C.blue,
            cursor: 'pointer',
            fontFamily: FONTS.ui,
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* ── Section 1: Pre-Literary Cognitive Profile ── */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Pre-Literary Cognitive Profile</div>
          <div style={{ fontSize: 10, color: C.gray, fontStyle: 'italic', marginBottom: 10 }}>
            {cognitiveProfile
              ? `Administered ${fmtLongDate(cognitiveProfile.administered_at)}`
              : 'Not yet administered'}
          </div>
          {(
            [
              { label: 'Working Memory', score: cognitiveProfile?.working_memory_score ?? null },
              { label: 'Inferencing', score: cognitiveProfile?.inferencing_score ?? null },
              { label: 'Vocab Breadth', score: cognitiveProfile?.vocab_breadth_score ?? null },
              { label: 'Syntactic Awareness', score: cognitiveProfile?.syntax_score ?? null },
            ] as { label: string; score: number | null }[]
          ).map(({ label, score }) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}
            >
              <span style={{ fontSize: 10, color: C.dark, width: 120, flexShrink: 0 }}>
                {label}
              </span>
              <ProgressBar pct={score ?? 0} />
              <span style={{ fontSize: 10, color: C.gray, width: 28, textAlign: 'right' as const }}>
                {score !== null ? `${Math.round(score)}%` : '—%'}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 9, color: C.gray, fontStyle: 'italic', marginTop: 6 }}>
            {cognitiveProfile
              ? `Predicted gap: ${derivePredictedGap(cognitiveProfile)}`
              : 'Predicted gap: pending Reading Profile'}
          </div>
        </div>

        {/* ── Section 2: Vocabulary Readiness ── */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Vocabulary Readiness</div>
          <div style={{ fontSize: 10, color: C.gray, fontStyle: 'italic', marginBottom: 10 }}>
            {vocabReadiness.length > 0
              ? `Administered ${fmtLongDate(
                  vocabReadiness.reduce(
                    (latest, r) => (r.completed_at > latest ? r.completed_at : latest),
                    vocabReadiness[0].completed_at
                  )
                )}`
              : 'Not yet administered'}
          </div>
          {standards.map((std) => {
            const row = vocabReadiness.find((r) => r.standard_id === std.id) ?? null;
            const score = row?.coverage_score ?? null;
            return (
              <div
                key={std.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}
              >
                <span style={{ fontSize: 10, color: C.dark, width: 90, flexShrink: 0 }}>
                  {std.code}
                </span>
                <ProgressBar pct={score ?? 0} />
                <span
                  style={{ fontSize: 10, color: C.gray, width: 28, textAlign: 'right' as const }}
                >
                  {score !== null ? `${Math.round(score)}%` : '—%'}
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: 9, color: C.gray, fontStyle: 'italic', marginTop: 6 }}>
            98% threshold for independent comprehension
          </div>
        </div>

        {/* ── Section 3: Standards Progress ── */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Standards Progress</div>
          {standards.map((std, i) => {
            const prog = progressByStd[std.id];
            const diagSession = sessions.find(
              (s) => s.standard_id === std.id && s.phase === 'diagnostic'
            );
            const currentStatus = prog?.current_status ?? diagSession?.phase ?? null;
            const cls = diagSession?.dominant_classification ?? null;
            const passed = prog?.sessions_passed ?? 0;
            return (
              <div
                key={std.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: i < standards.length - 1 ? 10 : 0,
                  marginBottom: i < standards.length - 1 ? 10 : 0,
                  borderBottom: i < standards.length - 1 ? `0.5px solid ${C.light}` : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>{std.code}</div>
                  {cls && (
                    <div style={{ fontSize: 10, color: C.amber, marginTop: 2 }}>
                      {clsLabel(cls)}
                    </div>
                  )}
                  <SessionDots passed={passed} />
                </div>
                <StatusBadge currentStatus={currentStatus} teacherFlag={prog?.teacher_flag} />
              </div>
            );
          })}
        </div>

        {/* ── Section 4: FAST Scores ── */}
        <div style={cardStyle}>
          <div style={sectionTitle}>FAST Scores</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {(
              [
                { label: 'PM1 Baseline', value: pm1, color: C.navy },
                { label: 'PM2 Post', value: pm2, color: C.navy },
                { label: 'Target', value: target, color: C.green },
              ] as { label: string; value: number | null; color: string }[]
            ).map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: C.light,
                  borderRadius: 6,
                  padding: '10px 8px',
                  textAlign: 'center' as const,
                }}
              >
                <div
                  style={{ fontSize: 18, fontWeight: 700, color: value != null ? color : C.border }}
                >
                  {value ?? '—'}
                </div>
                <div style={{ fontSize: 9, color: C.gray, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 5: Schema Intervention History ── */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Schema Intervention History</div>
          {schemas.length === 0 ? (
            <div style={{ fontSize: 10, color: C.gray, fontStyle: 'italic' }}>No sessions yet</div>
          ) : (
            schemas.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 7,
                  fontSize: 10,
                }}
              >
                <span style={{ color: C.gray, width: 95, flexShrink: 0 }}>
                  {stdIdToCode[s.standard_id] ?? '—'} · {fmtDate(s.created_at)}
                </span>
                <span
                  style={{
                    background: C.amberLight,
                    border: `1px solid ${C.amber}`,
                    color: C.amber,
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: 9,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {s.schema_mode?.replace(/_/g, ' ') ?? '—'}
                </span>
                <span style={{ color: C.green, marginLeft: 'auto', flexShrink: 0 }}>
                  Readiness: {s.readiness_score ?? '—'}/3
                </span>
              </div>
            ))
          )}
        </div>

        {/* ── Section 6: Session Timeline ── */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Session Timeline</div>
          {sessions.length === 0 ? (
            <div style={{ fontSize: 10, color: C.gray, fontStyle: 'italic' }}>No sessions yet</div>
          ) : (
            sessions.slice(0, 8).map((s, i) => {
              const code = stdIdToCode[s.standard_id] ?? '?';
              let label = `${code} ${s.phase}`;
              if (s.phase === 'diagnostic' && s.completed_at) {
                label = `${code} Diagnostic · ${clsLabel(s.dominant_classification)}`;
              } else if (s.phase === 'diagnostic') {
                label = `${code} Diagnostic started`;
              } else if (s.phase === 'practice' && s.mastery_achieved) {
                label = `${code} Practice · Session passed`;
              } else if (s.phase === 'practice') {
                label = `${code} Practice · Session failed`;
              } else if (s.phase === 'teach') {
                label = `${code} Teach intervention`;
              }
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'baseline',
                    marginBottom: 7,
                    fontSize: 10,
                  }}
                >
                  <span style={{ color: C.gray, minWidth: 52, flexShrink: 0 }}>
                    {fmtDate(s.started_at)}
                  </span>
                  <span style={{ color: C.dark, flex: 1 }}>{label}</span>
                  <span style={{ color: C.gray, flexShrink: 0 }}>
                    {fmtDuration(s.time_spent_seconds)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* ── Section 7: Needs Attention (full-width, conditional) ── */}
        {flagged.length > 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              background: C.redLight,
              border: `1px solid ${C.red}`,
              borderRadius: 6,
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: C.red, marginBottom: 4 }}>
              ⚑ Teacher Review Required
            </div>
            {flagged.map((p, i) => (
              <div
                key={i}
                style={{ fontSize: 10, color: '#791F1F', lineHeight: 1.5, marginBottom: 2 }}
              >
                <strong>{stdIdToCode[p.standard_id] ?? '?'}:</strong>&nbsp;
                {p.teacher_flag_reason ?? 'Review required'}
              </div>
            ))}
            <textarea
              value={notes}
              onChange={(e) => handleNotes(e.target.value)}
              placeholder="Add clinical observation notes..."
              style={{
                width: '100%',
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: 8,
                fontSize: 12,
                fontFamily: FONTS.ui,
                resize: 'vertical' as const,
                marginTop: 8,
                boxSizing: 'border-box' as const,
                minHeight: 60,
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('roster');
  const [teacherName, setTeacherName] = useState('Teacher');
  const [teacherSchool, setTeacherSchool] = useState('South Dade SHS');
  const [standards, setStandards] = useState<PilotStandard[]>([]);
  const [studentData, setStudentData] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const initialized = useRef(false);

  // Clock (client-only to avoid hydration mismatch)
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  }, []);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (role === 'student') {
      router.push('/dashboard/student');
      return;
    }
  }, [user, role, authLoading, router]);

  // Data load — runs exactly once after auth resolves
  useEffect(() => {
    if (authLoading || !user || role !== 'teacher') return;
    if (initialized.current) return;
    initialized.current = true;

    async function load() {
      try {
        const supabase = createClient();

        // Parallel: teacher profile + standards + students
        const [{ data: profileData }, { data: stdData }, { data: rawStudents }] = await Promise.all(
          [
            supabase.from('users').select('full_name, school').eq('id', user!.id).maybeSingle(),
            supabase
              .from('standards')
              .select('id, code, title')
              .in('code', [...PILOT_CODES]),
            supabase.from('students').select('*').eq('teacher_id', user!.id).order('full_name'),
          ]
        );

        if (profileData) {
          const p = profileData as { full_name?: string; school?: string };
          if (p.full_name) setTeacherName(p.full_name);
          if (p.school) setTeacherSchool(p.school);
        }

        const pilotStandards = (stdData ?? []) as unknown as PilotStandard[];
        // Sort by PILOT_CODES order
        pilotStandards.sort(
          (a, b) =>
            PILOT_CODES.indexOf(a.code as (typeof PILOT_CODES)[number]) -
            PILOT_CODES.indexOf(b.code as (typeof PILOT_CODES)[number])
        );
        setStandards(pilotStandards);

        const students = (rawStudents ?? []) as unknown as StudentRow[];
        if (students.length === 0) {
          setStudentData([]);
          setLoading(false);
          return;
        }

        const studentIds = students.map((s) => s.id);

        // Parallel: supporting data for all students
        const [
          { data: progressData },
          { data: sessionData },
          { data: schemaData },
          { data: cogProfileData },
          { data: vocabReadinessData },
          { data: fastProfileData },
        ] = await Promise.all([
          supabase
            .from('standard_progress')
            .select(
              'student_id, standard_id, current_status, sessions_passed, sessions_attempted, failed_turns, teacher_flag, teacher_flag_reason, mastered_at'
            )
            .in('student_id', studentIds),
          supabase
            .from('sessions')
            .select(
              'id, student_id, standard_id, phase, started_at, completed_at, dominant_classification, mastery_achieved, time_spent_seconds'
            )
            .in('student_id', studentIds)
            .order('started_at', { ascending: false })
            .limit(200),
          supabase
            .from('schema_interventions')
            .select('id, student_id, standard_id, schema_mode, demand_score, created_at')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('cognitive_profiles')
            .select(
              'student_id, working_memory_score, inferencing_score, vocab_breadth_score, syntax_score, overall_risk, administered_at'
            )
            .in('student_id', studentIds)
            .order('administered_at', { ascending: false }),
          supabase
            .from('vocab_readiness')
            .select('student_id, standard_id, coverage_score, completed_at')
            .in('student_id', studentIds),
          supabase
            .from('student_cognitive_profiles')
            .select(
              'student_id, current_achievement_level, next_rung_target, points_to_next_rung, trajectory_data'
            )
            .in('student_id', studentIds)
            .eq('active', true)
            .order('generated_at', { ascending: false }),
        ]);

        // Fetch schema responses for all interventions
        const schemaRows = (schemaData ?? []) as unknown as (SchemaRow & { id: string })[];
        const schemaIds = schemaRows.map((s) => s.id);
        const { data: schemaRespData } =
          schemaIds.length > 0
            ? await supabase
                .from('schema_responses')
                .select('schema_intervention_id, readiness_score')
                .in('schema_intervention_id', schemaIds)
            : { data: [] };

        const schemaRespMap: Record<string, number> = {};
        for (const r of (schemaRespData ?? []) as {
          schema_intervention_id: string;
          readiness_score: number;
        }[]) {
          schemaRespMap[r.schema_intervention_id] = r.readiness_score;
        }

        // Group by student
        const progressByStudent: Record<string, ProgressRow[]> = {};
        const sessionsByStudent: Record<string, SessionRow[]> = {};
        const schemasByStudent: Record<string, SchemaRow[]> = {};
        // cognitive_profiles: keep only most recent row per student (DESC order from query)
        const cogProfileByStudent: Record<string, CognitiveProfileRow | null> = {};
        const vocabReadinessByStudent: Record<string, VocabReadinessRow[]> = {};
        const fastProfileByStudent: Record<string, FastRosterProfileRow | null> = {};

        for (const p of (progressData ?? []) as unknown as ProgressRow[]) {
          if (!progressByStudent[p.student_id]) progressByStudent[p.student_id] = [];
          progressByStudent[p.student_id].push(p);
        }
        for (const s of (sessionData ?? []) as unknown as SessionRow[]) {
          if (!sessionsByStudent[s.student_id]) sessionsByStudent[s.student_id] = [];
          sessionsByStudent[s.student_id].push(s);
        }
        for (const s of schemaRows) {
          if (!schemasByStudent[s.student_id]) schemasByStudent[s.student_id] = [];
          schemasByStudent[s.student_id].push({
            ...s,
            readiness_score: schemaRespMap[s.id] ?? null,
          });
        }
        // cognitive_profiles: rows are DESC by administered_at — first seen per student is most recent
        type RawCogRow = CognitiveProfileRow & { student_id: string };
        for (const row of (cogProfileData ?? []) as unknown as RawCogRow[]) {
          if (!(row.student_id in cogProfileByStudent)) {
            cogProfileByStudent[row.student_id] = row;
          }
        }
        // vocab_readiness: one row per (student, standard) — collect all for each student
        type RawVocabRow = VocabReadinessRow & { student_id: string };
        for (const row of (vocabReadinessData ?? []) as unknown as RawVocabRow[]) {
          if (!vocabReadinessByStudent[row.student_id])
            vocabReadinessByStudent[row.student_id] = [];
          vocabReadinessByStudent[row.student_id].push(row);
        }
        for (const row of (fastProfileData ?? []) as unknown as FastRosterProfileRow[]) {
          if (!(row.student_id in fastProfileByStudent)) {
            fastProfileByStudent[row.student_id] = row;
          }
        }

        setStudentData(
          students.map((student) => ({
            student,
            progress: progressByStudent[student.id] ?? [],
            sessions: sessionsByStudent[student.id] ?? [],
            schemas: schemasByStudent[student.id] ?? [],
            cognitiveProfile: cogProfileByStudent[student.id] ?? null,
            vocabReadiness: vocabReadinessByStudent[student.id] ?? [],
            fastProfile: fastProfileByStudent[student.id] ?? null,
          }))
        );
      } catch (err) {
        console.error('[TeacherDashboard] load error:', err);
        setError('Failed to load dashboard data. Please refresh.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, role, authLoading]);

  // ── Derived stats ─────────────────────────────────────────────────────────────

  const studentsActive = studentData.length;
  const standardsMastered = studentData.reduce(
    (n, sd) => n + sd.progress.filter((p) => p.current_status === 'mastered').length,
    0
  );
  const inInterventionCount = studentData.filter((sd) =>
    sd.progress.some((p) => ['intervening', 'practicing'].includes(p.current_status))
  ).length;
  const needsAttentionCount = studentData.reduce(
    (n, sd) => n + sd.progress.filter((p) => p.teacher_flag === true).length,
    0
  );

  const stdIdToCode: Record<string, string> = {};
  for (const s of standards) stdIdToCode[s.id] = s.code;

  // ── Column grid ───────────────────────────────────────────────────────────────

  const COL_GRID = '180px 150px 90px 1fr 1fr 1fr 80px';

  // ── Loading / error ───────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F8F9FA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.ui,
        }}
      >
        <p style={{ color: C.gray, fontSize: 14 }}>Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F8F9FA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.ui,
        }}
      >
        <p style={{ color: C.red, fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8F9FA',
        fontFamily: FONTS.ui,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TeacherNav
        teacherName={teacherName}
        school={teacherSchool}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 20px 40px',
          width: '100%',
          boxSizing: 'border-box' as const,
        }}
      >
        {/* ── Page header ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0 12px',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>
              Pilot Cohort — 9th Grade ELA
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
              {studentsActive} student{studentsActive !== 1 ? 's' : ''} · 3 standards · Q1 2026–27
              pilot
            </div>
          </div>
          {currentTime && (
            <div style={{ fontSize: 11, color: C.gray }}>Last updated: today · {currentTime}</div>
          )}
        </div>

        {/* ── Pilot workflow ── */}
        <section
          style={{
            background: C.white,
            border: `0.5px solid ${C.border}`,
            borderRadius: 10,
            marginBottom: 16,
            padding: 14,
          }}
        >
          <div
            style={{
              alignItems: 'flex-start',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div>
              <div
                style={{
                  color: C.blue,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: 'uppercase' as const,
                }}
              >
                Pilot workflow
              </div>
              <div style={{ color: C.dark, fontSize: 15, fontWeight: 800, marginTop: 3 }}>
                Start with FAST evidence, then build the daily work.
              </div>
            </div>
            <div style={{ color: C.gray, fontSize: 11, lineHeight: 1.45, maxWidth: 340 }}>
              Use this strip as the teacher path. Admin tools stay available, but the pilot should
              move left to right.
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            }}
          >
            <TeacherWorkflowCard
              label="Step 1"
              title="Upload FAST"
              detail="Add the student ISR so GOGI can see the starting point."
              href="/teacher-dashboard/fast-upload"
              color={C.blue}
            />
            <TeacherWorkflowCard
              label="Step 2"
              title="Check the plan"
              detail="Open the roster and see each student’s next standard."
              href="/dashboard/teacher"
              color={C.green}
            />
            <TeacherWorkflowCard
              label="Step 3"
              title="Prepare content"
              detail="Confirm official texts, mined excerpts, and source gaps."
              href="/admin/gutenberg-library"
              color={C.amber}
            />
            <TeacherWorkflowCard
              label="Step 4"
              title="Plan tomorrow"
              detail="Pick a standard and get the clearest text, excerpt, and lesson flow."
              href="/teacher-dashboard/plan-tomorrow"
              color={C.red}
            />
          </div>
        </section>

        {/* ── Stats row ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <StatCard
            value={studentsActive}
            label="Students Active"
            color={C.navy}
            sub="Pilot cohort"
          />
          <StatCard
            value={standardsMastered}
            label="Standards Mastered"
            color={C.green}
            sub="Across all students"
          />
          <StatCard
            value={inInterventionCount}
            label="In Intervention"
            color={C.amber}
            sub="Active remediation"
          />
          <StatCard
            value={needsAttentionCount}
            label="Needs Attention"
            color={C.red}
            sub="Teacher review required"
          />
        </div>

        {/* ── Roster table ── */}
        <div
          style={{
            background: C.white,
            border: `0.5px solid ${C.border}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: COL_GRID,
              background: '#F8F8F8',
              borderBottom: `1px solid ${C.border}`,
              padding: '8px 14px',
              gap: 8,
            }}
          >
            {[
              'Student',
              'FAST',
              'Pre-Lit',
              'ELA.9.R.1.1',
              'ELA.9.R.1.2',
              'ELA.9.R.2.1',
              'Flags',
            ].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.gray,
                  textTransform: 'uppercase' as const,
                  letterSpacing: 1,
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Empty state */}
          {studentData.length === 0 && (
            <div
              style={{
                padding: '32px 14px',
                textAlign: 'center' as const,
                color: C.gray,
                fontSize: 13,
              }}
            >
              No students found for this cohort. Add students via Supabase with teacher_id ={' '}
              {user?.id}.
            </div>
          )}

          {/* Student rows */}
          {studentData.map((sd) => {
            const isExpanded = expandedStudentId === sd.student.id;
            const hasFlag = sd.progress.some((p) => p.teacher_flag === true);

            const progressByStd: Record<string, ProgressRow> = {};
            for (const p of sd.progress) progressByStd[p.standard_id] = p;

            return (
              <div key={sd.student.id}>
                {/* Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: COL_GRID,
                    padding: '10px 14px',
                    gap: 8,
                    borderBottom: `0.5px solid ${C.light}`,
                    cursor: 'pointer',
                    alignItems: 'center',
                    background: isExpanded ? 'rgba(31,78,121,0.04)' : C.white,
                    transition: 'background 0.1s',
                  }}
                  onClick={() => setExpandedStudentId(isExpanded ? null : sd.student.id)}
                  onMouseEnter={(e) => {
                    if (!isExpanded)
                      (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA';
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = C.white;
                  }}
                >
                  {/* Student */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>
                      {sd.student.full_name}
                    </div>
                    <div style={{ fontSize: 10, color: C.gray }}>9th · Period 3</div>
                  </div>

                  {/* FAST evidence */}
                  <div>
                    {sd.fastProfile ? (
                      <div style={{ marginBottom: 5 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>
                          {latestFastAssessment(sd.fastProfile)?.test_reason ?? 'FAST'} ·{' '}
                          {latestFastAssessment(sd.fastProfile)?.scale_score ?? '—'}
                        </div>
                        <div style={{ fontSize: 9, color: C.gray, lineHeight: 1.35 }}>
                          Level {sd.fastProfile.current_achievement_level ?? '—'} ·{' '}
                          {sd.fastProfile.points_to_next_rung ?? '—'} pts to{' '}
                          {sd.fastProfile.next_rung_target ?? 'next rung'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 5 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: C.gray }}>
                          No FAST yet
                        </div>
                        <div style={{ fontSize: 9, color: C.gray }}>Upload ISR PDF</div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          sd.fastProfile
                            ? `/teacher-dashboard/students/${sd.student.id}/fast`
                            : `/teacher-dashboard/fast-upload?student=${sd.student.id}`
                        );
                      }}
                      style={{
                        background: sd.fastProfile ? C.blueLight : C.greenLight,
                        border: `1px solid ${sd.fastProfile ? C.blue : C.green}`,
                        borderRadius: 5,
                        color: sd.fastProfile ? C.blue : C.green,
                        cursor: 'pointer',
                        fontFamily: FONTS.ui,
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '4px 8px',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {sd.fastProfile ? 'View FAST' : 'Upload FAST'}
                    </button>
                  </div>

                  {/* Pre-lit (placeholder) */}
                  <div style={{ fontSize: 10, color: C.gray }}>—</div>

                  {/* Standard columns */}
                  {standards.map((std) => {
                    const prog = progressByStd[std.id];
                    const latestS = sd.sessions.find((s) => s.standard_id === std.id);
                    const curStatus = prog?.current_status ?? latestS?.phase ?? null;
                    const cfg = statusCfg(curStatus, prog?.teacher_flag);
                    const passed = prog?.sessions_passed ?? 0;
                    const cls = latestS?.dominant_classification;

                    let subText = '';
                    if (prog?.current_status === 'mastered') {
                      subText = `${passed}/3 sessions · ${fmtDate(prog.mastered_at)}`;
                    } else if (
                      prog?.current_status === 'intervening' ||
                      prog?.current_status === 'practicing'
                    ) {
                      subText = `${clsLabel(cls)} · Sess ${prog.sessions_attempted}/3`;
                    } else if (curStatus === 'diagnostic') {
                      subText = 'In diagnostic';
                    } else if (prog?.teacher_flag) {
                      subText = `Reclassified ${prog.failed_turns ?? 0}×`;
                    }

                    return (
                      <div key={std.id}>
                        <StatusBadge currentStatus={curStatus} teacherFlag={prog?.teacher_flag} />
                        {subText && (
                          <div
                            style={{ fontSize: 10, color: cfg.text, marginTop: 3, lineHeight: 1.3 }}
                          >
                            {subText}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Flags */}
                  <div>
                    {hasFlag ? (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: C.redLight,
                          border: `1px solid ${C.red}`,
                          color: C.red,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        !
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: C.border }}>—</span>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 14px', borderBottom: `0.5px solid ${C.light}` }}>
                    <StudentDetailPanel
                      sd={sd}
                      standards={standards}
                      onClose={() => setExpandedStudentId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
