'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, FileText, Brain, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { FastGrowthGoal } from '@/lib/fast/growth';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { useAuth } from '@/context/AuthContext';

type StudentOption = {
  id: string;
  full_name: string;
  grade_level: number | null;
};

type UploadResult = {
  assessment?: {
    test_reason?: string;
    test_year?: number;
    scale_score?: number | null;
    achievement_level?: number | null;
  };
  profile?: {
    classification_scores?: Record<string, number>;
    top_weaknesses?: Array<{ benchmark_code: string; pct_correct: number; attempts: number }>;
    points_to_next_rung?: number | null;
    next_rung_target?: number | null;
    confidence_label?: string | null;
    interpretation?: {
      summary?: string;
      first_instructional_move?: string;
      confidence_rationale?: string;
      growth_goal?: FastGrowthGoal | null;
      top_barriers?: Array<{
        code: string;
        label: string;
        strength: number;
        band: string;
        action: string;
      }>;
      benchmark_evidence?: Array<{
        benchmark_code: string;
        pct_correct: number;
        attempts: number;
        evidence_label: string;
      }>;
      recommended_next_step?: {
        route: string;
        label: string;
        reason: string;
      };
    };
  };
  item_count?: number;
  storage_warning?: string | null;
};

const SIGNAL_LABELS: Record<string, string> = {
  figurative_language_failure: 'Figurative and symbolic meaning',
  inferencing_literal: 'Literal reading when inference is needed',
  inferencing_schema: 'Inference schema/background knowledge',
  tone_misreading: 'Tone and speaker attitude',
  mood_misreading: 'Mood from word choice and details',
  vocabulary_gap: 'Vocabulary in context',
  evidence_retrieval_failure: 'Finding the right evidence',
  comprehension_integration_failure: 'Putting details together',
  topic_vs_theme_confusion: 'Theme versus topic',
  structure_purpose_disconnect: 'Structure and author purpose',
  no_metacognitive_strategy: 'Monitoring confusion',
  morphology_gap: 'Word parts and morphology',
  syntax_barrier: 'Sentence structure',
};

const SIGNAL_ACTIONS: Record<string, string> = {
  figurative_language_failure:
    'Start with figurative language, symbolism, and connotation using short text chunks.',
  inferencing_literal: 'Teach students to move from stated detail to supported inference.',
  inferencing_schema: 'Build background structure before asking for independent inference.',
  tone_misreading: 'Use speaker attitude, diction, and contrast work before full analysis.',
  mood_misreading: 'Have students name mood from concrete details before interpreting theme.',
  vocabulary_gap: 'Pre-teach high-leverage words and use context-clue routines.',
  evidence_retrieval_failure:
    'Practice locating and justifying the exact detail that proves an answer.',
  comprehension_integration_failure: 'Use two-detail synthesis before longer response work.',
  topic_vs_theme_confusion:
    'Separate what the text is about from what it says about life or people.',
  structure_purpose_disconnect: 'Connect paragraph structure to author purpose before analysis.',
  no_metacognitive_strategy: 'Add stop-and-check moments so students notice confusion early.',
  morphology_gap: 'Teach prefixes, roots, and suffixes tied to passage vocabulary.',
  syntax_barrier: 'Unpack long sentences before asking inference or theme questions.',
};

function signalRows(scores: Record<string, number> | undefined) {
  const entries = Object.entries(scores ?? {})
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const topScore = entries[0]?.[1] ?? 0;

  return entries.map(([code, score]) => {
    const strength = topScore > 0 ? Math.round((score / topScore) * 100) : 0;
    return {
      code,
      label: SIGNAL_LABELS[code] ?? code.replaceAll('_', ' '),
      action: SIGNAL_ACTIONS[code] ?? 'Use a short diagnostic to confirm the instructional driver.',
      strength,
      band:
        strength >= 80 ? 'Strong signal' : strength >= 50 ? 'Moderate signal' : 'Emerging signal',
    };
  });
}

export default function FastUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user, role, loading: authLoading } = useAuth();
  const requestedStudentId = searchParams.get('student');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStudentsForUser(userId: string) {
      setLoadingStudents(true);

      const studentResult = await Promise.race([
        supabase
          .from('students')
          .select('id, full_name, grade_level')
          .eq('teacher_id', userId)
          .order('full_name'),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
      ]);

      if (!mounted) return;

      if (!studentResult) {
        setError(
          'FAST upload could not load a teacher roster for this session. Refresh or sign in as a teacher.'
        );
      } else if (studentResult.error) {
        setError(studentResult.error.message);
      } else {
        const teacherStudents = studentResult.data ?? [];
        setError(null);
        setStudents(teacherStudents);
        const requestedStudent = teacherStudents.find(
          (student) => student.id === requestedStudentId
        );
        setStudentId(requestedStudent?.id ?? teacherStudents[0]?.id ?? '');
      }
      setLoadingStudents(false);
    }

    async function loadStudents() {
      setError(null);

      if (authLoading) return;

      if (!user) {
        setLoadingStudents(false);
        setError('Please log in as a teacher to upload FAST reports.');
        return;
      }

      if (role !== 'teacher') {
        setLoadingStudents(false);
        setError('FAST upload is a teacher tool. Sign in as a teacher to choose a roster student.');
        return;
      }

      await loadStudentsForUser(user.id);
    }

    loadStudents();

    return () => {
      mounted = false;
    };
  }, [authLoading, requestedStudentId, role, user]);

  useEffect(() => {
    if (!loadingStudents) return;

    const timeout = window.setTimeout(() => {
      setLoadingStudents(false);
      setError(
        'FAST upload is waiting on a teacher roster. If you are demoing as Noah, switch to a teacher login before uploading FAST reports.'
      );
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [loadingStudents]);

  const strongestSignals = useMemo(() => {
    return (
      result?.profile?.interpretation?.top_barriers ??
      signalRows(result?.profile?.classification_scores)
    );
  }, [result]);

  async function submitUpload() {
    if (!studentId || !file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append('student_id', studentId);
    form.append('file', file);

    const response = await fetch('/api/fast/upload', {
      method: 'POST',
      body: form,
    });

    const body = (await response.json()) as UploadResult & { error?: string };
    if (!response.ok) {
      setError(body.error ?? 'Could not upload FAST report.');
    } else {
      setResult(body);
    }

    setUploading(false);
  }

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#1F2A37]">
      <TeacherDashboardTopBar active="fast" />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#111827]">
              FAST Report Upload
            </h1>
            <p className="mt-1 text-sm text-[#667085]">
              Turn a student FAST ELA Reading ISR into a starting cognitive profile.
            </p>
          </div>
        </div>

        <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="rounded-lg border border-[#D0D5DD] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#344054]">
              <Upload className="h-4 w-4" />
              Upload ISR PDF
            </div>

            <label className="mb-2 block text-sm font-medium text-[#344054]" htmlFor="student">
              Student
            </label>
            <select
              id="student"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              disabled={loadingStudents || uploading || students.length === 0}
              className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
            >
              {loadingStudents ? <option value="">Loading students...</option> : null}
              {!loadingStudents && students.length === 0 ? (
                <option value="">No students found for this teacher</option>
              ) : null}
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                  {student.grade_level ? `, Grade ${student.grade_level}` : ''}
                </option>
              ))}
            </select>
            <p className="mb-4 mt-2 text-xs leading-5 text-[#667085]">
              {loadingStudents
                ? 'Finding the students attached to this teacher account...'
                : students.length
                  ? 'Choose the student profile this FAST report belongs to.'
                  : 'No teacher roster is available for this login. Use a teacher account, then come back to FAST Upload.'}
            </p>

            <label className="mb-2 block text-sm font-medium text-[#344054]" htmlFor="fast-file">
              FAST ELA Reading ISR PDF
            </label>
            <input
              id="fast-file"
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={uploading}
              className="mb-5 block w-full text-sm text-[#344054] file:mr-4 file:rounded-md file:border-0 file:bg-[#EAF2FF] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#1D4ED8]"
            />

            {error ? (
              <div className="mb-4 flex gap-2 rounded-md border border-[#FDA29B] bg-[#FFFBFA] p-3 text-sm text-[#B42318]">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={submitUpload}
              disabled={!studentId || !file || uploading}
              className="inline-flex items-center gap-2 rounded-md bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#98A2B3]"
            >
              <FileText className="h-4 w-4" />
              {uploading ? 'Processing report...' : 'Generate profile'}
            </button>
          </div>

          <aside className="rounded-lg border border-[#D0D5DD] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#344054]">
              <Brain className="h-4 w-4" />
              Generated Evidence
            </div>

            {result ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[#667085]">FAST window</div>
                    <div className="font-semibold text-[#111827]">
                      {result.assessment?.test_reason ?? 'FAST'}{' '}
                      {result.assessment?.test_year ?? ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#667085]">Item rows</div>
                    <div className="font-semibold text-[#111827]">{result.item_count ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[#667085]">Scale score</div>
                    <div className="font-semibold text-[#111827]">
                      {result.assessment?.scale_score ?? 'Not found'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#667085]">Next rung</div>
                    <div className="font-semibold text-[#111827]">
                      {result.profile?.points_to_next_rung === null ||
                      result.profile?.points_to_next_rung === undefined
                        ? 'Level 5 or missing'
                        : `${result.profile.interpretation?.growth_goal?.next_rung_label ?? result.profile.next_rung_target} (${result.profile.points_to_next_rung} pts)`}
                    </div>
                  </div>
                </div>

                {result.storage_warning ? (
                  <div className="rounded-md border border-[#FEDF89] bg-[#FFFAEB] p-3 text-sm text-[#93370D]">
                    {result.storage_warning}
                  </div>
                ) : null}

                {result.profile?.interpretation?.summary ? (
                  <div className="rounded-md border border-[#B2DDFF] bg-[#EFF8FF] p-3 text-sm leading-6 text-[#1849A9]">
                    <div className="mb-1 font-semibold">
                      {result.profile.confidence_label?.replaceAll('_', ' ') ?? 'Profile insight'}
                    </div>
                    <p>{result.profile.interpretation.summary}</p>
                    <p className="mt-2 text-[#175CD3]">
                      {result.profile.interpretation.first_instructional_move}
                    </p>
                  </div>
                ) : null}

                {result.profile?.interpretation?.growth_goal ? (
                  <div className="rounded-md border border-[#ABEFC6] bg-[#ECFDF3] p-3 text-sm leading-6 text-[#067647]">
                    <div className="font-semibold">Growth target</div>
                    <p>
                      First: {result.profile.interpretation.growth_goal.next_rung_label} · Year-end:{' '}
                      {result.profile.interpretation.growth_goal.realistic_year_end_range} ·
                      Stretch: {result.profile.interpretation.growth_goal.stretch_goal_label}
                    </p>
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">
                    Likely starting needs
                  </div>
                  <div className="space-y-3">
                    {strongestSignals.length ? (
                      strongestSignals.map((signal) => (
                        <div key={signal.code} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-[#344054]">{signal.label}</span>
                            <span className="text-xs font-semibold text-[#475467]">
                              {signal.band}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#EAECF0]">
                            <div
                              className="h-full rounded-full bg-[#2563EB]"
                              style={{ width: `${signal.strength}%` }}
                            />
                          </div>
                          {signal === strongestSignals[0] ? (
                            <p className="text-xs leading-5 text-[#667085]">{signal.action}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#667085]">No missed-benchmark signal yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">
                    Benchmark evidence to inspect
                  </div>
                  <div className="space-y-2">
                    {(
                      result.profile?.interpretation?.benchmark_evidence ??
                      result.profile?.top_weaknesses ??
                      []
                    ).map((weakness) => (
                      <div
                        key={weakness.benchmark_code}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-[#344054]">{weakness.benchmark_code}</span>
                        <span className="text-right font-semibold text-[#111827]">
                          {Math.round(weakness.pct_correct * 100)}% correct
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {result.profile?.interpretation?.recommended_next_step ? (
                  <div className="rounded-md border border-[#D0D5DD] bg-[#F9FAFB] p-3 text-sm">
                    <div className="font-semibold text-[#344054]">Recommended next step</div>
                    <p className="mt-1 text-[#111827]">
                      {result.profile.interpretation.recommended_next_step.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#667085]">
                      {result.profile.interpretation.recommended_next_step.reason}
                    </p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => router.push(`/teacher-dashboard/students/${studentId}/fast`)}
                  className="w-full rounded-md border border-[#1D4ED8] px-4 py-2 text-sm font-semibold text-[#1D4ED8]"
                >
                  Open full FAST evidence view
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/teacher')}
                  className="w-full rounded-md border border-[#D0D5DD] px-4 py-2 text-sm font-semibold text-[#344054]"
                >
                  Back to roster
                </button>
              </div>
            ) : (
              <p className="text-sm leading-6 text-[#667085]">
                After upload, this panel will show the student&apos;s initial cognitive signals and
                the FAST benchmarks driving them.
              </p>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
