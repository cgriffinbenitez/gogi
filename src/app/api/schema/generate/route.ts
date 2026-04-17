import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { selectSchemaMode } from '@/lib/schema/SchemaModeSelector'
import type { SchemaPayload, SchemaMode } from '@/lib/schema/types'

const MODE_INSTRUCTIONS: Record<SchemaMode, string> = {
  topic_primer:    'Build a topic primer. Give the student just enough background on the topic/situation to enter the text with a mental model.',
  context_builder: 'Build a context frame. The student needs historical, cultural, or situational context to understand who these people are and what world they inhabit.',
  task_framing:    'Build a task frame. The student needs to know what kind of reading this is and what to look for. Focus on the reading lens and prediction prompt.',
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      sessionId: string
      studentId: string
      questionId: string
      standardId: string
      standardCode: string
      schemaModeOverride?: SchemaMode
    }
    const { sessionId, studentId, questionId, standardId, standardCode, schemaModeOverride } = body

    if (!sessionId || !studentId || !questionId || !standardId || !standardCode) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // ── Idempotency: return cached intervention for this session ────────────
    const { data: existing } = await supabase
      .from('schema_interventions')
      .select('id, generated_payload')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (existing) {
      return Response.json({
        interventionId: existing.id,
        payload: existing.generated_payload as SchemaPayload,
        cached: true,
      })
    }

    // ── Fetch question / passage data ───────────────────────────────────────
    const { data: question } = await supabase
      .from('questions')
      .select('content, title, author, keyword_flags')
      .eq('id', questionId)
      .maybeSingle()

    if (!question) {
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    // Extract passage text (first 800 chars is enough for schema)
    const passageText = question.content
      .replace(/^PASSAGE:\s*/i, '')
      .split(/\nQUESTION:/i)[0]
      .replace(/^-{2,}\s*$/gm, '')
      .trim()
      .slice(0, 800)

    const passageTitle  = (question as { title?: string }).title ?? ''
    const passageAuthor = (question as { author?: string }).author ?? ''
    const keywords      = Array.isArray(question.keyword_flags) ? (question.keyword_flags as string[]) : []

    const schemaMode: SchemaMode = schemaModeOverride ?? selectSchemaMode(standardCode, passageTitle, passageAuthor)

    // ── Generate schema payload with Claude ─────────────────────────────────
    const client = new Anthropic()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: `You are a pre-reading schema designer for a 9th grade literacy platform serving Title I students in Miami. Your job is to build the MINIMUM viable mental model a student needs before reading.

CRITICAL RULES:
- Do NOT give away the theme, inference, or answer
- Do NOT summarize the passage
- Do NOT write more than the character limits
- Write at a 7th-8th grade reading level
- Make it feel like a knowledgeable friend talking, not a textbook
- Keep all content relevant to the SPECIFIC passage, not generic

${MODE_INSTRUCTIONS[schemaMode]}

Respond with valid JSON only. No markdown. No explanation.
Schema:
{
  "schemaMode": "${schemaMode}",
  "topicFrame": "string (max 180 chars — one sentence framing the world/topic)",
  "knowledgeAnchors": ["string (max 140 chars)", "string", "string"],
  "analogyOrBridge": "string (max 180 chars — connect to something they know)",
  "misconceptionGuardrail": "string (max 140 chars — what NOT to assume)",
  "readingLens": "string (max 160 chars — what to watch for as they read)",
  "predictionPrompt": "string (max 160 chars — one question they answer before reading)"
}`,
      messages: [{
        role: 'user',
        content: `Standard: ${standardCode}
Title: ${passageTitle || 'Literary passage'}
Author: ${passageAuthor || 'Unknown'}
Keywords: ${keywords.join(', ')}
Passage excerpt:
${passageText}`,
      }],
    })

    let payload: SchemaPayload
    try {
      const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
      payload = JSON.parse(raw.replace(/```json\n?|```/g, '').trim()) as SchemaPayload
    } catch (parseErr) {
      console.error('[schema/generate] JSON parse failed:', parseErr)
      return Response.json({ error: 'Schema generation failed' }, { status: 500 })
    }

    // ── Store intervention ──────────────────────────────────────────────────
    const { data: intervention, error: insertErr } = await supabase
      .from('schema_interventions')
      .insert({
        session_id:        sessionId,
        student_id:        studentId,
        standard_id:       standardId,
        question_id:       questionId,
        schema_mode:       schemaMode,
        trigger_reason:    'demand_analysis',
        demand_score:      0.9,
        generated_payload: payload,
        model_version:     'claude-sonnet-4-6',
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[schema/generate] insert error:', insertErr.message)
      // Return payload even if insert fails — don't block the student
      return Response.json({ interventionId: null, payload, cached: false })
    }

    return Response.json({
      interventionId: intervention.id,
      payload,
      cached: false,
    })
  } catch (err) {
    console.error('[schema/generate] unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
