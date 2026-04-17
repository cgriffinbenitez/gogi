'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GogiNav } from '@/components/nav/GogiNav';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { GogiBubble } from '@/components/gogi/GogiBubble';
import { StandardTile } from '@/components/dashboard/StandardTile';
import { StreakCounter } from '@/components/dashboard/StreakCounter';
import { getStudentStandardStatus, type StandardStatusResult } from '@/lib/data/getStudentStandardStatus';
import { calculateStreak } from '@/lib/data/calculateStreak';
import { getActiveStandard } from '@/lib/data/getActiveStandard';
import { getWelcomeMessage } from '@/lib/gogi/welcomeMessages';
import { C, FONTS, type StandardStatus } from '@/lib/constants/design';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Standard {
  id:    string;
  code:  string;
  title: string;
}

interface Props {
  studentId:   string;
  studentName: string;
  standards:   Standard[];
}

interface DashboardData {
  streak:      number;
  richData:    Record<string, StandardStatusResult>; // keyed by standard code
  activeCode:  string;
  activePhase: string;
}

// ─── Intervention route map ───────────────────────────────────────────────────

const INTERVENTION_ROUTES: Record<string, string> = {
  vocabulary_frayer:    'vocabulary',
  schema_building:      'schema',
  inferencing_scaffold: 'inferencing',
  evidence_organizer:   'evidence',
  synthesis_scaffold:   'synthesis',
  morphology_breakdown: 'morphology',
  strategy_card:        'strategy',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentDashboardContent({ studentId, studentName, standards }: Props) {
  const router = useRouter();
  const [data,            setData]            = useState<DashboardData | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [activeCard,      setActiveCard]      = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean>(false);

  // First name + last initial
  const nameParts   = studentName.trim().split(' ');
  const displayName =
    nameParts.length >= 2
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
      : nameParts[0];

  // ── Data load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!studentId || standards.length === 0) return;

    async function load() {
      try {
        const standardIds = standards.map((s) => s.id);

        const [streak, statusMap, activeStandard] = await Promise.all([
          calculateStreak(studentId),
          getStudentStandardStatus(studentId, standardIds),
          getActiveStandard(studentId),
        ]);

        // Resolve active standard UUID → code
        let activeCode = activeStandard?.standardId ?? 'ELA.9.R.1.1';
        const matchByUuid = standards.find((s) => s.id === activeCode);
        if (matchByUuid) activeCode = matchByUuid.code;

        // Flatten statusMap: keyed by standard code for easy lookup in render
        const richData: Record<string, StandardStatusResult> = {};
        standards.forEach((s) => {
          richData[s.code] = statusMap[s.id] ?? {
            standardId:                  s.id,
            status:                      'notStarted' as StandardStatus,
            currentStatus:               'not_started',
            sessionId:                   null,
            phase:                       null,
            sessionsPassed:              0,
            sessionsAttempted:           0,
            lastSessionAt:               null,
            diagnosticQuestionsAnswered: 0,
            diagnosticQuestionsTotal:    10,
            currentIntervention:         null,
            timeSpentMinutes:            0,
            skillGaps:                   [],
            vocabCheckComplete:          false,
            vocabCoverageScore:          null,
          };
        });

        // Reading profile completion — defensive: column may not exist yet
        try {
          const supabase = createClient();
          const { data: pData } = await supabase
            .from('students')
            .select('reading_profile_complete')
            .eq('id', studentId)
            .maybeSingle();
          setProfileComplete(pData?.reading_profile_complete ?? false);
        } catch {
          // Column not yet migrated — default false so card shows
        }

        setData({ streak, richData, activeCode, activePhase: activeStandard?.phase ?? 'diagnostic' });
        // Auto-open most active standard
        setActiveCard(activeCode);

      } catch (err) {
        console.error('[StudentDashboard] load error:', err);
        // Fail open
        const richData: Record<string, StandardStatusResult> = {};
        standards.forEach((s) => {
          richData[s.code] = {
            standardId:                  s.id,
            status:                      'notStarted',
            currentStatus:               'not_started',
            sessionId:                   null,
            phase:                       null,
            sessionsPassed:              0,
            sessionsAttempted:           0,
            lastSessionAt:               null,
            diagnosticQuestionsAnswered: 0,
            diagnosticQuestionsTotal:    10,
            currentIntervention:         null,
            timeSpentMinutes:            0,
            skillGaps:                   [],
            vocabCheckComplete:          false,
            vocabCoverageScore:          null,
          };
        });
        setData({ streak: 0, richData, activeCode: 'ELA.9.R.1.1', activePhase: 'diagnostic' });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [studentId, standards]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui }}>
        <GogiNav rightContent={`${displayName} | South Dade SHS`} showLogout />
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            minHeight:      'calc(100vh - 52px)',
          }}
        >
          <p style={{ color: C.gray, fontSize: 14 }}>Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const { streak, richData, activeCode, activePhase } = data;
  const statuses      = Object.fromEntries(standards.map((s) => [s.code, richData[s.code]?.status ?? 'notStarted']));
  const masteredCount = Object.values(statuses).filter((s) => s === 'mastered').length;

  // ── CTA route logic ────────────────────────────────────────────────────────

  function buildCTARoute(
    code:                string,
    status:              StandardStatus,
    currentIntervention: string | null,
  ): string {
    if (status === 'notStarted' || status === 'inDiagnostic') {
      return `/standard/${code}/diagnostic`;
    }
    if (status === 'inIntervention') {
      const route = currentIntervention
        ? (INTERVENTION_ROUTES[currentIntervention] ?? 'vocabulary')
        : 'vocabulary';
      return `/standard/${code}/teach/${route}`;
    }
    if (status === 'mastered') {
      // Route to next unmastered standard
      const next = standards.find((s) => statuses[s.code] !== 'mastered' && s.code !== code);
      return next ? `/standard/${next.code}/diagnostic` : `/standard/${code}/reassess`;
    }
    return `/standard/${code}/diagnostic`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui }}>
      <GogiNav
        rightContent={`${displayName} | Day ${streak} Streak | South Dade SHS`}
        showLogout
      />

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px' }}>

        {/* Section A: Streak */}
        <div style={{ marginBottom: 16 }}>
          <StreakCounter streak={streak} />
        </div>

        {/* Section A2: Reading Profile card — hidden once complete */}
        {!profileComplete && (
          <div style={{
            background:      C.redLight,
            border:          `1px solid ${C.red}`,
            borderRadius:    10,
            padding:         '12px 16px',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            marginBottom:    14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Icon circle */}
              <div style={{
                width:          44,
                height:         44,
                borderRadius:   '50%',
                background:     C.red,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       16,
                fontWeight:     800,
                color:          C.white,
                flexShrink:     0,
              }}>
                R
              </div>
              {/* Text block */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#791F1F' }}>
                  Complete your Reading Profile first
                </div>
                <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>
                  Takes 12 minutes · Do this before your first diagnostic · Helps GOGI support you correctly
                </div>
              </div>
            </div>
            {/* CTA */}
            <button
              onClick={() => router.push('/profile/reading')}
              style={{
                background:   C.red,
                color:        C.white,
                border:       'none',
                borderRadius: 8,
                padding:      '8px 16px',
                fontSize:     12,
                fontWeight:   700,
                cursor:       'pointer',
                fontFamily:   FONTS.ui,
                flexShrink:   0,
                marginLeft:   12,
                whiteSpace:   'nowrap',
              }}
            >
              Start Reading Profile →
            </button>
          </div>
        )}

        {/* Section B: Standards */}
        <div>
          <div
            style={{
              fontSize:      10,
              fontWeight:    700,
              color:         C.gray,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom:  8,
            }}
          >
            YOUR STANDARDS
          </div>

          <div
            style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              alignItems:          'start',   // cards grow independently
              gap:                 10,
            }}
            className="standards-grid"
          >
            {standards.map((s) => {
              const result = richData[s.code];
              const status = result?.status ?? 'notStarted';

              return (
                <StandardTile
                  key={s.id}
                  standardId={s.code}
                  standardCode={s.code}
                  title={s.title}
                  status={status}
                  sessionsPassed={result?.sessionsPassed              ?? 0}
                  sessionsAttempted={result?.sessionsAttempted        ?? 0}
                  currentIntervention={result?.currentIntervention    ?? null}
                  diagnosticQuestionsAnswered={result?.diagnosticQuestionsAnswered ?? 0}
                  diagnosticQuestionsTotal={result?.diagnosticQuestionsTotal    ?? 10}
                  timeSpentMinutes={result?.timeSpentMinutes          ?? 0}
                  skillGaps={result?.skillGaps                        ?? []}
                  lastSessionAt={result?.lastSessionAt                ?? null}
                  currentStatus={result?.currentStatus                ?? 'not_started'}
                  vocabCheckComplete={result?.vocabCheckComplete      ?? false}
                  vocabCoverageScore={result?.vocabCoverageScore      ?? null}
                  isOpen={activeCard === s.code}
                  onToggle={() =>
                    setActiveCard((prev) => (prev === s.code ? null : s.code))
                  }
                  onCTAClick={() =>
                    router.push(buildCTARoute(s.code, status, result?.currentIntervention ?? null))
                  }
                />
              );
            })}
          </div>
        </div>

        {/* Section C: Mastery summary */}
        <div style={{ marginTop: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 13, color: C.gray, marginBottom: 6 }}>
            Standards Mastered: {masteredCount} of 3
            {masteredCount === 0 && ' (pilot launch)'}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {standards.map((s) => {
              const isMastered = statuses[s.code] === 'mastered';
              return (
                <div
                  key={s.id}
                  title={s.code}
                  style={{
                    width:        10,
                    height:       10,
                    borderRadius: '50%',
                    background:   isMastered ? C.green : 'transparent',
                    border:       `1.5px solid ${isMastered ? C.green : C.border}`,
                    flexShrink:   0,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Section D: Gogi welcome row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 20 }}>
          <GogiAvatar size={36} state="neutral" />
          <GogiBubble state="neutral">
            {getWelcomeMessage(streak)}
          </GogiBubble>
        </div>

      </main>

      <style>{`
        @media (max-width: 768px) {
          .standards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
