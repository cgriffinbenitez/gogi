'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS, STANDARDS, POWER_STATEMENTS } from '@/lib/constants/design';

// ─── Stats helpers ────────────────────────────────────────────────────────────

function calculateStreak(sessions: { mastery_achieved: boolean | null }[]): number {
  let streak = 0;
  for (const s of sessions) {
    if (s.mastery_achieved) streak++;
    else break;
  }
  return streak;
}

function avgMinutes(sessions: { time_spent_seconds: number | null }[]): number {
  const valid = sessions.filter((s) => s.time_spent_seconds && s.time_spent_seconds > 0);
  if (!valid.length) return 0;
  const avg = valid.reduce((sum, s) => sum + (s.time_spent_seconds ?? 0), 0) / valid.length;
  return Math.round(avg / 60);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.white, lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: C.blueMid,
          marginTop: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MasteryPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  const powerStatement = POWER_STATEMENTS[standardCode] ?? '';

  // Stats
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [avgTime, setAvgTime] = useState<number>(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function init() {
      try {
        const supabase = createClient();

        // Student
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();
        if (!student?.id) return;

        // Standard UUID
        const { data: std } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();
        if (!std?.id) return;

        // ── Stats ─────────────────────────────────────────────────────────────
        const { data: sessions } = await supabase
          .from('sessions')
          .select('mastery_achieved, time_spent_seconds')
          .eq('student_id', student.id)
          .eq('standard_id', std.id)
          .order('started_at', { ascending: false });

        const { count: responseCount } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', student.id)
          .eq('standard_id', std.id);

        setSessionCount(sessions?.length ?? 0);
        setTotalAttempts(responseCount ?? 0);
        setStreak(calculateStreak(sessions ?? []));
        setAvgTime(avgMinutes(sessions ?? []));
      } catch (err) {
        console.error('[Mastery] init error:', err);
      }
    }

    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: C.navy,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: '32px 20px',
        fontFamily: FONTS.ui,
      }}
    >
      {/* 1 — Standard label */}
      <div
        style={{
          fontSize: 10,
          color: C.blueMid,
          textTransform: 'uppercase',
          letterSpacing: 2,
          fontWeight: 700,
        }}
      >
        {standardCode}  |  COMPLETE
      </div>

      {/* 2 — Gogi avatar (celebrate = green) */}
      <GogiAvatar size={100} state="celebrate" />

      {/* 3 — MASTERED */}
      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          color: C.white,
          fontFamily: FONTS.ui,
          letterSpacing: -1,
          marginTop: 4,
        }}
      >
        MASTERED
      </div>

      {/* 4 — Standard title */}
      <div style={{ fontSize: 14, color: C.blueMid }}>
        {standard?.title ?? standardCode}
      </div>

      {/* 5 — Badge card */}
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${C.greenBorder}`,
          borderRadius: 12,
          padding: '12px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: C.greenBorder,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          {standard?.short ?? standardCode} BADGE EARNED
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: C.greenBorder,
              }}
            />
          ))}
        </div>
      </div>

      {/* 6 — Power statement */}
      {powerStatement && (
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${C.darkBorder}`,
            borderRadius: 12,
            padding: '16px 22px',
            textAlign: 'center',
            maxWidth: 340,
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: C.white,
              fontStyle: 'italic',
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {powerStatement}
          </p>
        </div>
      )}

      {/* 7 — Stats row */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Stat value={sessionCount} label="Sessions" />
        <Stat value={totalAttempts} label="Total attempts" />
        <Stat value={streak} label="Current streak" />
        {avgTime > 0 && <Stat value={`${avgTime}m`} label="Avg session time" />}
      </div>

      {/* 8 — DB write note */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: `0.5px solid ${C.darkBorder}`,
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 10,
          color: C.blueMid,
          textAlign: 'center',
          maxWidth: 360,
        }}
      >
        sessions.mastery_achieved = true  |  maintenance queue scheduled  |  badge unlocked on dashboard
      </div>

      {/* 9 — Keep Going button */}
      <button
        onClick={() => router.push('/dashboard/student')}
        style={{
          background: C.blue,
          color: C.white,
          border: 'none',
          borderRadius: 10,
          padding: '13px 52px',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: FONTS.ui,
        }}
      >
        Keep Going  →
      </button>
    </div>
  );
}
