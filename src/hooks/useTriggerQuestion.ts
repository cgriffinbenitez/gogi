import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function extractPassageFromContent(content: string): string {
  const qIdx = content.search(/\nQUESTION:/i)
  const raw = qIdx > 0 ? content.slice(0, qIdx) : content
  return raw
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^-{2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface TriggerQuestion {
  questionId: string
  passageText: string
  passageTitle: string
  passageAuthor: string
  keywordFlags: string[]
  blockingWord: string
  passageContext: string
}

export function useTriggerQuestion(
  studentId: string | null,
  standardCode: string,
  classification: string
): { data: TriggerQuestion | null; loading: boolean } {
  const [data, setData] = useState<TriggerQuestion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId || !standardCode || !classification) return

    async function load() {
      setLoading(true)
      const supabase = createClient()

      // Get standard UUID
      const { data: std } = await supabase
        .from('standards')
        .select('id')
        .eq('code', standardCode)
        .single()
      if (!std) { setLoading(false); return }

      // STEP 1: Find the response where THIS classification fired
      let questionId: string | null = null

      const { data: triggerResp } = await supabase
        .from('responses')
        .select('question_id')
        .eq('student_id', studentId)
        .eq('standard_id', std.id)
        .eq('diagnostic_classification', classification)
        .not('question_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (triggerResp?.question_id) {
        questionId = triggerResp.question_id as string
        console.log('[useTriggerQuestion] found trigger question:', questionId)
      } else {
        // FALLBACK: use first question_id from most recent diagnostic session
        console.log('[useTriggerQuestion] no trigger response found, using fallback')

        const { data: session } = await supabase
          .from('sessions')
          .select('diagnostic_question_ids')
          .eq('student_id', studentId)
          .eq('standard_id', std.id)
          .eq('phase', 'diagnostic')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const ids = (session as { diagnostic_question_ids?: string[] } | null)
          ?.diagnostic_question_ids
        if (Array.isArray(ids) && ids.length > 0) {
          questionId = ids[0]
        }
      }

      if (!questionId) { setLoading(false); return }

      // STEP 2: Fetch the question — single source for everything
      const { data: question } = await supabase
        .from('questions')
        .select('id, content, title, author, keyword_flags')
        .eq('id', questionId)
        .maybeSingle()

      if (!question) { setLoading(false); return }

      // STEP 3: Extract everything from this one question
      const passageText = extractPassageFromContent(question.content)
      const keywordFlags: string[] = Array.isArray(question.keyword_flags)
        ? (question.keyword_flags as string[])
        : []
      const blockingWord = keywordFlags[0] ?? ''

      // Find the sentence containing the blocking word
      let passageContext = ''
      if (blockingWord) {
        const sentences = passageText.match(/[^.!?]+[.!?]*/g) ?? []
        const match = sentences.find((s) =>
          s.toLowerCase().includes(blockingWord.toLowerCase())
        )
        passageContext = match?.trim() ?? passageText.slice(0, 200)
      }

      setData({
        questionId: question.id as string,
        passageText,
        passageTitle: (question as { title?: string }).title ?? 'Literary Passage',
        passageAuthor: (question as { author?: string }).author ?? 'Public Domain',
        keywordFlags,
        blockingWord,
        passageContext,
      })
      setLoading(false)
      console.log('[useTriggerQuestion] loaded:', (question as { title?: string }).title,
        '| blocking word:', blockingWord)
    }

    load()
  }, [studentId, standardCode, classification])

  return { data, loading }
}
