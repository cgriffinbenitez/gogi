'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { callClaude } from '@/lib/callClaude';
import GogiAvatar from '@/components/GogiAvatar';
import { renderMarkdown } from '@/lib/renderMarkdown';
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
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TeachView = 'loading' | 'error' | 'protocol' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5';

interface ConversationMessage {
  role: 'gogi' | 'student';
  text: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePassageFromContent(content: string): string {
  return content
    .replace(/\nCORRECT:\s*[A-D][^\n]*/gi, '')
    .replace(/^CORRECT:\s*[A-D][^\n]*/gim, '')
    .replace(/^[A-D][.)]\s+.+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


function historyString(messages: ConversationMessage[]): string {
  return messages
    .map((m) => `${m.role === 'gogi' ? 'Gogi' : 'Student'}: ${m.text}`)
    .join('\n');
}

function renderGogiMessage(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-1" />;
    if (trimmed.startsWith('_') && trimmed.endsWith('_') && trimmed.length > 2) {
      return (
        <p key={i} className="text-slate-400 text-xs mt-2 leading-relaxed italic">
          {trimmed.slice(1, -1)}
        </p>
      );
    }
    return (
      <p key={i} className="text-sm leading-relaxed">
        {line}
      </p>
    );
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SpinnerBlock({ color = 'violet', label }: { color?: string; label: string }) {
  const ringColor =
    color === 'blue'
      ? 'border-blue-500'
      : color === 'amber'
        ? 'border-amber-500'
        : color === 'emerald'
          ? 'border-emerald-500'
          : 'border-violet-500';
  const textColor =
    color === 'blue'
      ? 'text-blue-300'
      : color === 'amber'
        ? 'text-amber-300'
        : color === 'emerald'
          ? 'text-emerald-300'
          : 'text-violet-300';
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center">
      <div
        className={`w-8 h-8 rounded-full border-2 ${ringColor} border-t-transparent animate-spin mb-4`}
      />
      <p className={`${textColor} text-sm`}>{label}</p>
    </div>
  );
}

function GogiTyping() {
  return (
    <div className="flex items-start gap-2">
      <GogiAvatar size="sm" />
      <div className="bg-blue-50 text-slate-900 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachSession() {
  const router = useRouter();
  const params = useParams<{ standardId: string }>();
  const standardId = params.standardId;

  const [view, setView] = useState<TeachView>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Loaded from Supabase
  const [studentId, setStudentId] = useState('');
  const [teachSessionId, setTeachSessionId] = useState('');
  const [standardCode, setStandardCode] = useState('');
  const [standardTitle, setStandardTitle] = useState('');
  const [diagnosticClassification, setDiagnosticClassification] = useState('');
  const [diagnosticStudentResponse, setDiagnosticStudentResponse] = useState('');
  const [diagnosticPassage, setDiagnosticPassage] = useState('');
  const [step3PassageId, setStep3PassageId] = useState('');
  const [loadedProtocol, setLoadedProtocol] = useState<Protocol | null>(null);
  const [reclassifiedProtocolName, setReclassifiedProtocolName] = useState<string | null>(null);

  // Step 1 & 2 — Claude content
  const [claudeContent, setClaudeContent] = useState('');
  const [claudeLoading, setClaudeLoading] = useState(false);

  // Step 3 — Guided Conversation
  const [step3OrientationText, setStep3OrientationText] = useState('');
  const [step3OrientationSeen, setStep3OrientationSeen] = useState(false);
  const [step3Messages, setStep3Messages] = useState<ConversationMessage[]>([]);
  const [step3Input, setStep3Input] = useState('');
  const [step3StudentTurns, setStep3StudentTurns] = useState(0);
  const [step3Sending, setStep3Sending] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [step3Mastered, setStep3Mastered] = useState(false);
  const step3ScrollRef = useRef<HTMLDivElement>(null);
  const step3InputRef = useRef<HTMLTextAreaElement>(null);

  // Step 4 — Independent Conversation
  const [step4Passage, setStep4Passage] = useState('');
  const [step4PassageLoaded, setStep4PassageLoaded] = useState(false);
  const [step4Messages, setStep4Messages] = useState<ConversationMessage[]>([]);
  const [step4Input, setStep4Input] = useState('');
  const [step4StudentTurns, setStep4StudentTurns] = useState(0);
  const [step4Sending, setStep4Sending] = useState(false);
  const [step4Done, setStep4Done] = useState(false);
  const [step4Mastered, setStep4Mastered] = useState(false);
  const step4ScrollRef = useRef<HTMLDivElement>(null);
  const step4InputRef = useRef<HTMLTextAreaElement>(null);
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

        // Get most recent wrong response for this student + standard
        const { data: wrongResponse } = await supabase
          .from('responses')
          .select('diagnostic_classification, student_response, question_id, cognitive_skill_targeted')
          .eq('student_id', student.id)
          .eq('standard_id', standardId)
          .eq('mastery_achieved', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let classification = '';
        let studentResp = '';
        let passage = '';

        if (wrongResponse) {
          classification =
            wrongResponse.diagnostic_classification ||
            wrongResponse.cognitive_skill_targeted ||
            `applying the core reasoning skill for ${standard.title}`;
          studentResp = wrongResponse.student_response || '';
          setDiagnosticClassification(classification);
          setDiagnosticStudentResponse(studentResp);

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
        } else {
          classification = `applying the core reasoning skill for ${standard.title}`;
          setDiagnosticClassification(classification);
        }

        setDiagnosticPassage(passage);

        // Fetch intervention passage from questions table
        const { data: interventionPassage } = await supabase
          .from('questions')
          .select('id, content')
          .eq('standard_id', standardId)
          .gt('difficulty_level', 0)
          .limit(1)
          .maybeSingle()

        if (interventionPassage?.content) {
          setDiagnosticPassage(interventionPassage.content)
          setStep3PassageId(interventionPassage.id)
        }

        // Create teach session
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

        // Transition to step 1 and load explanation
        if (standard.code !== 'ELA.9.R.1.2') {
          setView('step1');
          setClaudeLoading(true);
          try {
            const text = await callClaude('explanation', {
              standardCode: standard.code,
              standardTitle: standard.title,
              diagnosticClassification: classification,
              studentResponse: studentResp || 'no response recorded',
            });
            setClaudeContent(text);
          } catch (err) {
            console.error('[TeachSession] Step 1 Claude error:', err);
            setClaudeContent(
              'We had trouble loading your personalized explanation right now. Please continue — your teacher can review your progress.',
            );
          } finally {
            setClaudeLoading(false);
          }
        }
      } catch (err) {
        console.error('[TeachSession] Init error:', err);
        setErrorMsg('Something went wrong. Please refresh and try again.');
        setView('error');
      }
    }

    init();
  }, [standardId, router]);

  // ─── Scroll to bottom on new messages ─────────────────────────────────────

  useEffect(() => {
    if (step3ScrollRef.current) {
      step3ScrollRef.current.scrollTop = step3ScrollRef.current.scrollHeight;
    }
  }, [step3Messages, step3Sending]);

  useEffect(() => {
    if (step4ScrollRef.current) {
      step4ScrollRef.current.scrollTop = step4ScrollRef.current.scrollHeight;
    }
  }, [step4Messages, step4Sending]);

  // ─── Step Transitions ──────────────────────────────────────────────────────

  const goToStep2 = useCallback(async () => {
    setView('step2');
    setClaudeContent('');
    setClaudeLoading(true);
    try {
      const text = await callClaude('worked_example', {
        standardCode,
        standardTitle,
      });
      setClaudeContent(text);
    } catch (err) {
      console.error('[TeachSession] Step 2 Claude error:', err);
      setClaudeContent(
        'We had trouble loading the worked example. Your teacher can assist. Please continue when ready.',
      );
    } finally {
      setClaudeLoading(false);
    }
  }, [standardCode, standardTitle]);

  const goToStep3 = useCallback(async () => {
    setView('step3');
    setStep3OrientationText('');
    setStep3OrientationSeen(false);
    setStep3Messages([]);
    setStep3Input('');
    setStep3StudentTurns(0);
    setStep3Sending(false);
    setStep3Done(false);
    setStep3Mastered(false);

    setClaudeLoading(true);
    try {
      let passageText = diagnosticPassage;
      if (!passageText) {
        // Try the questions table for a seeded intervention passage first
        const { data: passageData, error: passageError } = await supabase
          .from('questions')
          .select('*')
          .eq('standard_id', standardId)
          .gt('difficulty_level', 0)
          .limit(1)
          .single()

        console.log('PASSAGE FETCH:', {
          standardId,
          passageData: passageData?.content?.substring(0, 80),
          passageError
        })

        if (passageData) {
          passageText = passageData.content;
          setStep3PassageId(passageData.id);
        } else {
          passageText = await callClaude('generate_guided_passage', {
            standardCode,
            standardTitle,
          });
        }
        setDiagnosticPassage(passageText);
      }

      const orientationText = await callClaude('generate_orientation', {
        standardCode,
        standardTitle,
        diagnosticClassification,
        passageText,
      });
      setStep3OrientationText(orientationText);
    } catch (err) {
      console.error('[TeachSession] Step 3 orientation error:', err);
      setStep3OrientationText(
        "We are going to find what this text is really telling us — something the author never directly says out loud. That skill is called inferencing — reading what an author implies but never directly states. It is one of the most powerful reading skills there is. I am going to ask you three questions. Each one is a clue. By the end you are going to have the answer and the proof. Let's find it.",
      );
    } finally {
      setClaudeLoading(false);
    }
  }, [standardCode, standardTitle, diagnosticClassification, diagnosticPassage]);

  const handleStep3Continue = useCallback(async () => {
    setClaudeLoading(true);
    try {
      const turn1Text = await callClaude('generate_conversation_turn', {
        standardCode,
        standardTitle,
        diagnosticClassification,
        passageText: diagnosticPassage,
        conversationHistory: '',
        turnNumber: '1',
        isIndependent: 'false',
      });
      setStep3Messages([{ role: 'gogi', text: turn1Text }]);
      setStep3OrientationSeen(true);
    } catch (err) {
      console.error('[TeachSession] Step 3 Turn 1 error:', err);
      setStep3Messages([
        {
          role: 'gogi',
          text: "Let's work through this together. Read the passage and tell me what you notice about what's happening beneath the surface.",
        },
      ]);
      setStep3OrientationSeen(true);
    } finally {
      setClaudeLoading(false);
    }
  }, [standardCode, standardTitle, diagnosticClassification, diagnosticPassage]);

  const goToStep4 = useCallback(async () => {
    setView('step4');
    setStep4PassageLoaded(false);
    setStep4Passage('');
    setStep4Messages([]);
    setStep4Input('');
    setStep4StudentTurns(0);
    setStep4Sending(false);
    setStep4Done(false);
    setStep4Mastered(false);
    setClaudeLoading(true);

    try {
      // Try the questions table for a seeded intervention passage, different from step 3
      let dbQuery = supabase
        .from('questions')
        .select('id, content')
        .eq('standard_id', standardId)
        .eq('difficulty_level', 1);

      if (step3PassageId) {
        dbQuery = dbQuery.neq('id', step3PassageId);
      }

      const { data: dbPassage } = await dbQuery.limit(1).maybeSingle();

      let passage: string;
      if (dbPassage?.content) {
        passage = dbPassage.content;
      } else {
        const text = await callClaude('generate_independent_passage', {
          standardCode,
          standardTitle,
        });
        const passageMatch = text.match(/\*\*Passage:\*\*\s*([\s\S]+?)(?=\n\n\*\*Question:\*\*|$)/);
        passage = passageMatch?.[1]?.trim() || text;
      }

      setStep4Passage(passage);
      setStep4PassageLoaded(true);

      const turn1Text = await callClaude('generate_conversation_turn', {
        standardCode,
        standardTitle,
        diagnosticClassification,
        passageText: passage,
        conversationHistory: '',
        turnNumber: '1',
        isIndependent: 'true',
      });
      setStep4Messages([{ role: 'gogi', text: turn1Text }]);
    } catch (err) {
      console.error('[TeachSession] Step 4 init error:', err);
      setStep4Passage(
        'A passage could not be generated at this time. Please ask your teacher for assistance.',
      );
      setStep4PassageLoaded(true);
      setStep4Messages([
        {
          role: 'gogi',
          text: "New passage. No hints this time. Read it and tell me what you think is really going on underneath the surface.",
        },
      ]);
    } finally {
      setClaudeLoading(false);
    }
  }, [standardCode, standardTitle, diagnosticClassification, standardId, step3PassageId]);

  const goToStep5 = useCallback(async () => {
    setView('step5');
    try {
      await supabase
        .from('sessions')
        .update({
          mastery_achieved: true,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', teachSessionId);
    } catch (err) {
      console.error('[TeachSession] Step 5 session update error:', err);
    }
    setTimeout(() => {
      router.push(`/student-reassess/${standardId}`);
    }, 3000);
  }, [teachSessionId, standardId, router]);

  // ─── Step 3 — Conversation Handler ────────────────────────────────────────

  const handleStep3Send = useCallback(async () => {
    const text = step3Input.trim();
    if (!text || step3Sending || step3Done) return;

    const newStudentTurns = step3StudentTurns + 1;
    const updatedMessages: ConversationMessage[] = [
      ...step3Messages,
      { role: 'student', text },
    ];

    setStep3Messages(updatedMessages);
    setStep3Input('');
    setStep3StudentTurns(newStudentTurns);
    setStep3Sending(true);

    const history = historyString(updatedMessages);

    try {
      if (newStudentTurns >= 3) {
        // Evaluate mastery
        const evalText = await callClaude('evaluate_conversation_mastery', {
          standardCode,
          standardTitle,
          diagnosticClassification,
          passageText: diagnosticPassage,
          conversationHistory: history,
        });

        const mastered = evalText.startsWith('MASTERY: YES');
        const feedbackText = evalText.replace(/^MASTERY:\s*(YES|NO)\n+/, '').trim();
        const finalMessages: ConversationMessage[] = [
          ...updatedMessages,
          { role: 'gogi', text: feedbackText },
        ];

        if (mastered || newStudentTurns >= 5) {
          setStep3Messages(finalMessages);
          setStep3Mastered(mastered);
          setStep3Done(true);

          try {
            await supabase.from('responses').insert({
              session_id: teachSessionId,
              student_id: studentId,
              standard_id: standardId,
              intervention_type: 'guided_attempt',
              intervention_content: diagnosticPassage,
              student_response: JSON.stringify(finalMessages),
              mastery_achieved: mastered,
              attempt_number: 1,
              ai_feedback: feedbackText,
              diagnostic_classification: diagnosticClassification,
            });
          } catch (err) {
            console.error('[TeachSession] Step 3 save error:', err);
          }
        } else {
          // MASTERY: NO — follow-up question is embedded in feedbackText
          setStep3Messages(finalMessages);
        }
      } else {
        // Generate next Gogi turn
        const nextTurnNum = newStudentTurns + 1;
        const gogiText = await callClaude('generate_conversation_turn', {
          standardCode,
          standardTitle,
          diagnosticClassification,
          passageText: diagnosticPassage,
          conversationHistory: history,
          turnNumber: String(nextTurnNum),
          isIndependent: 'false',
        });
        setStep3Messages([...updatedMessages, { role: 'gogi', text: gogiText }]);
      }
    } catch (err) {
      console.error('[TeachSession] Step 3 send error:', err);
      setStep3Messages([
        ...updatedMessages,
        { role: 'gogi', text: "Good thinking. Keep going — what else do you notice in the passage?" },
      ]);
    } finally {
      setStep3Sending(false);
      step3InputRef.current?.focus();
    }
  }, [
    step3Input,
    step3StudentTurns,
    step3Sending,
    step3Done,
    step3Messages,
    standardCode,
    standardTitle,
    diagnosticClassification,
    diagnosticPassage,
    teachSessionId,
    studentId,
    standardId,
  ]);

  // ─── Step 4 — Conversation Handler ────────────────────────────────────────

  const handleStep4Send = useCallback(async () => {
    const text = step4Input.trim();
    if (!text || step4Sending || step4Done) return;

    const newStudentTurns = step4StudentTurns + 1;
    const updatedMessages: ConversationMessage[] = [
      ...step4Messages,
      { role: 'student', text },
    ];

    setStep4Messages(updatedMessages);
    setStep4Input('');
    setStep4StudentTurns(newStudentTurns);
    setStep4Sending(true);

    const history = historyString(updatedMessages);

    try {
      if (newStudentTurns >= 3) {
        const evalText = await callClaude('evaluate_conversation_mastery', {
          standardCode,
          standardTitle,
          diagnosticClassification,
          passageText: step4Passage,
          conversationHistory: history,
        });

        const mastered = evalText.startsWith('MASTERY: YES');
        const feedbackText = evalText.replace(/^MASTERY:\s*(YES|NO)\n+/, '').trim();
        const finalMessages: ConversationMessage[] = [
          ...updatedMessages,
          { role: 'gogi', text: feedbackText },
        ];

        if (mastered || newStudentTurns >= 5) {
          setStep4Messages(finalMessages);
          setStep4Mastered(mastered);
          setStep4Done(true);

          try {
            await supabase.from('responses').insert({
              session_id: teachSessionId,
              student_id: studentId,
              standard_id: standardId,
              intervention_type: 'independent_attempt',
              intervention_content: step4Passage,
              student_response: JSON.stringify(finalMessages),
              mastery_achieved: mastered,
              attempt_number: 1,
              ai_feedback: feedbackText,
              diagnostic_classification: diagnosticClassification,
            });
          } catch (err) {
            console.error('[TeachSession] Step 4 save error:', err);
          }
        } else {
          setStep4Messages(finalMessages);
        }
      } else {
        const nextTurnNum = newStudentTurns + 1;
        const gogiText = await callClaude('generate_conversation_turn', {
          standardCode,
          standardTitle,
          diagnosticClassification,
          passageText: step4Passage,
          conversationHistory: history,
          turnNumber: String(nextTurnNum),
          isIndependent: 'true',
        });
        setStep4Messages([...updatedMessages, { role: 'gogi', text: gogiText }]);
      }
    } catch (err) {
      console.error('[TeachSession] Step 4 send error:', err);
      setStep4Messages([
        ...updatedMessages,
        { role: 'gogi', text: "You're on the right track. Go deeper — what does that tell you about what's really happening?" },
      ]);
    } finally {
      setStep4Sending(false);
      step4InputRef.current?.focus();
    }
  }, [
    step4Input,
    step4StudentTurns,
    step4Sending,
    step4Done,
    step4Messages,
    standardCode,
    standardTitle,
    diagnosticClassification,
    step4Passage,
    teachSessionId,
    studentId,
    standardId,
  ]);

  // ─── Keyboard Submit ──────────────────────────────────────────────────────

  const handleStep3KeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleStep3Send();
      }
    },
    [handleStep3Send],
  );

  const handleStep4KeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleStep4Send();
      }
    },
    [handleStep4Send],
  );

  // ─── Shared UI ────────────────────────────────────────────────────────────

  const STEP_LABELS = ['Explanation', 'Model', 'Guided', 'Independent', 'Complete'];
  const currentStepNum =
    view === 'step1'
      ? 1
      : view === 'step2'
        ? 2
        : view === 'step3'
          ? 3
          : view === 'step4'
            ? 4
            : view === 'step5'
              ? 5
              : 0;

  function Header() {
    return (
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-white tracking-tight">GOGI</span>
          <span className="text-violet-400 text-xs font-medium hidden sm:block">
            AI-Powered Literacy Platform
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-violet-400 font-mono">{standardCode}</span>
          <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30">
            Teach
          </span>
        </div>
      </header>
    );
  }

  function StepProgress() {
    return (
      <div className="px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-1">
          {STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            const isActive = currentStepNum === n;
            const isDone = currentStepNum > n;
            return (
              <React.Fragment key={label}>
                {idx > 0 && (
                  <div className={`h-px flex-1 ${isDone ? 'bg-emerald-500/60' : 'bg-white/10'}`} />
                )}
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    isActive
                      ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
                      : isDone
                        ? 'text-emerald-400'
                        : 'text-slate-600'
                  }`}
                >
                  <span>{isDone ? '✓' : n}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

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
    router.push(`/student-reassess/${standardId}`);
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  const protocolName = reclassifiedProtocolName ?? routeToProtocol(standardCode as StandardCode, diagnosticClassification)
  const protocol = PROTOCOL_MAP[protocolName]

  console.warn('BRANCH:', { standardCode, protocolName, passage: !!diagnosticPassage, session: !!teachSessionId, student: !!studentId })

  if (
    standardCode === 'ELA.9.R.1.2' &&
    protocol &&
    protocolName !== 'GenericTeach' &&
    !!diagnosticPassage &&
    !!teachSessionId &&
    !!studentId
  ) {
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

  if (view === 'step5') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-xl w-full text-center">
            <div className="text-6xl mb-6">🎯</div>
            <h1 className="text-white text-3xl font-extrabold mb-3">Intervention Complete</h1>
            <p className="text-violet-300 text-sm mb-2">
              {standardCode} — {standardTitle}
            </p>
            <p className="text-slate-300 text-sm leading-relaxed mb-8 max-w-md mx-auto">
              You worked through the skill. Now it&apos;s time to show what you know — on a completely
              new passage, with no scaffolds, no hints. Just you and the text.
            </p>
            <div className="bg-violet-900/20 border border-violet-500/20 rounded-2xl p-5">
              <p className="text-violet-300 text-sm">Taking you to your Reassessment…</p>
              <div className="mt-3 flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 1 — Explanation ─────────────────────────────────────────────────

  if (view === 'step1') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        <Header />
        <StepProgress />
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                🧠
              </div>
              <div>
                <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-0.5">
                  Step 1 of 5 — Explanation
                </div>
                <h1 className="text-white text-xl sm:text-2xl font-extrabold leading-tight">
                  What happened and what it means
                </h1>
              </div>
            </div>

            {claudeLoading ? (
              <SpinnerBlock color="violet" label="Analyzing your response…" />
            ) : (
              <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-6 mb-6">
                <div className="space-y-0.5">{renderMarkdown(claudeContent)}</div>
              </div>
            )}

            {!claudeLoading && (
              <div className="flex justify-end mt-6">
                <button
                  onClick={goToStep2}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-violet-500/30"
                >
                  <span>Ready to Continue</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 2 — Worked Example ──────────────────────────────────────────────

  if (view === 'step2') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        <Header />
        <StepProgress />
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                👁️
              </div>
              <div>
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-0.5">
                  Step 2 of 5 — Worked Example
                </div>
                <h1 className="text-white text-xl sm:text-2xl font-extrabold leading-tight">
                  Watch the thinking in action
                </h1>
              </div>
            </div>

            {claudeLoading ? (
              <SpinnerBlock color="blue" label="Building your worked example…" />
            ) : (
              <div className="bg-white/5 border border-blue-500/20 rounded-2xl p-6 mb-6">
                <div className="space-y-0.5">{renderMarkdown(claudeContent)}</div>
              </div>
            )}

            {!claudeLoading && (
              <div className="flex justify-end mt-6">
                <button
                  onClick={goToStep3}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-blue-500/30"
                >
                  <span>Continue</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 3 — Guided Conversation ────────────────────────────────────────

  if (view === 'step3') {
    const canSend = step3Input.trim().length > 0 && !step3Sending && !step3Done;

    return (
      <div className="h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col overflow-hidden">
        <Header />
        <StepProgress />

        {claudeLoading ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <SpinnerBlock color="amber" label={step3OrientationSeen ? "Generating your first question…" : "Setting up your guided session…"} />
          </div>
        ) : !step3OrientationSeen ? (
          <div className="flex-1 flex items-center justify-center px-4 py-8">
            <div className="max-w-xl w-full">
              <div className="flex items-start gap-3 mb-6">
                <GogiAvatar size="sm" />
                <div className="bg-blue-50 text-slate-900 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                  {renderGogiMessage(step3OrientationText)}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleStep3Continue}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded-xl text-sm transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-amber-500/30"
                >
                  <span>Continue</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* ── Left: Passage panel ── */}
            <div className="md:w-2/5 w-full flex-shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r border-white/10 p-4 md:p-6 max-h-40 md:max-h-none">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
                Step 3 of 5 — Guided Attempt
              </div>
              <h2 className="text-white font-extrabold text-lg mb-4 leading-tight">
                Your turn — with support
              </h2>
              {diagnosticPassage ? (
                <>
                  <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">
                    Passage
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                    {diagnosticPassage}
                  </p>
                </>
              ) : (
                <p className="text-slate-500 text-sm italic">
                  No passage was available from your diagnostic.
                </p>
              )}
            </div>

            {/* ── Right: Conversation panel ── */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Messages */}
              <div
                ref={step3ScrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              >
                {step3Messages.map((msg, i) =>
                  msg.role === 'gogi' ? (
                    <div key={i} className="flex items-start gap-2">
                      <GogiAvatar size="sm" />
                      <div className="bg-blue-50 text-slate-900 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] shadow-sm">
                        {renderGogiMessage(msg.text)}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-2 justify-end">
                      <div className="bg-blue-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] shadow-sm">
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ),
                )}
                {step3Sending && <GogiTyping />}
              </div>

              {/* Input area */}
              <div className="flex-shrink-0 border-t border-white/10 p-4">
                {step3Done ? (
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold uppercase tracking-widest ${
                        step3Mastered ? 'text-emerald-400' : 'text-violet-400'
                      }`}
                    >
                      {step3Mastered ? '✓ Mastery Demonstrated' : 'Session Complete'}
                    </span>
                    <button
                      onClick={goToStep4}
                      className={`font-bold py-2.5 px-6 rounded-xl text-sm transition-all flex items-center gap-2 ${
                        step3Mastered
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                          : 'bg-violet-600 hover:bg-violet-500 text-white'
                      }`}
                    >
                      Continue to Independent Attempt →
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3 items-end">
                    <textarea
                      ref={step3InputRef}
                      value={step3Input}
                      onChange={(e) => setStep3Input(e.target.value)}
                      onKeyDown={handleStep3KeyDown}
                      placeholder="Type your response… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      disabled={step3Sending || step3Done}
                      className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none transition-all disabled:opacity-50"
                    />
                    <button
                      onClick={handleStep3Send}
                      disabled={!canSend}
                      className="flex-shrink-0 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all"
                    >
                      {step3Sending ? (
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                      ) : (
                        'Send'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── STEP 4 — Independent Conversation ───────────────────────────────────

  if (view === 'step4') {
    const canSend = step4Input.trim().length > 0 && !step4Sending && !step4Done;

    return (
      <div className="h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col overflow-hidden">
        <Header />
        <StepProgress />

        {!step4PassageLoaded || claudeLoading ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <SpinnerBlock color="emerald" label="Generating your independent passage…" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* ── Left: Passage panel ── */}
            <div className="md:w-2/5 w-full flex-shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r border-white/10 p-4 md:p-6 max-h-40 md:max-h-none">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">
                Step 4 of 5 — Independent Attempt
              </div>
              <h2 className="text-white font-extrabold text-lg mb-4 leading-tight">
                No scaffolds. Just you.
              </h2>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">
                New Passage
              </div>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {step4Passage}
              </p>
            </div>

            {/* ── Right: Conversation panel ── */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Messages */}
              <div
                ref={step4ScrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              >
                {step4Messages.map((msg, i) =>
                  msg.role === 'gogi' ? (
                    <div key={i} className="flex items-start gap-2">
                      <GogiAvatar size="sm" />
                      <div className="bg-blue-50 text-slate-900 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] shadow-sm">
                        {renderGogiMessage(msg.text)}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-2 justify-end">
                      <div className="bg-blue-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] shadow-sm">
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ),
                )}
                {step4Sending && <GogiTyping />}
              </div>

              {/* Input area */}
              <div className="flex-shrink-0 border-t border-white/10 p-4">
                {step4Done ? (
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold uppercase tracking-widest ${
                        step4Mastered ? 'text-emerald-400' : 'text-violet-400'
                      }`}
                    >
                      {step4Mastered ? '✓ Mastery Demonstrated' : 'Session Complete'}
                    </span>
                    <button
                      onClick={
                        step4Mastered
                          ? goToStep5
                          : () => router.push(`/student-teach/${standardId}/simplified`)
                      }
                      className={`font-bold py-2.5 px-6 rounded-xl text-sm transition-all flex items-center gap-2 ${
                        step4Mastered
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                          : 'bg-violet-600 hover:bg-violet-500 text-white'
                      }`}
                    >
                      {step4Mastered ? 'Mastery Confirmed — Continue →' : 'Get Additional Support →'}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3 items-end">
                    <textarea
                      ref={step4InputRef}
                      value={step4Input}
                      onChange={(e) => setStep4Input(e.target.value)}
                      onKeyDown={handleStep4KeyDown}
                      placeholder="Type your response… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      disabled={step4Sending || step4Done}
                      className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none transition-all disabled:opacity-50"
                    />
                    <button
                      onClick={handleStep4Send}
                      disabled={!canSend}
                      className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all"
                    >
                      {step4Sending ? (
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                      ) : (
                        'Send'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
