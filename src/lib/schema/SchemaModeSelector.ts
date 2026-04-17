import type { SchemaMode } from './types'

const CONTEXT_TRIGGERS = [
  'bible', 'exodus', 'cicero', 'ancient', 'roman',
  'greek', 'colonial', 'civil war', 'medieval',
]

/**
 * Selects the appropriate schema mode based on standard and passage metadata.
 *
 * - ELA.9.R.2.1 (text structure) → task_framing
 * - Historical/classical texts → context_builder
 * - Default literary texts → topic_primer
 */
export function selectSchemaMode(
  standardCode: string,
  passageTitle: string,
  passageAuthor: string,
): SchemaMode {
  // Text structure standard always needs task framing
  if (standardCode === 'ELA.9.R.2.1') return 'task_framing'

  const titleLower  = passageTitle.toLowerCase()
  const authorLower = passageAuthor.toLowerCase()

  if (CONTEXT_TRIGGERS.some((t) => titleLower.includes(t) || authorLower.includes(t))) {
    return 'context_builder'
  }

  return 'topic_primer'
}

export const MODE_LABELS: Record<SchemaMode, string> = {
  topic_primer:    'Topic Primer',
  context_builder: 'Context Builder',
  task_framing:    'Task Framing',
}
