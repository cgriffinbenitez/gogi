export const MOOD_SIGNATURES = {
  tense: {
    description: 'Short sentences. Concrete sensory details. What is unsaid. Silence.',
    matchExcerpt: 'The room was silent. She held her breath. A single board creaked.',
  },
  melancholy: {
    description: 'Long sentences. Soft consonants. Evening, autumn, distance.',
    matchExcerpt:
      'As the evening faded into a gold nothing, she sat by the window and remembered the summer that would never come again.',
  },
  ominous: {
    description: 'Unexplained details. Doors ajar. Slow pacing. Something off.',
    matchExcerpt:
      'The door was ajar when she got home. She did not remember leaving it that way. From inside, something small moved.',
  },
};

/**
 * TEMPORARY — Transfer-passage mood lookup.
 *
 * The permanent implementation is a canonical_mood column on the questions
 * table, populated by the Gutenberg ingestion pipeline (separate workstream).
 * Once that column exists and is populated, Phase 5 will read from it
 * directly and this fallback can be deleted.
 *
 * Until then, this function returns null for all question IDs, which
 * triggers the "transfer unmeasured" graceful fallback on the teach page.
 * Phase 1–4 ship and function fully; Phase 5 records unmeasured transfer.
 *
 * Do NOT manually populate this map. The ingestion pipeline is the
 * right way to tag passages.
 */
export function getCanonicalMood(_questionId: string): string | null {
  return null;
}
