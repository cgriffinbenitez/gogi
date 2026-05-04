import { describe, expect, it } from 'vitest';
import {
  isFirstWinAnswerCorrect,
  mapBenchmarkToStrengthClassification,
  selectTopStrength,
} from '../../src/lib/first-win/protocol';
import type { FirstWinItem } from '../../src/lib/first-win/types';

describe('First-Win protocol selection', () => {
  it('maps vocabulary benchmark strength to the morphology protocol', () => {
    expect(mapBenchmarkToStrengthClassification('ELA.9.V.1.2')).toBe('morphology_strength');
    expect(mapBenchmarkToStrengthClassification('ELA.9.V.1.3')).toBe('morphology_strength');
  });

  it('chooses the strongest benchmark before mapping to a protocol', () => {
    const selected = selectTopStrength({
      id: 'profile-1',
      top_strengths: [
        { benchmark_code: 'ELA.9.R.1.1', pct_correct: 0.5, attempts: 4 },
        { benchmark_code: 'ELA.9.V.1.2', pct_correct: 1, attempts: 3 },
      ],
    });

    expect(selected.benchmarkCode).toBe('ELA.9.V.1.2');
    expect(selected.strengthClassification).toBe('morphology_strength');
  });

  it('compares student responses without being brittle about case or spacing', () => {
    const item: FirstWinItem = {
      item_id: 'morph_a1',
      prompt: 'What does form mean?',
      response_type: 'multiple_choice',
      options: ['shape', 'speed'],
      correct_answer: 'shape',
      feedback_correct: 'Form = shape.',
      feedback_incorrect: 'Look at formation.',
      cognitive_focus: 'root meaning',
    };

    expect(isFirstWinAnswerCorrect(item, '  Shape  ')).toBe(true);
    expect(isFirstWinAnswerCorrect(item, 'speed')).toBe(false);
  });
});
