import { describe, expect, it } from 'vitest';
import {
  buildGutenbergReadingWinQuestionInserts,
  buildGutenbergReadingWinQuestionInsert,
  mapGutenbergClassificationToFastStandard,
  type GutenbergPassageForReadingWin,
} from '../../src/lib/reading-wins/gutenbergBridge';
import { FAST_GRADE9_READING_DEMANDS_BY_ID } from '../../src/lib/reading-wins/fastSkillMap';
import { buildReadingWinSessionFromQuestions } from '../../src/lib/reading-wins/sessionBuilder';

const publicDomainPassage = `The fog had gathered before the lamps were lit, pressing close to the windows and softening the roofs across the narrow street. Clara stood by the table with the unopened letter in her hand. The room was warm, but the glass looked cold enough to touch with caution.

Outside, the carriage wheels passed and faded. Their sound seemed to carry the evening away with them, leaving the house more silent than it had been before. Clara read the first line, stopped, and folded the paper again as carefully as if it were something that might wake.`;

const transferPublicDomainPassage = `The garden path had nearly disappeared beneath the wet leaves, and the stone bench looked pale in the late afternoon light. Edwin paused at the gate. He had crossed that garden every day in summer, but now the roses hung black at the edges, and the fountain made a tired clicking sound instead of music.

Near the wall, one yellow glove lay open in the grass. It looked less like something dropped than something left behind on purpose. Edwin did not step toward it. He listened to the fountain click again and felt the old house watching from behind its dark windows.`;

function passage(
  id: string,
  title = 'The Letter at Dusk',
  text = publicDomainPassage
): GutenbergPassageForReadingWin {
  return {
    id,
    classification: 'mood_misreading',
    paragraph_text: text,
    word_count: 91,
    source_title: title,
    source_author: 'GOGI Public Domain Test',
    source_year: 1899,
    source_gutenberg_id: 71000,
    intervention_tier: 2,
    target_signal: 'uneasy',
    supporting_evidence: [
      {
        element: 'the glass looked cold enough to touch with caution',
        rationale: 'creates a cautious and uneasy feeling',
      },
      {
        element: 'as carefully as if it were something that might wake',
        rationale: 'makes the letter feel threatening or alive',
      },
    ],
    non_supporting_evidence: [
      {
        element: 'The room was warm',
        rationale: 'describes temperature rather than the passage mood',
      },
      {
        element: 'the unopened letter in her hand',
        rationale: 'states an object but does not explain the mood by itself',
      },
      {
        element: 'the lamps were lit',
        rationale: 'gives setting information without proving the uneasy effect',
      },
    ],
    plausible_distractors: ['peaceful', 'excited', 'playful'],
    tier_rationale: 'T2 because the mood is built across several details.',
  };
}

describe('Gutenberg Reading Win bridge', () => {
  it('maps approved passage classifications to Grade 9 FAST standards', () => {
    expect(mapGutenbergClassificationToFastStandard('mood_misreading')).toBe('ELA.9.R.3.1');
    expect(mapGutenbergClassificationToFastStandard('topic_vs_theme_confusion')).toBe(
      'ELA.9.R.1.2'
    );
    expect(mapGutenbergClassificationToFastStandard('structure_purpose_disconnect')).toBe(
      'ELA.9.R.2.1'
    );
  });

  it('promotes real public-domain passage evidence into a Reading Win question row', () => {
    const insert = buildGutenbergReadingWinQuestionInsert(passage('passage-0001'), {
      standardId: 'standard-r31',
    });

    expect(insert).toMatchObject({
      standard_id: 'standard-r31',
      cognitive_skill_targeted: 'ELA.9.R.3.1',
      source_classification: 'ELA.9.R.3.1',
      source: 'gutenberg_public_domain',
      approved: true,
      flagged: false,
      is_released_item: false,
    });
    expect(insert?.content).toContain('PASSAGE:');
    expect(insert?.content).toContain('Project Gutenberg passage passage-0001');
    expect(
      [
        insert?.option_a_text,
        insert?.option_b_text,
        insert?.option_c_text,
        insert?.option_d_text,
      ].join(' ')
    ).toContain('uneasy');
  });

  it('can feed the Reading Win session builder after promotion', () => {
    const demand = FAST_GRADE9_READING_DEMANDS_BY_ID['figurative-language-effect'];
    const questions = [
      ...buildGutenbergReadingWinQuestionInserts(passage('passage-1001', 'The Letter at Dusk'), {
        standardId: 'standard-r31',
        count: 5,
      }),
      ...buildGutenbergReadingWinQuestionInserts(
        passage('passage-2001', 'The Empty Garden', transferPublicDomainPassage),
        {
          standardId: 'standard-r31',
          count: 1,
        }
      ),
    ].map((item, index) => ({
      id: `q-${index}`,
      content: item.content,
      cognitive_skill_targeted: item.cognitive_skill_targeted,
      difficulty_level: item.difficulty_level,
      title: item.title,
      option_a_text: item.option_a_text,
      option_b_text: item.option_b_text,
      option_c_text: item.option_c_text,
      option_d_text: item.option_d_text,
      correct_option: item.correct_option,
      rationale: item.rationale,
      source: item.source,
      is_released_item: item.is_released_item,
    }));

    const session = buildReadingWinSessionFromQuestions({ demand, questions });

    expect(session?.items).toHaveLength(5);
    expect(session?.transferItem.transfer).toBe(true);
    expect(session?.sourcePattern).toContain('ELA.9.R.3.1');
  });
});
