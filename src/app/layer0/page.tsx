'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, FONTS } from '@/lib/constants/design';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { standardCodeToRouteId } from '@/lib/fast/routing';
import {
  bandDsb,
  bandRtCv,
  bandSart,
  bandSdst,
  coefficientOfVariation,
  compositeFromBands,
  mean,
  type Layer0Scores,
} from '@/lib/layer0/scoring';

type Phase =
  | 'loading'
  | 'intro'
  | 'dsb_intro'
  | 'dsb_playing'
  | 'dsb_answer'
  | 'sart_intro'
  | 'sart_running'
  | 'sdst_intro'
  | 'sdst_running'
  | 'saving'
  | 'complete'
  | 'error';

type Layer0Trial = {
  task: 'dsb' | 'sart' | 'sdst';
  trial_index: number;
  stimulus: string;
  response: string | null;
  is_correct: boolean | null;
  rt_ms: number | null;
  is_target: boolean | null;
};

type Layer0RunMode = 'student' | 'demo' | 'research';

const DSB_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DSB_MAX_LENGTH = 8;
const SART_TRIALS = 225;
const DEMO_SART_TRIALS = 30;
const RESEARCH_SART_TRIALS = 90;
const SART_ON_MS = 250;
const SART_OFF_MS = 1000;
const SDST_SECONDS = 90;
const DEMO_SDST_SECONDS = 20;
const RESEARCH_SDST_SECONDS = 45;
const SDST_SYMBOLS = ['○', '△', '□', '◇', '☆', '⬡', '✚', '☰', '◎'];
const STUDENT_WIN_STANDARDS = new Set(['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1']);

export default function Layer0Page() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [studentName, setStudentName] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isDemoRun, setIsDemoRun] = useState(false);
  const [runMode, setRunMode] = useState<Layer0RunMode>('student');
  const [nextReadingWinRoute, setNextReadingWinRoute] = useState('');
  const [nextReadingWinLabel, setNextReadingWinLabel] = useState('your first reading move');
  const [scores, setScores] = useState<Layer0Scores | null>(null);
  const [errorMessage, setErrorMessage] = useState(
    'Layer 0 could not start. Tell your teacher before continuing.'
  );

  const [dsbLength, setDsbLength] = useState(2);
  const [dsbTrialInLength, setDsbTrialInLength] = useState(0);
  const [dsbSequence, setDsbSequence] = useState<string[]>([]);
  const [dsbInput, setDsbInput] = useState('');
  const dsbFailuresAtLength = useRef(0);
  const dsbMaxSpan = useRef(0);
  const dsbTotalCorrect = useRef(0);
  const dsbTrialIndex = useRef(0);

  const [sartDigit, setSartDigit] = useState('');
  const [sartIndex, setSartIndex] = useState(0);
  const [sartResponded, setSartResponded] = useState(false);
  const [sartProgress, setSartProgress] = useState(0);
  const sartTrials = useRef<Layer0Trial[]>([]);
  const sartCurrent = useRef<{
    digit: string;
    index: number;
    shownAt: number;
    isTarget: boolean;
    responded: boolean;
  } | null>(null);
  const sartTimer = useRef<number | null>(null);

  const sdstKey = useMemo(
    () => SDST_SYMBOLS.map((symbol, index) => ({ symbol, digit: String(index + 1) })),
    []
  );
  const [sdstSymbol, setSdstSymbol] = useState(SDST_SYMBOLS[0]);
  const [sdstTimeLeft, setSdstTimeLeft] = useState(SDST_SECONDS);
  const [sdstAttempted, setSdstAttempted] = useState(0);
  const [sdstLastKey, setSdstLastKey] = useState('');
  const sdstTrials = useRef<Layer0Trial[]>([]);
  const sdstCurrent = useRef<{
    symbol: string;
    index: number;
    shownAt: number;
    expected: string;
  } | null>(null);
  const sdstTimer = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function init() {
      try {
        const query = new URLSearchParams(window.location.search);
        const explicitDemoMode = query.get('demo') === '1';
        const storedDemoParticipantId = explicitDemoMode
          ? (window.localStorage.getItem('gogi_demo_participant_id') ?? '')
          : '';
        const demoParticipantId = query.get('demo_participant_id') ?? storedDemoParticipantId;
        const demoMode = explicitDemoMode || Boolean(query.get('demo_participant_id'));
        const requestedMode = query.get('mode') === 'research' ? 'research' : 'demo';
        const exitMode = query.get('exit') === '1';
        setIsDemoRun(demoMode);
        setRunMode(demoMode ? requestedMode : 'student');
        if (role === 'teacher' && !demoMode) {
          router.push('/dashboard/teacher');
          return;
        }
        const supabase = createClient();
        const { data: student } = await supabase
          .from('students')
          .select('id, full_name')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (!student?.id) {
          setPhase('error');
          return;
        }
        setStudentId(student.id);

        let administrationNumber = 1;

        if (exitMode && !demoMode) {
          const { data: entryAssessment } = await supabase
            .from('layer0_assessments')
            .select('id')
            .eq('student_id', student.id)
            .eq('administration_number', 1)
            .eq('status', 'completed')
            .maybeSingle();

          if (!entryAssessment?.id) {
            router.push('/layer0');
            return;
          }

          const { data: exitAssessment } = await supabase
            .from('layer0_assessments')
            .select('id, status')
            .eq('student_id', student.id)
            .eq('administration_number', 2)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (exitAssessment?.id && exitAssessment.status === 'completed') {
            router.push('/dashboard/student');
            return;
          }
          if (exitAssessment?.id) {
            setStudentName((student as { full_name?: string }).full_name ?? '');
            setAssessmentId(exitAssessment.id);
            setPhase('intro');
            return;
          }

          administrationNumber = 2;
        } else if (demoMode) {
          const { data: latest } = await supabase
            .from('layer0_assessments')
            .select('id, status, administration_number')
            .eq('student_id', student.id)
            .order('administration_number', { ascending: false })
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latest?.id && latest.status === 'in_progress') {
            await supabase
              .from('layer0_assessments')
              .update({ status: 'abandoned' })
              .eq('id', latest.id);
          }

          administrationNumber =
            ((latest as { administration_number?: number } | null)?.administration_number ?? 0) + 1;
        } else {
          const { data: existing } = await supabase
            .from('layer0_assessments')
            .select('id, status')
            .eq('student_id', student.id)
            .eq('administration_number', 1)
            .in('status', ['completed', 'in_progress'])
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing?.id && existing.status === 'completed') {
            router.push('/dashboard/student');
            return;
          }
          if (existing?.id) {
            setStudentName((student as { full_name?: string }).full_name ?? '');
            setAssessmentId(existing.id);
            setPhase('intro');
            return;
          }
        }

        const { data: created, error } = await supabase
          .from('layer0_assessments')
          .insert({
            student_id: student.id,
            administration_number: administrationNumber,
            status: 'in_progress',
            is_demo: demoMode,
            demo_participant_id: demoParticipantId || null,
          })
          .select('id')
          .single();

        if (error || !created?.id) {
          console.error('[Layer0] create assessment error:', error?.message);
          setErrorMessage(error?.message ?? 'Layer 0 could not create your assessment record.');
          setPhase('error');
          return;
        }

        await supabase
          .from('layer0_assessments')
          .update({ run_mode: demoMode ? requestedMode : 'student' })
          .eq('id', created.id);

        setStudentName((student as { full_name?: string }).full_name ?? '');
        setAssessmentId(created.id);
        setPhase('intro');
      } catch (err) {
        console.error('[Layer0] init error:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Layer 0 could not start.');
        setPhase('error');
      }
    }

    init();
  }, [authLoading, role, router, user]);

  useEffect(() => {
    return () => {
      if (sartTimer.current) window.clearTimeout(sartTimer.current);
      if (sdstTimer.current) window.clearInterval(sdstTimer.current);
    };
  }, []);

  function makeDigitSequence(length: number) {
    return Array.from({ length }, () => DSB_DIGITS[Math.floor(Math.random() * DSB_DIGITS.length)]);
  }

  function speakSequence(sequence: string[]) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    sequence.forEach((digit, index) => {
      const utterance = new SpeechSynthesisUtterance(digit);
      utterance.rate = 0.75;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.setTimeout(() => window.speechSynthesis.speak(utterance), index * 1000);
    });
  }

  function startDsbTrial(length = dsbLength, trialInLength = dsbTrialInLength) {
    const sequence = makeDigitSequence(length);
    setDsbLength(length);
    setDsbTrialInLength(trialInLength);
    setDsbSequence(sequence);
    setDsbInput('');
    setPhase('dsb_playing');
    speakSequence(sequence);
    window.setTimeout(() => setPhase('dsb_answer'), sequence.length * 1000 + 600);
  }

  function submitDsb() {
    const expected = [...dsbSequence].reverse().join('');
    const cleaned = dsbInput.replace(/\D/g, '');
    const correct = cleaned === expected;
    dsbTrialIndex.current += 1;
    if (correct) {
      dsbTotalCorrect.current += 1;
      dsbMaxSpan.current = Math.max(dsbMaxSpan.current, dsbSequence.length);
      dsbFailuresAtLength.current = 0;
    } else {
      dsbFailuresAtLength.current += 1;
    }

    pendingTrials.current.push({
      task: 'dsb',
      trial_index: dsbTrialIndex.current,
      stimulus: dsbSequence.join(''),
      response: cleaned || null,
      is_correct: correct,
      rt_ms: null,
      is_target: null,
    });

    const completedSecondTrial = dsbTrialInLength >= 1;
    const failedOut = dsbFailuresAtLength.current >= 2;
    if (failedOut || (completedSecondTrial && dsbLength >= DSB_MAX_LENGTH)) {
      setPhase('sart_intro');
      return;
    }
    if (failedOut) {
      setPhase('sart_intro');
      return;
    }
    if (completedSecondTrial) {
      dsbFailuresAtLength.current = 0;
      startDsbTrial(dsbLength + 1, 0);
      return;
    }
    startDsbTrial(dsbLength, 1);
  }

  const pendingTrials = useRef<Layer0Trial[]>([]);

  const sartTrialCount =
    runMode === 'research'
      ? RESEARCH_SART_TRIALS
      : runMode === 'demo'
        ? DEMO_SART_TRIALS
        : SART_TRIALS;
  const sdstSeconds =
    runMode === 'research'
      ? RESEARCH_SDST_SECONDS
      : runMode === 'demo'
        ? DEMO_SDST_SECONDS
        : SDST_SECONDS;

  function makeSartDigits() {
    const trialCount = sartTrialCount;
    const targetCount = Math.max(3, Math.round(trialCount * 0.11));
    const digits = Array.from({ length: trialCount }, (_, index) => {
      if (index < targetCount) return '3';
      const pool = ['1', '2', '4', '5', '6', '7', '8', '9'];
      return pool[Math.floor(Math.random() * pool.length)];
    });
    return digits.sort(() => Math.random() - 0.5);
  }

  function startSart() {
    sartTrials.current = [];
    setSartIndex(0);
    setSartProgress(0);
    runSartTrial(makeSartDigits(), 0);
  }

  function skipSartForDemo() {
    if (runMode !== 'demo') return;
    if (sartTimer.current) window.clearTimeout(sartTimer.current);
    sartCurrent.current = null;
    setSartDigit('');
    setPhase('sdst_intro');
  }

  function runSartTrial(digits: string[], index: number) {
    if (index >= digits.length) {
      sartCurrent.current = null;
      setSartDigit('');
      setPhase('sdst_intro');
      return;
    }

    const digit = digits[index];
    const now = performance.now();
    const isTarget = digit === '3';
    sartCurrent.current = { digit, index, shownAt: now, isTarget, responded: false };
    setSartDigit(digit);
    setSartIndex(index + 1);
    setSartProgress(Math.round(((index + 1) / digits.length) * 100));
    setSartResponded(false);
    setPhase('sart_running');

    sartTimer.current = window.setTimeout(() => {
      if (sartCurrent.current && !sartCurrent.current.responded) {
        sartTrials.current.push({
          task: 'sart',
          trial_index: index + 1,
          stimulus: digit,
          response: null,
          is_correct: isTarget,
          rt_ms: null,
          is_target: isTarget,
        });
      }
      setSartDigit('');
      sartCurrent.current = null;
      sartTimer.current = window.setTimeout(() => runSartTrial(digits, index + 1), SART_OFF_MS);
    }, SART_ON_MS);
  }

  useEffect(() => {
    if (phase !== 'sart_running') return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || !sartCurrent.current || sartCurrent.current.responded) return;
      event.preventDefault();
      const current = sartCurrent.current;
      current.responded = true;
      setSartResponded(true);
      const rt = Math.round(performance.now() - current.shownAt);
      sartTrials.current.push({
        task: 'sart',
        trial_index: current.index + 1,
        stimulus: current.digit,
        response: 'space',
        is_correct: !current.isTarget,
        rt_ms: rt,
        is_target: current.isTarget,
      });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase]);

  function startSdst() {
    sdstTrials.current = [];
    setSdstAttempted(0);
    setSdstLastKey('');
    setSdstTimeLeft(sdstSeconds);
    nextSdstSymbol(0);
    setPhase('sdst_running');
    sdstTimer.current = window.setInterval(() => {
      setSdstTimeLeft((prev) => {
        if (prev <= 1) {
          if (sdstTimer.current) window.clearInterval(sdstTimer.current);
          setPhase('saving');
          window.setTimeout(saveLayer0, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const nextSdstSymbol = useCallback(
    (index: number) => {
      const item = sdstKey[Math.floor(Math.random() * sdstKey.length)];
      sdstCurrent.current = {
        symbol: item.symbol,
        expected: item.digit,
        shownAt: performance.now(),
        index,
      };
      setSdstSymbol(item.symbol);
    },
    [sdstKey]
  );

  const submitSdstAnswer = useCallback(
    (answer: string) => {
      if (phase !== 'sdst_running' || !/^[1-9]$/.test(answer) || !sdstCurrent.current) return;
      const current = sdstCurrent.current;
      const correct = answer === current.expected;
      setSdstAttempted((prev) => prev + 1);
      setSdstLastKey(answer);
      sdstTrials.current.push({
        task: 'sdst',
        trial_index: current.index + 1,
        stimulus: current.symbol,
        response: answer,
        is_correct: correct,
        rt_ms: Math.round(performance.now() - current.shownAt),
        is_target: null,
      });
      nextSdstSymbol(current.index + 1);
    },
    [nextSdstSymbol, phase]
  );

  useEffect(() => {
    if (phase !== 'sdst_running') return;
    function onKeyDown(event: KeyboardEvent) {
      if (!/^[1-9]$/.test(event.key)) return;
      event.preventDefault();
      submitSdstAnswer(event.key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, submitSdstAnswer]);

  async function saveLayer0() {
    const sart = sartTrials.current;
    const sdst = sdstTrials.current;
    const allTrials = [...pendingTrials.current, ...sart, ...sdst];
    const sdstCorrectCount = sdst.filter((trial) => trial.is_correct).length;
    const targetTrials = sart.filter((trial) => trial.is_target);
    const goTrials = sart.filter((trial) => !trial.is_target);
    const commissionErrors = targetTrials.filter((trial) => trial.response).length;
    const omissionErrors = goTrials.filter((trial) => !trial.response).length;
    const correctGoRts = goTrials
      .filter((trial) => trial.response && trial.is_correct && typeof trial.rt_ms === 'number')
      .map((trial) => trial.rt_ms ?? 0);

    const commissionRate = targetTrials.length ? commissionErrors / targetTrials.length : 0;
    const omissionRate = goTrials.length ? omissionErrors / goTrials.length : 0;
    const cptMeanRtMs = mean(correctGoRts);
    const cptRtCv = Number(coefficientOfVariation(correctGoRts).toFixed(3));

    const dsbBand = bandDsb(dsbMaxSpan.current);
    const cptBand = bandSart(commissionRate, omissionRate);
    const sdstBandScore =
      runMode === 'student'
        ? sdstCorrectCount
        : Math.round(sdstCorrectCount * (SDST_SECONDS / sdstSeconds));
    const sdstBand = bandSdst(sdstBandScore);
    const rtvBand = bandRtCv(cptRtCv);
    const composite = compositeFromBands([dsbBand, cptBand, sdstBand, rtvBand]);

    const finalScores: Layer0Scores = {
      dsbMaxSpan: dsbMaxSpan.current,
      dsbTotalCorrect: dsbTotalCorrect.current,
      dsbBand,
      cptCommissionErrors: commissionErrors,
      cptOmissionErrors: omissionErrors,
      cptMeanRtMs,
      cptRtCv,
      cptBand,
      sdstCorrect: sdstCorrectCount,
      sdstAttempted: sdst.length,
      sdstBand,
      rtvBand,
      ...composite,
    };

    try {
      const supabase = createClient();
      if (allTrials.length) {
        await supabase.from('layer0_trials').delete().eq('assessment_id', assessmentId);

        await supabase.from('layer0_trials').insert(
          allTrials.map((trial) => ({
            assessment_id: assessmentId,
            ...trial,
          }))
        );
      }
      await supabase
        .from('layer0_assessments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          dsb_max_span: finalScores.dsbMaxSpan,
          dsb_total_correct: finalScores.dsbTotalCorrect,
          dsb_band: finalScores.dsbBand,
          cpt_commission_errors: finalScores.cptCommissionErrors,
          cpt_omission_errors: finalScores.cptOmissionErrors,
          cpt_mean_rt_ms: finalScores.cptMeanRtMs,
          cpt_rt_cv: finalScores.cptRtCv,
          cpt_band: finalScores.cptBand,
          sdst_correct: finalScores.sdstCorrect,
          sdst_attempted: finalScores.sdstAttempted,
          sdst_band: finalScores.sdstBand,
          rtv_band: finalScores.rtvBand,
          layer0_composite: finalScores.layer0Composite,
          load_calibration: finalScores.loadCalibration,
          teacher_review_flag: finalScores.teacherReviewFlag,
        })
        .eq('id', assessmentId);

      if (!isDemoRun && studentId) {
        const { data: profile } = await supabase
          .from('student_cognitive_profiles')
          .select('interpretation')
          .eq('student_id', studentId)
          .eq('active', true)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const recommended = (
          profile as {
            interpretation?: {
              recommended_next_step?: {
                standard_code?: string | null;
                label?: string | null;
              } | null;
            } | null;
          } | null
        )?.interpretation?.recommended_next_step;
        const standardCode =
          recommended?.standard_code && STUDENT_WIN_STANDARDS.has(recommended.standard_code)
            ? recommended.standard_code
            : 'ELA.9.R.1.1';
        setNextReadingWinLabel(recommended?.label ?? 'figurative and symbolic meaning');
        setNextReadingWinRoute(`/standard/${standardCodeToRouteId(standardCode)}/diagnostic`);
      }

      setScores(finalScores);
      setPhase('complete');
    } catch (err) {
      console.error('[Layer0] save error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Layer 0 could not save your assessment.'
      );
      setPhase('error');
    }
  }

  const displayName = studentName.split(' ')[0] || 'there';
  const runModeLabel =
    runMode === 'research' ? 'Research run' : runMode === 'demo' ? 'Quick demo' : 'Student run';
  const attentionEstimate =
    runMode === 'research'
      ? 'This research version takes about 2 minutes.'
      : runMode === 'demo'
        ? 'Quick demo mode uses a short version: about 40 seconds.'
        : 'This takes about 4 minutes. Stay steady, not perfect.';

  if (phase === 'loading')
    return (
      <Shell>
        <p style={muted}>Setting up Layer 0...</p>
      </Shell>
    );
  if (phase === 'error')
    return (
      <Shell>
        <Card>
          <h1 style={title}>Layer 0 needs attention.</h1>
          <p style={muted}>{errorMessage}</p>
        </Card>
      </Shell>
    );

  if (phase === 'intro') {
    return (
      <Shell>
        <Card>
          <div style={kicker}>Layer 0 | Cognitive availability | {runModeLabel}</div>
          <h1 style={title}>Before reading, GOGI checks how to support you.</h1>
          <p style={body}>
            This is not a grade. It helps GOGI understand how much information, speed, and attention
            load to put on the screen while you read.
          </p>
          <Notice>
            Do your best without outside help. The goal is accurate support, not a perfect score.
          </Notice>
          <button style={button} onClick={() => setPhase('dsb_intro')}>
            Start check
          </button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'dsb_intro') {
    return (
      <Shell>
        <Card>
          <div style={kicker}>Part 1 of 3 | Working memory</div>
          <h1 style={title}>You will hear numbers. Type them backward.</h1>
          <p style={body}>
            Example: if you hear 4, 9, type 94. The numbers get longer. Stop when GOGI has enough
            data.
          </p>
          <Notice>Turn your volume on. Do not write the numbers down.</Notice>
          <button style={button} onClick={() => startDsbTrial(2, 0)}>
            Begin numbers
          </button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'dsb_playing') {
    return (
      <Shell>
        <Card>
          <div style={kicker}>Listen only</div>
          <h1 style={giant}>{dsbSequence.length} numbers</h1>
          <p style={body}>Listen, hold them in your mind, then type them backward.</p>
        </Card>
      </Shell>
    );
  }

  if (phase === 'dsb_answer') {
    return (
      <Shell>
        <Card>
          <div style={kicker}>Type backward</div>
          <h1 style={title}>What were the numbers in reverse?</h1>
          <input
            value={dsbInput}
            onChange={(e) => setDsbInput(e.target.value)}
            autoFocus
            inputMode="numeric"
            style={input}
          />
          <button style={button} onClick={submitDsb}>
            Submit
          </button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'sart_intro') {
    return (
      <Shell>
        <Card>
          <div style={kicker}>Part 2 of 3 | Attention</div>
          <h1 style={title}>Press space for every number except 3.</h1>
          <p style={body}>
            Numbers flash quickly. Press the spacebar when you see 1, 2, 4, 5, 6, 7, 8, or 9. Do not
            press for 3.
          </p>
          <Notice>{attentionEstimate}</Notice>
          <button style={button} onClick={startSart}>
            Begin attention check
          </button>
          {runMode === 'demo' && (
            <button style={secondaryButton} onClick={skipSartForDemo}>
              Skip attention check for live demo
            </button>
          )}
        </Card>
      </Shell>
    );
  }

  if (phase === 'sart_running') {
    return (
      <Shell>
        <Card>
          <div style={topRow}>
            <span>
              {sartIndex} / {sartTrialCount}
            </span>
            <span>{sartProgress}%</span>
          </div>
          <div style={digitBox}>{sartDigit || ''}</div>
          <p style={muted}>{sartResponded ? 'Response captured' : 'Press space except on 3'}</p>
          {runMode === 'demo' && (
            <button style={secondaryButton} onClick={skipSartForDemo}>
              Skip to symbol check
            </button>
          )}
        </Card>
      </Shell>
    );
  }

  if (phase === 'sdst_intro') {
    return (
      <Shell>
        <Card>
          <div style={kicker}>Part 3 of 3 | Processing speed</div>
          <h1 style={title}>Match each symbol to its number.</h1>
          <KeyGrid items={sdstKey} />
          <p style={body}>
            Step 1: look at the big symbol. Step 2: find that same symbol in the key. Step 3: press
            the matching number or click the matching button.
          </p>
          {isDemoRun && (
            <Notice>
              {runMode === 'research'
                ? 'Research mode uses a 45-second symbol check for stronger preliminary data.'
                : 'Quick demo mode uses a short 20-second version.'}
            </Notice>
          )}
          <button style={button} onClick={startSdst}>
            Begin symbol check
          </button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'sdst_running') {
    return (
      <Shell wide>
        <Card>
          <div style={topRow}>
            <span>{sdstTimeLeft}s</span>
            <span>{sdstAttempted} tried</span>
          </div>
          <KeyGrid items={sdstKey} />
          <div style={symbolBox}>
            <div style={currentLabel}>Current symbol</div>
            <div style={currentSymbol}>{sdstSymbol}</div>
          </div>
          <p style={symbolInstruction}>
            Find this symbol in the key above. Press the matching number or click its button below.
          </p>
          <div style={sdstFeedback}>
            {sdstLastKey ? (
              <>
                You chose <strong>{sdstLastKey}</strong>. Keep using the key for the next one.
              </>
            ) : (
              'Choose a number from 1 to 9.'
            )}
          </div>
          <div style={numberPad} aria-label="Number choices">
            {sdstKey.map((item) => (
              <button
                key={item.digit}
                type="button"
                style={numberButton}
                onClick={() => submitSdstAnswer(item.digit)}
                aria-label={`Choose ${item.digit}`}
              >
                {item.digit}
              </button>
            ))}
          </div>
        </Card>
      </Shell>
    );
  }

  if (phase === 'saving') {
    return (
      <Shell>
        <Card>
          <h1 style={title}>Saving your Layer 0 data...</h1>
          <p style={muted}>GOGI is building your support profile.</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <div style={kicker}>Layer 0 complete</div>
        <h1 style={title}>Thanks, {displayName}. GOGI has your support profile.</h1>
        <p style={body}>
          This will help GOGI set the right amount of scaffolding while you read.
          {!isDemoRun && nextReadingWinRoute ? ` Your next win is ${nextReadingWinLabel}.` : ''}
        </p>
        {scores && (
          <div style={summaryGrid}>
            <Summary label="Working memory" value={scores.dsbBand} />
            <Summary label="Attention" value={scores.cptBand} />
            <Summary label="Speed" value={scores.sdstBand} />
            <Summary label="Consistency" value={scores.rtvBand} />
          </div>
        )}
        <button
          style={button}
          onClick={() =>
            router.push(isDemoRun ? '/demo/results' : nextReadingWinRoute || '/dashboard/student')
          }
        >
          {isDemoRun
            ? 'View demo results'
            : nextReadingWinRoute
              ? 'Start my reading win'
              : 'Continue to GOGI'}
        </button>
      </Card>
    </Shell>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F7F3EA',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: FONTS.ui,
      }}
    >
      <section style={{ width: '100%', maxWidth: wide ? 760 : 560 }}>{children}</section>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ background: C.white, border: '1px solid #D7C9AE', borderRadius: 10, padding: 24 }}
    >
      {children}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.amberLight,
        border: `1px solid ${C.amber}`,
        borderRadius: 8,
        color: '#633806',
        fontSize: 13,
        lineHeight: 1.5,
        margin: '16px 0',
        padding: 12,
      }}
    >
      {children}
    </div>
  );
}

function KeyGrid({ items }: { items: { symbol: string; digit: string }[] }) {
  return (
    <div style={keyGrid}>
      {items.map((item) => (
        <div key={item.symbol} style={keyCell}>
          <div style={keySymbol}>{item.symbol}</div>
          <div style={keyNumber}>{item.digit}</div>
        </div>
      ))}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#F3EEE3', borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 11, color: C.gray }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{value}</div>
    </div>
  );
}

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
  fontSize: 27,
  lineHeight: 1.1,
  margin: '0 0 10px',
};
const body: React.CSSProperties = { color: C.gray, fontSize: 15, lineHeight: 1.55, margin: 0 };
const muted: React.CSSProperties = { color: C.gray, fontSize: 14, textAlign: 'center' };
const button: React.CSSProperties = {
  background: C.navy,
  border: 'none',
  borderRadius: 8,
  color: C.white,
  cursor: 'pointer',
  fontFamily: FONTS.ui,
  fontSize: 15,
  fontWeight: 800,
  marginTop: 16,
  minHeight: 48,
  padding: '0 18px',
  width: '100%',
};
const secondaryButton: React.CSSProperties = {
  ...button,
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  color: C.dark,
  marginTop: 10,
};
const giant: React.CSSProperties = {
  color: C.navy,
  fontSize: 52,
  lineHeight: 1,
  margin: '0 0 10px',
  textAlign: 'center',
};
const input: React.CSSProperties = {
  background: C.white,
  border: `1.5px solid ${C.border}`,
  borderRadius: 8,
  boxSizing: 'border-box',
  caretColor: C.dark,
  color: C.dark,
  fontFamily: FONTS.ui,
  fontSize: 28,
  letterSpacing: 4,
  marginTop: 12,
  minHeight: 58,
  padding: '8px 12px',
  textAlign: 'center',
  width: '100%',
};
const topRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  color: C.gray,
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 14,
};
const digitBox: React.CSSProperties = {
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  borderRadius: 10,
  color: C.navy,
  display: 'grid',
  fontSize: 88,
  fontWeight: 900,
  height: 180,
  placeItems: 'center',
};
const symbolBox: React.CSSProperties = {
  alignItems: 'center',
  background: '#FFFDF8',
  border: '2px solid #B9A888',
  borderRadius: 10,
  color: C.navy,
  display: 'flex',
  flexDirection: 'column',
  height: 180,
  justifyContent: 'center',
  marginTop: 16,
};
const currentLabel: React.CSSProperties = {
  color: C.gray,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1.2,
  marginBottom: 10,
  textTransform: 'uppercase',
};
const currentSymbol: React.CSSProperties = {
  color: C.navy,
  fontSize: 92,
  fontWeight: 900,
  lineHeight: 1,
};
const symbolInstruction: React.CSSProperties = {
  color: C.dark,
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.4,
  margin: '12px 0 0',
  textAlign: 'center',
};
const sdstFeedback: React.CSSProperties = {
  background: C.blueLight,
  border: `1px solid ${C.blueMid}`,
  borderRadius: 8,
  color: C.navy,
  fontSize: 14,
  fontWeight: 750,
  marginTop: 12,
  minHeight: 42,
  padding: '10px 12px',
  textAlign: 'center',
};
const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 10,
  margin: '16px 0',
};
const keyGrid: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(auto-fit, minmax(58px, 1fr))',
  margin: '16px 0',
};
const keyCell: React.CSSProperties = {
  alignItems: 'center',
  background: '#FFFDF8',
  border: '1.5px solid #B9A888',
  borderRadius: 8,
  color: C.dark,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  justifyContent: 'center',
  minHeight: 72,
  minWidth: 0,
  padding: '8px 4px',
};
const keySymbol: React.CSSProperties = {
  color: C.navy,
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1,
};
const keyNumber: React.CSSProperties = {
  background: C.navy,
  borderRadius: 999,
  color: C.white,
  fontSize: 15,
  fontWeight: 900,
  lineHeight: 1,
  minWidth: 28,
  padding: '6px 0',
  textAlign: 'center',
};
const numberPad: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(auto-fit, minmax(48px, 1fr))',
  marginTop: 12,
};
const numberButton: React.CSSProperties = {
  background: C.navy,
  border: 'none',
  borderRadius: 8,
  color: C.white,
  cursor: 'pointer',
  fontFamily: FONTS.ui,
  fontSize: 18,
  fontWeight: 900,
  minHeight: 44,
};
