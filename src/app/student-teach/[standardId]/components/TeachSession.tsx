'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProtocolEngine from '../protocol/ProtocolEngine';
import { routeToProtocol, type StandardCode } from '../protocol/ClassificationRouter';
import {
  ThemeConceptBuilding,
  ThemeHuntingStrategy,
  ConnotativeLanguage,
  AbstractionLadder,
  ThemeEvidenceMapping,
  LiteraryAnalysisParagraph,
} from '../protocol/protocols/ELA9R12Protocols';
import {
  WorkingMemoryOverload,
  ReadingStrategyFailure,
  SituationModelFailure,
  VocabularyGap,
} from '../protocol/protocols/ELA9R11Protocols';
import {
  DefaultListStrategy,
  ChunkingFailure,
  MainIdeaExtractionFailure,
  TextTypeDiscriminationFailure,
  SyntaxComprehensionFailure,
} from '../protocol/protocols/ELA9R21Protocols';
import type { Protocol } from '../protocol/types';

const PROTOCOL_MAP: Record<string, Protocol> = {
  // ELA.9.R.1.2 — Universal Themes
  ThemeConceptBuilding,
  ThemeHuntingStrategy,
  ConnotativeLanguage,
  AbstractionLadder,
  ThemeEvidenceMapping,
  LiteraryAnalysisParagraph,
  // ELA.9.R.1.1 — Inferencing and Textual Evidence
  WorkingMemoryOverload,
  ReadingStrategyFailure,
  SituationModelFailure,
  VocabularyGap,
  // ELA.9.R.2.1 — Text Structure and Purpose
  DefaultListStrategy,
  ChunkingFailure,
  MainIdeaExtractionFailure,
  TextTypeDiscriminationFailure,
  SyntaxComprehensionFailure,
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TeachView = 'loading' | 'error' | 'protocol';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePassageFromContent(content: string): string {
  return content
    .replace(/\nCORRECT:\s*[A-D][^\n]*/gi, '')
    .replace(/^CORRECT:\s*[A-D][^\n]*/gim, '')
    .replace(/^[A-D][.)]\s+.+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachSession() {
  const router = useRouter();
  const params = useParams<{ standardId: string }>();
  const standardId = params.standardId;

  const [view, setView] = useState<TeachView>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [studentId, setStudentId] = useState('');
  const [teachSessionId, setTeachSessionId] = useState('');
  const [standardCode, setStandardCode] = useState('');
  const [standardTitle, setStandardTitle] = useState('');
  const [diagnosticClassification, setDiagnosticClassification] = useState('');
  const [diagnosticPassage, setDiagnosticPassage] = useState('');
  const [reclassifiedProtocolName, setReclassifiedProtocolName] = useState<string | null>(null);

  const teachSessionStartRef = useRef<number>(0);

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!standardId) return;

    async function init() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/sign-up-login-screen');
          return;
        }

        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (studentError || !student) {
          setErrorMsg('Student profile not found. Please contact your teacher.');
          setView('error');
          return;
        }
        setStudentId(student.id);

        const { data: standard, error: standardError } = await supabase
          .from('standards')
          .select('code, title')
          .eq('id', standardId)
          .single();

        if (standardError || !standard) {
          setErrorMsg('Standard not found.');
          setView('error');
          return;
        }
        setStandardCode(standard.code);
        setStandardTitle(standard.title);

        // Most recent wrong response → classification + fallback passage
        const { data: wrongResponse } = await supabase
          .from('responses')
          .select('diagnostic_classification, question_id, cognitive_skill_targeted')
          .eq('student_id', student.id)
          .eq('standard_id', standardId)
          .eq('mastery_achieved', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let classification = '';
        let passage = '';

        if (wrongResponse) {
          classification =
            wrongResponse.diagnostic_classification ||
            wrongResponse.cognitive_skill_targeted ||
            '';

          if (wrongResponse.question_id) {
            const { data: question } = await supabase
              .from('questions')
              .select('content')
              .eq('id', wrongResponse.question_id)
              .single();

            if (question?.content) {
              passage = parsePassageFromContent(question.content);
            }
          }
        }

        setDiagnosticClassification(classification);

        // Prefer a seeded intervention passage over the stripped diagnostic passage
        const { data: interventionPassage } = await supabase
          .from('questions')
          .select('content')
          .eq('standard_id', standardId)
          .gt('difficulty_level', 0)
          .limit(1)
          .maybeSingle();

        if (interventionPassage?.content) {
          passage = interventionPassage.content;
        }

        setDiagnosticPassage(passage);

        // Create teach session row
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            student_id: student.id,
            standard_id: standardId,
            phase: 'teach',
            status: 'in_progress',
          })
          .select('id')
          .single();

        if (sessionError || !session) {
          setErrorMsg('Failed to start your session. Please try again.');
          setView('error');
          return;
        }

        setTeachSessionId(session.id);
        teachSessionStartRef.current = Date.now();
        setView('protocol');
      } catch (err) {
        console.error('[TeachSession] Init error:', err);
        setErrorMsg('Something went wrong. Please refresh and try again.');
        setView('error');
      }
    }

    init();
  }, [standardId, router]);

  // ─── Teach session completion ─────────────────────────────────────────────

  async function handleTeachComplete() {
    const timeSpent = teachSessionStartRef.current
      ? Math.floor((Date.now() - teachSessionStartRef.current) / 1000)
      : 0;
    if (teachSessionId) {
      try {
        await supabase
          .from('sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            time_spent_seconds: timeSpent,
          })
          .eq('id', teachSessionId);
      } catch (err) {
        console.error('[TeachSession] Failed to close teach session:', err);
      }
    }
    router.push(`/student-practice/${standardId}`);
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  const protocolName =
    reclassifiedProtocolName ??
    routeToProtocol(standardCode as StandardCode, diagnosticClassification);
  const protocol = PROTOCOL_MAP[protocolName];

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-violet-300 text-sm">Setting up your lesson…</p>
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-bold text-xl mb-2">Unable to Load Lesson</h2>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => router.push('/student-home')}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl text-sm transition-all duration-200"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  // GenericTeach — standard exists but has no protocol file yet
  if (protocolName === 'GenericTeach' || !protocol) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-4">
          <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center mx-auto mb-5">
              <span className="text-white text-xl font-extrabold leading-none select-none">G</span>
            </div>
            <h1 className="text-white text-xl font-extrabold mb-3 leading-tight">
              This standard is not yet available.
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              {standardCode ? `${standardCode} — ${standardTitle}` : 'This standard'} does not have
              a personalized lesson ready yet. Your teacher has been notified.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Talk to your teacher directly — they can work through this skill with you.
            </p>
          </div>
          <button
            onClick={() => router.push('/student-home')}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-lg hover:shadow-violet-500/30"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // All 3 pilot standards route here — ProtocolEngine handles the full 8-step flow
  return (
    <ProtocolEngine
      key={protocolName}
      protocol={protocol}
      studentId={studentId}
      standardId={standardId}
      sessionId={teachSessionId}
      passage={diagnosticPassage}
      onComplete={handleTeachComplete}
      onReclassify={(fallbackProtocol) => setReclassifiedProtocolName(fallbackProtocol)}
    />
  );
}
