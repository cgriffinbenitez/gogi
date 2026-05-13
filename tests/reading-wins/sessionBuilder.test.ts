import { describe, expect, it } from 'vitest';
import { FAST_GRADE9_READING_DEMANDS_BY_ID } from '../../src/lib/reading-wins/fastSkillMap';
import { buildReadingWinSessionFromQuestions } from '../../src/lib/reading-wins/sessionBuilder';

const demand = FAST_GRADE9_READING_DEMANDS_BY_ID['figurative-language-effect'];

const baseQuestion = {
  cognitive_skill_targeted: 'ELA.9.R.3.1',
  difficulty_level: 2,
  title: 'The Dock',
  option_a_text: 'It makes the setting seem watchful and unsettling.',
  option_b_text: 'It shows the character is excited to arrive.',
  option_c_text: 'It explains why the setting is familiar.',
  option_d_text: 'It proves the conflict has ended.',
  correct_option: 'A',
  rationale: 'The answer connects the image to the effect on the passage.',
  source: 'gogi_original_fast_aligned',
  is_released_item: false,
};

function dockQuestion(id: string, phrase: string, prompt: string, difficultyLevel = 2) {
  return {
    ...baseQuestion,
    id,
    difficulty_level: difficultyLevel,
    content: `PASSAGE:
Mara waited at the edge of the old ferry dock while the last blue line of daylight slipped behind the marsh grass. The dock had been closed for years, but everyone in town still used it as a shortcut to the beach. Tonight, with the tide crawling underneath, every board seemed to answer her steps.

Across the channel, the lighthouse blinked once and then disappeared behind a sheet of fog. Mara had promised her brother she would bring back the notebook he had left in the bait house, but the small building looked farther away than it had in daylight. The wind moved through the reeds and dragged its fingers along the dock rail.

She stopped. The sound was not loud, but it made the whole place feel awake, as if the marsh had been waiting for someone to arrive. Mara told herself it was only a bird, only wind, only water rubbing against wood. Then the fog thinned just enough for her to see the bait house door standing open.

QUESTION:
${prompt}

OPTIONS:
A. It makes the setting seem watchful and unsettling.
B. It shows the character is excited to arrive at the bait house.
C. It explains why the setting is familiar to the character.
D. It proves the conflict has ended before Mara arrives.

ANSWER:
A`,
    option_a_text: 'It makes the setting seem watchful and unsettling.',
    option_b_text: `It shows Mara is excited because of ${phrase}.`,
    option_c_text: 'It explains why the dock is familiar and safe.',
    option_d_text: 'It proves the tension has fully ended.',
  };
}

describe('Reading Win session builder', () => {
  it('turns promoted question-bank rows into a Reading Win session', () => {
    const session = buildReadingWinSessionFromQuestions({
      demand,
      questions: [
        dockQuestion(
          'q1',
          'dragged its fingers',
          'How does the phrase “dragged its fingers” affect the passage?',
          1
        ),
        dockQuestion(
          'q2',
          'dark water seemed to listen',
          'How does the figurative image of the dark water affect the reader’s understanding?',
          2
        ),
        dockQuestion(
          'q3',
          'bait house waited',
          'How does the image of the bait house affect the mood of the passage?',
          3
        ),
        dockQuestion(
          'q4',
          'sound was only weather',
          'How does the repeated idea that the sound is “only weather” affect the meaning?',
          4
        ),
        dockQuestion(
          'q5',
          'dock seemed to listen',
          'Which answer best explains how the figurative description affects the passage?',
          5
        ),
        {
          ...baseQuestion,
          id: 'q6',
          title: 'The Field',
          content:
            'PASSAGE:\nThe practice field was empty after the storm. Water shivered in the low places, and the goalposts stood at the far end like two pale bones against the sky. No one had bothered to reset the scoreboard; it flashed a single crooked zero whenever the wind pushed through the wires.\n\nNoah stepped over a fallen branch and felt the grass give under his shoes. He had come back for the cleats he left beneath the bench, but the field looked less like a place for games than a place that had been abandoned mid-breath. Even the painted lines seemed to fade before they reached the end zone.\n\nWhen the scoreboard flickered and went dark, Noah stopped walking. The silence after it felt larger than the sound itself.\n\nQUESTION:\nHow does the image of the goalposts affect the mood?\n\nOPTIONS:\nA. It makes the field seem bleak and lifeless after the storm.\nB. It shows that the field is ready for an exciting game.\nC. It explains why Noah knows exactly where to go next.\nD. It proves that the storm caused no real damage nearby.\n\nANSWER:\nA',
        },
      ],
    });

    expect(session?.benchmarkCode).toBe('ELA.9.R.3.1');
    expect(session?.items).toHaveLength(5);
    expect(session?.items[0].scaffold).toContain("Today's skill:");
    expect(session?.items[0].scaffold).toContain('Mastery means:');
    expect(session?.transferItem.transfer).toBe(true);
    expect(session?.sourcePattern).toContain('Promoted GOGI question bank');
  });

  it('returns null when rows do not contain enough passage-backed questions', () => {
    const session = buildReadingWinSessionFromQuestions({
      demand,
      questions: [
        {
          ...baseQuestion,
          id: 'q1',
          content: 'QUESTION:\nHow does the sentence affect the passage?',
        },
      ],
    });

    expect(session).toBeNull();
  });

  it('rejects duplicate low-fidelity reps instead of turning them into a session', () => {
    const repeated = {
      ...baseQuestion,
      content:
        'PASSAGE:\nA student project changed the neighborhood.\n\nQUESTION:\nWhat is the meaning of the word project?\n\nOPTIONS:\nA. A plan.\nB. A test.\nC. A place.\nD. A person.\n\nANSWER:\nA',
    };

    const session = buildReadingWinSessionFromQuestions({
      demand,
      questions: [
        { ...repeated, id: 'q1' },
        { ...repeated, id: 'q2' },
        { ...repeated, id: 'q3', title: 'Second Passage' },
      ],
    });

    expect(session).toBeNull();
  });
});
