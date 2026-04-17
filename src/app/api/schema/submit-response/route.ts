import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      schemaInterventionId: string
      studentId: string
      responseText: string
    }
    const { schemaInterventionId, studentId, responseText } = body

    if (!studentId || !responseText?.trim()) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Simple readiness scoring (0–3):
    // 0 = empty or minimal
    // 1 = vague but present (5+ words)
    // 2 = aligned and coherent (15+ words, 1+ sentence)
    // 3 = aligned, predictive, conceptually sound (25+ words, 2+ sentences)
    const words     = responseText.trim().split(/\s+/).filter(Boolean).length
    const sentences = (responseText.match(/[.!?]+/g) ?? []).length

    let readinessScore = 0
    if (words >= 5)                         readinessScore = 1
    if (words >= 15 && sentences >= 1)      readinessScore = 2
    if (words >= 25 && sentences >= 2)      readinessScore = 3

    const microFeedback = readinessScore >= 2
      ? "You're entering the right territory. Test your prediction as you read."
      : "Good start. Keep that idea in mind as you read."

    const supabase = await createServerSupabaseClient()

    await supabase.from('schema_responses').insert({
      schema_intervention_id: schemaInterventionId || null,
      student_id:             studentId,
      student_response:       responseText.trim(),
      readiness_score:        readinessScore,
      response_quality_score: readinessScore,
    })

    return Response.json({
      unlockPassage:  true,
      readinessScore,
      microFeedback,
    })
  } catch (err) {
    console.error('[schema/submit-response] error:', err)
    // Fail open — always unlock passage even if save fails
    return Response.json({
      unlockPassage:  true,
      readinessScore: 1,
      microFeedback:  'Good start. Keep that idea in mind as you read.',
    })
  }
}
