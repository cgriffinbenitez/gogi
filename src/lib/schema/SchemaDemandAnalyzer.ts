import { createClient } from '@/lib/supabase/client'

export interface DemandAnalysisResult {
  shouldFire: boolean
  triggerReason: string
  demandScore: number
}

/**
 * Analyzes whether a schema intervention should fire before the diagnostic.
 *
 * MVP rules:
 * - Session 1: always fire (universal first-session schema)
 * - Session 2+: fire if the student has had failed turns (struggled previously)
 */
export async function analyzeSchemaDemand(
  studentId: string,
  standardId: string,
  sessionNumber: number,
): Promise<DemandAnalysisResult> {
  // Session 1: always fire schema support
  if (sessionNumber === 1) {
    return {
      shouldFire: true,
      triggerReason: 'first_session_universal',
      demandScore: 0.9,
    }
  }

  // After session 1: check if student has struggled
  try {
    const supabase = createClient()
    const { data: progress } = await supabase
      .from('standard_progress')
      .select('sessions_passed, sessions_attempted')
      .eq('student_id', studentId)
      .eq('standard_id', standardId)
      .maybeSingle()

    if (!progress) {
      return { shouldFire: false, triggerReason: 'no_data', demandScore: 0 }
    }

    const attempted = progress.sessions_attempted ?? 0
    const passed    = progress.sessions_passed    ?? 0

    // Fire if student has attempted at least once without passing
    if (attempted > 0 && passed < attempted) {
      return {
        shouldFire: true,
        triggerReason: 'failed_turns_detected',
        demandScore: 0.75,
      }
    }

    return {
      shouldFire: false,
      triggerReason: 'student_progressing',
      demandScore: 0.2,
    }
  } catch (err) {
    console.error('[SchemaDemandAnalyzer] progress query failed:', err)
    // Fail open — if we can't determine, fire schema support
    return {
      shouldFire: true,
      triggerReason: 'query_error_fail_open',
      demandScore: 0.5,
    }
  }
}
