'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GogiAvatar from '@/components/GogiAvatar';

// ─── Constants ────────────────────────────────────────────────────────────────

const PILOT_CODES = ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1'] as const;

const STANDARD_LABELS: Record<string, string> = {
  'ELA.9.R.1.1': 'Inferencing and Textual Evidence',
  'ELA.9.R.1.2': 'Universal Themes in Literary Texts',
  'ELA.9.R.2.1': 'Text Structure and Purpose',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type StandardStatus =
  | 'not_started'
  | 'in_diagnostic'
  | 'ready_to_learn'
  | 'in_teach'
  | 'ready_to_practice'
  | 'in_practice'
  | 'ready_to_reassess'
  | 'mastered'
  | 'needs_support';

interface DbSession {
  id: string;
  standard_id: string;
  phase: string;
  completed_at: string | null;
  mastery_achieved: boolean | null;
}

interface StandardCard {
  id: string;
  code: string;
  title: string;
  status: StandardStatus;
}

type PageView = 'loading' | 'error' | 'ready';

// ─── Status helpers ───────────────────────────────────────────────────────────

function deriveStatus(sessions: DbSession[]): StandardStatus {
  const diagSession = sessions.find(s => s.phase === 'diagnostic');
  const teachSession = sessions.find(s => s.phase === 'teach');
  const practiceSession = sessions.find(s => s.phase === 'practice');
  const reassessSession = sessions.find(s => s.phase === 'reassess');

  if (!diagSession) return 'not_started';
  if (!diagSession.completed_at) return 'in_diagnostic';

  if (!teachSession) return 'ready_to_learn';
  if (!teachSession.completed_at) return 'in_teach';

  if (!practiceSession) return 'ready_to_practice';
  if (!practiceSession.completed_at) return 'in_practice';

  if (!reassessSession) return 'ready_to_reassess';
  if (reassessSession.mastery_achieved === true) return 'mastered';
  if (reassessSession.mastery_achieved === false) return 'needs_support';

  return 'ready_to_reassess';
}

function getStatusLabel(status: StandardStatus): string {
  switch (status) {
    case 'not_started': return 'Not Started';
    case 'in_diagnostic': return 'In Progress';
    case 'ready_to_learn': return 'Ready to Learn';
    case 'in_teach': return 'In Progress';
    case 'ready_to_practice': return 'Ready to Practice';
    case 'in_practice': return 'In Progress';
    case 'ready_to_reassess': return 'Ready to Reassess';
    case 'mastered': return 'Mastered';
    case 'needs_support': return 'Needs Support';
  }
}

function getStatusBadgeClass(status: StandardStatus): string {
  switch (status) {
    case 'mastered':
      return 'bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/30';
    case 'needs_support':
      return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
    case 'in_diagnostic':
    case 'in_teach':
    case 'in_practice':
    case 'ready_to_learn':
    case 'ready_to_practice':
    case 'ready_to_reassess':
      return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'not_started':
    default:
      return 'bg-white/[0.06] text-[#4B5563] border border-white/[0.08]';
  }
}

function getCtaLabel(status: StandardStatus): string {
  switch (status) {
    case 'not_started': return 'Begin Diagnostic';
    case 'in_diagnostic': return 'Continue Diagnostic';
    case 'ready_to_learn': return 'Start Lesson';
    case 'in_teach': return 'Continue Lesson';
    case 'ready_to_practice': return 'Start Practice';
    case 'in_practice': return 'Continue Practice';
    case 'ready_to_reassess': return 'Start Reassessment';
    case 'mastered': return 'Complete';
    case 'needs_support': return 'Try Again';
  }
}

function getCtaRoute(status: StandardStatus, standardId: string): string | null {
  switch (status) {
    case 'not_started':
    case 'in_diagnostic':
      return '/student-diagnostic';
    case 'ready_to_learn':
    case 'in_teach':
    case 'needs_support':
      return `/student-teach/${standardId}`;
    case 'ready_to_practice':
    case 'in_practice':
      return `/student-practice/${standardId}`;
    case 'ready_to_reassess':
      return `/student-reassess/${standardId}`;
    case 'mastered':
      return null;
  }
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-3 w-24 bg-white/[0.08] rounded" />
          <div className="h-5 w-48 bg-white/[0.08] rounded" />
        </div>
        <div className="h-6 w-20 bg-white/[0.08] rounded-full" />
      </div>
      <div className="h-10 w-full bg-white/[0.08] rounded-xl mt-4" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentHomePage() {
  const router = useRouter();

  const [view, setView] = useState<PageView>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [firstName, setFirstName] = useState('');
  const [cards, setCards] = useState<StandardCard[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/sign-up-login-screen');
          return;
        }

        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id, full_name')
          .eq('user_id', user.id)
          .single();

        if (studentError || !student) {
          setErrorMsg('Student profile not found. Please contact your teacher.');
          setView('error');
          return;
        }

        const first = student.full_name?.split(' ')[0] ?? 'Student';
        setFirstName(first);

        const { data: standards, error: standardsError } = await supabase
          .from('standards')
          .select('id, code, title')
          .in('code', [...PILOT_CODES])
          .order('code');

        if (standardsError || !standards || standards.length === 0) {
          setErrorMsg('Standards not found. Please contact your administrator.');
          setView('error');
          return;
        }

        const standardIds = standards.map(s => s.id);

        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, standard_id, phase, completed_at, mastery_achieved')
          .eq('student_id', student.id)
          .in('standard_id', standardIds);

        if (sessionsError) {
          setErrorMsg('Could not load your progress. Please try again.');
          setView('error');
          return;
        }

        const sessionsByStandard: Record<string, DbSession[]> = {};
        for (const s of standards) {
          sessionsByStandard[s.id] = [];
        }
        for (const sess of (sessions ?? [])) {
          if (sessionsByStandard[sess.standard_id]) {
            sessionsByStandard[sess.standard_id].push(sess);
          }
        }

        const derivedCards: StandardCard[] = standards.map(s => ({
          id: s.id,
          code: s.code,
          title: STANDARD_LABELS[s.code] ?? s.title,
          status: deriveStatus(sessionsByStandard[s.id] ?? []),
        }));

        setCards(derivedCards);
        setView('ready');
      } catch {
        setErrorMsg('An unexpected error occurred. Please refresh and try again.');
        setView('error');
      }
    }

    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d0f12] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] flex-shrink-0">
        <span className="text-xl font-extrabold text-[#1D9E75] tracking-tight">GOGI</span>
        <div className="flex items-center gap-2.5">
          <span className="text-white font-semibold text-sm">{firstName || 'Student'}</span>
          <GogiAvatar size="sm" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col px-4 sm:px-6 py-8 max-w-2xl w-full mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-bold text-white leading-tight">
            {view === 'loading'
              ? 'Welcome back'
              : `Welcome back, ${firstName}.`}
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">Here is where you left off.</p>
        </div>

        {/* Error state */}
        {view === 'error' && (
          <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-6 text-center">
            <p className="text-white font-semibold text-sm mb-1">Something went wrong</p>
            <p className="text-[#4B5563] text-sm">{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-4 py-2.5 px-6 text-sm"
            >
              Reload
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {view === 'loading' && (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Standard cards */}
        {view === 'ready' && (
          <div className="space-y-4">
            {cards.map((card) => {
              const route = getCtaRoute(card.status, card.id);
              const isDisabled = card.status === 'mastered';
              const isMastered = card.status === 'mastered';

              return (
                <div
                  key={card.id}
                  className={`bg-white/[0.06] border rounded-2xl p-5 transition-colors duration-150 ${
                    isMastered
                      ? 'border-[#1D9E75]/20'
                      : 'border-white/[0.08] hover:border-white/[0.12]'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1D9E75] uppercase tracking-widest font-mono mb-1">
                        {card.code}
                      </p>
                      <h2 className="text-white font-semibold text-base leading-snug">
                        {card.title}
                      </h2>
                    </div>
                    <span
                      className={`badge text-xs font-semibold whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-full ${getStatusBadgeClass(card.status)}`}
                    >
                      {getStatusLabel(card.status)}
                    </span>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => { if (route) router.push(route); }}
                    disabled={isDisabled}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      isDisabled
                        ? 'bg-white/[0.06] border border-white/[0.08] text-[#4B5563] cursor-not-allowed'
                        : 'btn-primary'
                    }`}
                  >
                    {getCtaLabel(card.status)}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
