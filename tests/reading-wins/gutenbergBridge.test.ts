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
    standard_code: 'ELA.9.R.3.1',
    coverage_strand_id: 'mood-effect-evidence',
    coverage_strand_label: 'Mood effect with evidence',
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

function figurativePassage(id: string): GutenbergPassageForReadingWin {
  return {
    ...passage(id, 'The House Around the Corner'),
    classification: 'figurative_language_failure',
    target_signal: 'simile',
    coverage_strand_label: 'Metaphor and simile',
    supporting_evidence: [
      {
        element: 'as carefully as if it were something that might wake',
        rationale: 'makes the letter seem threatening or alive instead of ordinary',
      },
      {
        element: 'the glass looked cold enough to touch with caution',
        rationale: 'suggests the room feels tense and guarded',
      },
    ],
    non_supporting_evidence: [
      {
        element: 'The room was warm',
        rationale: 'names a literal condition but does not explain the comparison',
      },
      {
        element: 'the unopened letter in her hand',
        rationale: 'identifies an object without explaining the figurative effect',
      },
      {
        element: 'the lamps were lit',
        rationale: 'gives setting information without explaining nonliteral meaning',
      },
    ],
  };
}

function hardHardyPassage(id: string): GutenbergPassageForReadingWin {
  return {
    ...figurativePassage(id),
    source_title: 'Tess of the d’Urbervilles',
    source_author: 'Thomas Hardy',
    paragraph_text:
      'Clare arose in the light of a dawn that was ashy and furtive, as though associated with crime. The fireplace confronted him with its extinct embers; the spread supper-table, whereon stood the two full glasses of untasted wine, now flat and filmy; her vacated seat and his own; the other articles of furniture, with their eternal look of not being able to help it, their intolerable inquiry what was to be done? From above there was no sound; but in a few minutes there came a knock at the door. He remembered that it would be the neighbouring cottager’s wife, whereon he opened the window.',
    word_count: 105,
    supporting_evidence: [
      {
        element: 'a dawn that was ashy and furtive, as though associated with crime',
        rationale: 'makes the morning seem secretive and threatening',
      },
      {
        element:
          'the other articles of furniture, with their eternal look of not being able to help it, their intolerable inquiry what was to be done?',
        rationale:
          'The personification of furniture as silently, intolerably demanding an answer enacts oppression as a physical, unavoidable weight.',
      },
    ],
    non_supporting_evidence: [
      {
        element:
          'There was plenty of eggs, butter, bread, and so on in the larder, and Clare soon had breakfast laid',
        rationale: 'neutral domestic action',
      },
      {
        element: 'his experiences at the dairy having rendered him facile in domestic preparations',
        rationale: 'expository backstory about Clare’s practical competence',
      },
      {
        element:
          'being already dressed, he opened the window and informed her that they could manage to shift for themselves that morning',
        rationale: 'describes a deliberate social action',
      },
    ],
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

  it('does not promote pilot content from legacy classification alone', () => {
    const insert = buildGutenbergReadingWinQuestionInsert(
      {
        ...passage('passage-legacy-only'),
        standard_code: null,
      },
      { standardId: 'standard-r31' }
    );

    expect(insert).toBeNull();
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

  it('builds a FAST-style figurative-language effect item instead of a device-identification item', () => {
    const insert = buildGutenbergReadingWinQuestionInsert(figurativePassage('passage-3001'), {
      standardId: 'standard-r31',
    });

    expect(insert?.content).toContain('TARGET_STANDARD:\nELA.9.R.3.1');
    expect(insert?.content).toContain('TARGET_SKILL:\nMetaphor and simile');
    expect(insert?.content).toContain('GOGI_SKILL_MOVE:');
    expect(insert?.content).toContain('MASTERY_SIGNAL:');
    expect(insert?.content).toContain('FAST_ITEM_QUALITY:\nstrong signal');
    expect(insert?.content).toMatch(/comparison/);
    expect(insert?.content).not.toContain('purpose of the figurative language');
    expect(insert?.content).not.toMatch(/Which sentence contains|identify the simile/i);
    expect(insert?.rationale).toContain('Teacher trust:');
  });

  it('honors the clean coverage strand over the old mood classification', () => {
    const insert = buildGutenbergReadingWinQuestionInsert(
      {
        ...figurativePassage('passage-3101'),
        classification: 'mood_misreading',
        coverage_strand_id: 'metaphor-simile',
        coverage_strand_label: 'Metaphor and simile',
        target_signal: 'simile',
      },
      { standardId: 'standard-r31' }
    );

    expect(insert?.content).toContain('TARGET_SKILL:\nMetaphor and simile');
    expect(insert?.content).not.toContain('How does this detail affect the mood?');
    expect(insert?.content).toMatch(/figurative language|comparison|phrase/);
    expect(insert?.rationale).toContain('pass: stem matches the selected strand');
  });

  it('does not promote a passage that lacks enough evidence for a trusted item package', () => {
    const weakPassage = {
      ...figurativePassage('passage-3002'),
      supporting_evidence: [
        {
          element: 'the unopened letter in her hand',
          rationale: '',
        },
      ],
      non_supporting_evidence: [],
    };

    const insert = buildGutenbergReadingWinQuestionInsert(weakPassage, {
      standardId: 'standard-r31',
    });

    expect(insert).toBeNull();
  });

  it('blocks high-friction passages and teacher-analysis answer language from promotion', () => {
    const insert = buildGutenbergReadingWinQuestionInsert(hardHardyPassage('passage-hardy-001'), {
      standardId: 'standard-r31',
    });

    expect(insert).toBeNull();
  });

  it('keeps R.3.1 mood-effect answer choices student-facing', () => {
    const insert = buildGutenbergReadingWinQuestionInsert(
      {
        ...passage('passage-oppressive-001'),
        target_signal: 'oppressive',
        coverage_strand_id: 'mood-effect-evidence',
        coverage_strand_label: 'Mood effect with evidence',
        supporting_evidence: [
          {
            element:
              'the cold pushed through the cracks and settled in the room like a weight',
            rationale:
              'The detail enacts oppression as an unavoidable force bearing down on the room.',
          },
          {
            element: 'the windows rattled until the house seemed to hold its breath',
            rationale: 'The image enacts an oppressive feeling by making the home seem trapped.',
          },
        ],
      },
      { standardId: 'standard-r31' }
    );

    const optionText = [
      insert?.option_a_text,
      insert?.option_b_text,
      insert?.option_c_text,
      insert?.option_d_text,
    ].join(' ');

    expect(insert?.content).toContain('creates an oppressive mood');
    expect(optionText).not.toContain('a oppressive');
    expect(optionText).not.toContain('target language');
    expect(optionText).not.toContain('does not explain');
    expect(optionText).not.toContain('It points to');
    expect(optionText).not.toMatch(/\bit shows The\b/i);
  });

  it('builds non-giveaway R.3.1 answer choices for a comparison in action', () => {
    const insert = buildGutenbergReadingWinQuestionInsert(
      {
        ...figurativePassage('passage-race-001'),
        paragraph_text:
          'At that instant Hippomenes tossed ahead one of the golden apples. The rolling bright thing caught Atalanta’s eye, and full of wonder she stooped to pick it up. Hippomenes ran on. The goal was near and Hippomenes was ahead, but once again Atalanta caught up with him, and they sped side by side like two dragon-flies. For an instant his heart failed him; then, with a last prayer, he flung down the final apple.',
        word_count: 84,
        target_signal: 'simile',
        coverage_strand_id: 'metaphor-simile',
        coverage_strand_label: 'Metaphor and simile',
        supporting_evidence: [
          {
            element: 'they sped side by side like two dragon-flies',
            rationale:
              'This simile compares the racers to dragon-flies to show their quick, close movement.',
          },
          {
            element: 'The rolling bright thing caught Atalanta’s eye',
            rationale: 'shows the apple as a visual distraction',
          },
        ],
        non_supporting_evidence: [
          { element: 'his heart failed him', rationale: 'shows fear, not the comparison' },
          { element: 'he flung down the final apple', rationale: 'shows an action in the race' },
          {
            element: 'Against her will she turned to pick up the golden apple',
            rationale: 'shows distraction, not the simile',
          },
        ],
      },
      { standardId: 'standard-r31' }
    );

    const optionText = [
      insert?.option_a_text,
      insert?.option_b_text,
      insert?.option_c_text,
      insert?.option_d_text,
    ].join(' ');

    expect(optionText).toMatch(/quick, close movement|quickly and closely/);
    expect(optionText).not.toContain('does not explain');
    expect(optionText).not.toContain('It points to');
    expect(optionText).not.toMatch(/uses a comparison to help the reader understand the mood or meaning/i);
  });

  it('selects evidence that matches the clean strand before other tagged evidence', () => {
    const insert = buildGutenbergReadingWinQuestionInsert(
      {
        ...hardHardyPassage('passage-hardy-clean-001'),
        paragraph_text:
          'Clare woke before sunrise and stood in the quiet room. The chairs were pushed back from the table, and two untouched glasses waited beside a cold plate. A dawn that was ashy and furtive, as though associated with crime, spread over the windows. Clare did not speak. He looked at the empty seat across from him and understood that the silence in the room had changed everything. Outside, a cart rolled past without stopping, and the sound faded quickly down the road.',
        word_count: 83,
        non_supporting_evidence: [
          {
            element: 'The chairs were pushed back from the table',
            rationale: 'names a literal detail but does not explain the comparison',
          },
          {
            element: 'two untouched glasses waited beside a cold plate',
            rationale: 'describes the room but does not explain the comparison',
          },
        ],
      },
      {
        standardId: 'standard-r31',
      }
    );

    expect(insert?.content).toContain(
      'a dawn that was ashy and furtive, as though associated with crime'
    );
    expect(insert?.content).not.toContain(
      'their eternal look of not being able to help it'
    );
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
