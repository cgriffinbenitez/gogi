'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GogiNav } from '@/components/nav/GogiNav';
import { StandardTile } from '@/components/dashboard/StandardTile';
import { StreakCounter } from '@/components/dashboard/StreakCounter';
import { getStudentStandardStatus, type StandardStatusResult } from '@/lib/data/getStudentStandardStatus';
import { calculateStreak } from '@/lib/data/calculateStreak';
import { getActiveStandard } from '@/lib/data/getActiveStandard';
import { C, FONTS } from '@/lib/constants/design';
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

// ─── Pilot mode ───────────────────────────────────────────────────────────────
// Set PILOT_MODE = true to show only the R.1.1 card during the pilot launch.
// Flip to false to restore the full 3-standard view.

const PILOT_MODE         = true;
const PILOT_STANDARD_ID  = '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e';

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
            status:                      'notStarted' as const,
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
            gapsIdentified:              [],
            gapsAddressed:               [],
            currentGap:                  null,
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
        setActiveCard(null);

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
            gapsIdentified:              [],
            gapsAddressed:               [],
            currentGap:                  null,
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

  const { streak, richData, activeCode } = data;
  // Pilot mode: show only R.1.1; production: show all 3 standards
  const visibleStandards = PILOT_MODE
    ? standards.filter((s) => s.id === PILOT_STANDARD_ID)
    : standards;

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
          <div style={{
            fontSize:      10,
            fontWeight:    700,
            color:         C.gray,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom:  PILOT_MODE ? 2 : 8,
          }}>
            {PILOT_MODE ? 'YOUR SKILL — PILOT' : 'YOUR STANDARDS'}
          </div>
          {PILOT_MODE && visibleStandards[0] && (
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 8 }}>
              {visibleStandards[0].code} · Literary Elements &amp; Layers of Meaning
            </div>
          )}

          <div
            style={
              PILOT_MODE
                ? { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }
                : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'start', gap: 10 }
            }
            className="standards-grid"
          >
            {visibleStandards.map((s) => {
              const result = richData[s.code];
              const status = result?.status ?? 'notStarted';

              return (
                <div
                  key={s.id}
                  style={PILOT_MODE ? { width: '100%', maxWidth: 560 } : undefined}
                >
                  <StandardTile
                    standardId={s.code}
                    standardCode={s.code}
                    standardUuid={s.id}
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
                    phase={result?.phase                                ?? null}
                    vocabCheckComplete={result?.vocabCheckComplete      ?? false}
                    vocabCoverageScore={result?.vocabCoverageScore      ?? null}
                    gapsIdentified={result?.gapsIdentified              ?? []}
                    gapsAddressed={result?.gapsAddressed                ?? []}
                    currentGap={result?.currentGap                      ?? null}
                    profileComplete={profileComplete}
                    isOpen={activeCard === s.code}
                    onToggle={() =>
                      setActiveCard((prev) => (prev === s.code ? null : s.code))
                    }
                  />
                </div>
              );
            })}
          </div>
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
