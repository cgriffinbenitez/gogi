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

const COMMON_WORDS = new Set([
  'about', 'above', 'after', 'again', 'along', 'also', 'because', 'before',
  'being', 'between', 'could', 'dangerous', 'does', 'everything', 'feeling',
  'given', 'gone', 'have', 'home', 'hope', 'into', 'makes', 'never', 'only',
  'passage', 'question', 'reached', 'scary', 'silence', 'sisters', 'student',
  'their', 'there', 'these', 'they', 'this', 'those', 'toward', 'wanting',
  'where', 'which', 'while', 'whole', 'with', 'would', 'around', 'beautiful',
])

function parseOptions(content: string): Record<string, string> {
  const opts: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const m = line.trimStart().match(/^([A-D])[.)]\s*(.+)/)
    if (m) opts[m[1]] = m[2].trim()
  }
  return opts
}

function toWords(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z][a-z'-]{2,}/g) ?? []
}

function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
}

function findSentenceForWord(passageText: string, word: string): string {
  const sentences = passageText.match(/[^.!?]+[.!?]*/g) ?? []
  const match = sentences.find((s) => hasWord(s, word))
  return match?.trim() ?? passageText.slice(0, 200)
}

function extractQuotedCandidates(text: string): string[] {
  const candidates: string[] = []
  const quoteMatches = text.matchAll(/["'\u201c\u2018]([^"'\u201d\u2019]{3,})["'\u201d\u2019]/g)
  for (const match of quoteMatches) {
    candidates.push(...toWords(match[1]))
  }
  return candidates
}

function rankCandidates(candidates: string[], passageText: string): string {
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const word = candidate.replace(/^'+|'+$/g, '').toLowerCase()
    if (
      word.length >= 4 &&
      !seen.has(word) &&
      !COMMON_WORDS.has(word) &&
      hasWord(passageText, word)
    ) {
      return word
    }
    seen.add(word)
  }
  return ''
}

function deriveBlockingWord(
  keywordFlags: string[],
  selectedOptionText: string,
  passageText: string,
): string {
  const flag = keywordFlags.find((word) => hasWord(passageText, word))
  if (flag) return flag

  const quoted = rankCandidates(extractQuotedCandidates(selectedOptionText), passageText)
  if (quoted) return quoted

  return rankCandidates(toWords(selectedOptionText), passageText)
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
      let selectedOption: string | null = null

      const { data: triggerResp } = await supabase
        .from('responses')
        .select('question_id, student_response')
        .eq('student_id', studentId)
        .eq('standard_id', std.id)
        .eq('diagnostic_classification', classification)
        .not('question_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (triggerResp?.question_id) {
        questionId = triggerResp.question_id as string
        selectedOption = (triggerResp as { student_response?: string | null }).student_response ?? null
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
      const selectedOptionText = selectedOption
        ? (parseOptions(question.content)[selectedOption] ?? '')
        : ''
      const blockingWord = deriveBlockingWord(keywordFlags, selectedOptionText, passageText)

      // Find the sentence containing the blocking word
      let passageContext = ''
      if (blockingWord) {
        passageContext = findSentenceForWord(passageText, blockingWord)
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
