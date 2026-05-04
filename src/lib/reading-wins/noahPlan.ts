import { FAST_GRADE9_READING_DEMANDS_BY_ID } from './fastSkillMap';

export type ReadingWinPlanStep = {
  id: string;
  studentTitle: string;
  teacherTitle: string;
  standardCode: string;
  standardText: string;
  gapHypothesis: string;
  studentMove: string;
  proofOfGrowth: string;
  fastDemand?: string;
  commonMiss?: string;
  itemShape?: string;
};

const figurativeLanguageEffect = FAST_GRADE9_READING_DEMANDS_BY_ID['figurative-language-effect'];
const literaryKeyElementLayer = FAST_GRADE9_READING_DEMANDS_BY_ID['literary-key-element-layer'];

export const NOAH_READING_WIN_PLAN: ReadingWinPlanStep[] = [
  {
    id: figurativeLanguageEffect.id,
    studentTitle: figurativeLanguageEffect.studentTitle,
    teacherTitle: figurativeLanguageEffect.teacherTitle,
    standardCode: figurativeLanguageEffect.standardCode,
    standardText: figurativeLanguageEffect.standardText,
    gapHypothesis:
      'Noah may be reading figurative language too literally or naming a feeling without connecting it to the author’s language.',
    studentMove: figurativeLanguageEffect.studentMove,
    proofOfGrowth: figurativeLanguageEffect.proofOfGrowth,
    fastDemand: figurativeLanguageEffect.fastDemand,
    commonMiss: figurativeLanguageEffect.commonMiss,
    itemShape: figurativeLanguageEffect.itemShape,
  },
  {
    id: literaryKeyElementLayer.id,
    studentTitle: literaryKeyElementLayer.studentTitle,
    teacherTitle: literaryKeyElementLayer.teacherTitle,
    standardCode: literaryKeyElementLayer.standardCode,
    standardText: literaryKeyElementLayer.standardText,
    gapHypothesis:
      'Noah may notice an important detail but not explain how it adds meaning, mood, style, or theme.',
    studentMove: literaryKeyElementLayer.studentMove,
    proofOfGrowth: literaryKeyElementLayer.proofOfGrowth,
    fastDemand: literaryKeyElementLayer.fastDemand,
    commonMiss: literaryKeyElementLayer.commonMiss,
    itemShape: literaryKeyElementLayer.itemShape,
  },
  {
    id: 'evidence-to-explanation',
    studentTitle: 'Turn evidence into an explanation',
    teacherTitle: 'Evidence supports literary analysis',
    standardCode: 'ELA.9.R.1.1',
    standardText:
      'Explain how key elements enhance or add layers of meaning and/or style in a literary text.',
    gapHypothesis:
      'Noah may choose a relevant detail but stop before explaining the author’s effect.',
    studentMove: 'After evidence, add: this matters because...',
    proofOfGrowth:
      'Noah writes a two-part answer: exact evidence plus a clear effect on meaning or mood.',
  },
];

export function getNoahPrimaryReadingWin() {
  return NOAH_READING_WIN_PLAN[0];
}
