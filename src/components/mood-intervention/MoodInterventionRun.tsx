'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Check, MousePointer2 } from 'lucide-react';
import { C, FONTS } from '@/lib/constants/design';

export type MoodPassage = {
  id?: string;
  title: string;
  author: string;
  text: string;
  canonicalMood?: string | null;
};

export type MoodInterventionResult = {
  stageHistory: MoodStageRecord[];
  masteryAchieved: boolean;
  completedAt: string;
};

type MoodStageRecord = {
  round: string;
  passageTitle: string;
  evidence: string[];
  feeling: {
    light: 'dark' | 'bright' | null;
    energy: 'tense' | 'calm' | null;
  };
  mood: string | null;
  defended: boolean;
  aligned: boolean;
};

type MoodInterventionRunProps = {
  diagnosticPassage: MoodPassage;
  transferPassage?: MoodPassage | null;
  keywordFlags?: string[];
  loading?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onComplete?: (result: MoodInterventionResult) => void;
};

type StepKey = 'read' | 'evidence' | 'feeling' | 'mood' | 'prove';
type RoundKey = 'learn' | 'guided' | 'solo' | 'transfer';
type EvidenceCue = { word: string; kind: 'word' | 'image' | 'sound' | 'silence' | 'pace' };
type LessonKey = 'mood' | 'moodWords' | 'signals';

const FALLBACK_PASSAGE: MoodPassage = {
  title: 'Practice: Nathan in the Old House',
  author: 'Mood Reteach & Practice sample',
  text: [
    'Nathan had been in the old house before, but this was the first time he was left alone for the evening. A scratching sound against the house made him start.',
    'He realized it was only the telephone wire slapping in the wind. A low moan came from the basement. "Ah, it is only the furnace," he thought.',
    'But what was that sound upstairs? Footsteps? Was someone in the house? Suddenly, three loud knocks sounded at the front door. Nathan jumped to his feet. "Why did they not ring the doorbell?" he wondered.',
  ].join('\n\n'),
  canonicalMood: 'tense',
};

const PRACTICE_PASSAGES: Record<'guided' | 'solo', MoodPassage> = {
  guided: {
    title: 'Practice Poem: A Cold Shadow',
    author: 'Mood Reteach & Practice sample',
    text: [
      'A cold shadow falls upon my mind.',
      'My heart shivers when I remember that you left me.',
    ].join('\n\n'),
    canonicalMood: 'lonely',
  },
  solo: {
    title: 'Assess Passage: At the Beach',
    author: 'Mood Reteach & Practice sample',
    text: [
      'Our whole family spent the day at the beach. It was a bright and breezy day, perfect for flying kites.',
      'My father held the kite high as I unrolled the cord. I started running across the sparkling sand. The kite rose easily on the wind.',
      'My parents cheered. Once aloft, the kite leaped in the air like a trout in blue water. I gave the cord to my little sister. As she felt the tugging of the kite, she laughed out loud. "I am fishing in the sky."',
    ].join('\n\n'),
    canonicalMood: 'joyful',
  },
};

const TRANSFER_FALLBACK_PASSAGE: MoodPassage = {
  title: 'Final Assess Poem: What Is Left?',
  author: 'Mood Reteach & Practice sample',
  text: [
    'What is left? The house is gone.',
    'Charred sticks chewed by flame. Smoke thinning to a flimsy fog. Gone.',
    'What is left? Ah, I see you now. Red-eyed, coughing, weeping sooty tears, but alive. Oh, alive!',
  ].join('\n\n'),
  canonicalMood: 'hopeful',
};

const ROUNDS: Array<{ key: RoundKey; label: string; support: string }> = [
  { key: 'learn', label: 'Learn the move', support: 'Full help' },
  { key: 'guided', label: 'Guided practice', support: 'Less help' },
  { key: 'solo', label: 'Independent practice', support: 'No answer reveal' },
  { key: 'transfer', label: 'Fresh passage', support: 'Transfer check' },
];

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'read', label: 'Read' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'feeling', label: 'Feeling' },
  { key: 'mood', label: 'Mood' },
  { key: 'prove', label: 'Prove' },
];

const LESSONS: Array<{ key: LessonKey; label: string }> = [
  { key: 'mood', label: 'What is mood?' },
  { key: 'moodWords', label: 'What are mood words?' },
  { key: 'signals', label: 'What creates mood?' },
];

const MOOD_CUES: EvidenceCue[] = [
  { word: 'quiet', kind: 'silence' },
  { word: 'silent', kind: 'silence' },
  { word: 'silence', kind: 'silence' },
  { word: 'still', kind: 'silence' },
  { word: 'dark', kind: 'image' },
  { word: 'wind', kind: 'sound' },
  { word: 'scratching', kind: 'sound' },
  { word: 'slapping', kind: 'sound' },
  { word: 'moan', kind: 'sound' },
  { word: 'footsteps', kind: 'sound' },
  { word: 'suddenly', kind: 'pace' },
  { word: 'loud', kind: 'sound' },
  { word: 'jumped', kind: 'pace' },
  { word: 'scraped', kind: 'sound' },
  { word: 'groan', kind: 'sound' },
  { word: 'knocks', kind: 'sound' },
  { word: 'moving', kind: 'pace' },
  { word: 'bell', kind: 'sound' },
  { word: 'cold', kind: 'word' },
  { word: 'shivers', kind: 'word' },
  { word: 'left', kind: 'word' },
  { word: 'dull', kind: 'word' },
  { word: 'thick', kind: 'image' },
  { word: 'matted', kind: 'image' },
  { word: 'clinging', kind: 'image' },
  { word: 'huge', kind: 'image' },
  { word: 'stately', kind: 'word' },
  { word: 'danger', kind: 'word' },
  { word: 'survived', kind: 'word' },
  { word: 'queenly', kind: 'word' },
  { word: 'alone', kind: 'silence' },
  { word: 'shadow', kind: 'image' },
  { word: 'ruin', kind: 'image' },
  { word: 'dream', kind: 'word' },
  { word: 'pitiful', kind: 'word' },
  { word: 'hoarded', kind: 'word' },
  { word: 'tattered', kind: 'image' },
  { word: 'owls', kind: 'image' },
  { word: 'small', kind: 'image' },
  { word: 'empty', kind: 'image' },
  { word: 'last', kind: 'pace' },
  { word: 'slow', kind: 'pace' },
  { word: 'torn', kind: 'image' },
  { word: 'faded', kind: 'pace' },
  { word: 'wet', kind: 'image' },
  { word: 'groaning', kind: 'sound' },
  { word: 'careful', kind: 'pace' },
  { word: 'shook', kind: 'word' },
  { word: 'dust', kind: 'image' },
  { word: 'cracked', kind: 'image' },
  { word: 'dragged', kind: 'sound' },
  { word: 'softly', kind: 'sound' },
  { word: 'lost', kind: 'word' },
  { word: 'brown', kind: 'image' },
  { word: 'thin', kind: 'image' },
  { word: 'weeds', kind: 'image' },
  { word: 'shut', kind: 'image' },
  { word: 'sputtered', kind: 'sound' },
  { word: 'erased', kind: 'image' },
  { word: 'blade', kind: 'image' },
  { word: 'clicked', kind: 'sound' },
  { word: 'click', kind: 'sound' },
  { word: 'scrape', kind: 'sound' },
  { word: 'slowly', kind: 'pace' },
  { word: 'stopped', kind: 'pace' },
  { word: 'rain', kind: 'image' },
  { word: 'bright', kind: 'image' },
  { word: 'breezy', kind: 'image' },
  { word: 'sparkling', kind: 'image' },
  { word: 'easily', kind: 'pace' },
  { word: 'cheered', kind: 'sound' },
  { word: 'leaped', kind: 'pace' },
  { word: 'laughed', kind: 'sound' },
  { word: 'gone', kind: 'word' },
  { word: 'charred', kind: 'image' },
  { word: 'chewed', kind: 'image' },
  { word: 'flame', kind: 'image' },
  { word: 'smoke', kind: 'image' },
  { word: 'flimsy', kind: 'image' },
  { word: 'red-eyed', kind: 'image' },
  { word: 'coughing', kind: 'sound' },
  { word: 'weeping', kind: 'word' },
  { word: 'sooty', kind: 'image' },
  { word: 'alive', kind: 'word' },
  { word: 'blinked', kind: 'image' },
  { word: 'knocked', kind: 'sound' },
];

const MOOD_OPTIONS = ['tense', 'joyful', 'lonely', 'hopeful'];

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'along', 'also', 'been', 'before', 'being', 'between',
  'called', 'could', 'every', 'first', 'from', 'have', 'their', 'there', 'these',
  'thing', 'those', 'through', 'under', 'where', 'which', 'while', 'with', 'would',
  'years', 'later', 'only', 'were', 'some', 'extent', 'whole', 'stretch', 'every',
  'known', 'build', 'back', 'that', 'fact', 'daughter', 'woman', 'sister',
]);

function dedupe(items: EvidenceCue[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evidenceFromPassage(text: string, keywordFlags: string[] = [], round: RoundKey): EvidenceCue[] {
  const lower = text.toLowerCase();
  const flagged: EvidenceCue[] = keywordFlags
    .filter((word) => word && lower.includes(word.toLowerCase()))
    .slice(0, 4)
    .map((word) => ({ word, kind: 'word' }));

  const matched = MOOD_CUES.filter((cue) => lower.includes(cue.word.toLowerCase()));
  const cues = dedupe([...flagged, ...matched]);
  const fallback = cues.length >= 3 ? cues : dedupe([...cues, ...extractDescriptiveFallback(text)]);

  if (round === 'solo' || round === 'transfer') return fallback.slice(0, 6);
  return fallback.slice(0, 8);
}

function extractDescriptiveFallback(text: string): EvidenceCue[] {
  const words = text
    .replace(/[“”‘’]/g, '')
    .match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) ?? [];
  const candidates: EvidenceCue[] = [];

  for (const raw of words) {
    const word = raw.toLowerCase();
    if (STOP_WORDS.has(word)) continue;
    if (candidates.some((item) => item.word.toLowerCase() === word)) continue;
    candidates.push({ word: raw, kind: guessCueKind(word) });
    if (candidates.length >= 8) break;
  }

  return candidates;
}

function guessCueKind(word: string): EvidenceCue['kind'] {
  if (/(sound|heard|whisper|click|scrape|knock|owl)/.test(word)) return 'sound';
  if (/(silent|silence|alone|empty|still)/.test(word)) return 'silence';
  if (/(slow|sudden|stopped|quick)/.test(word)) return 'pace';
  if (/(wall|brick|vine|shadow|ruin|light|dark|red|gray|matted|tattered)/.test(word)) return 'image';
  return 'word';
}

function getPassageForRound(
  round: RoundKey,
  diagnosticPassage: MoodPassage,
  _transferPassage?: MoodPassage | null,
) {
  if (round === 'learn') return diagnosticPassage.text ? diagnosticPassage : FALLBACK_PASSAGE;
  if (round === 'guided') return PRACTICE_PASSAGES.guided;
  if (round === 'solo') return PRACTICE_PASSAGES.solo;
  return TRANSFER_FALLBACK_PASSAGE;
}

function buildDefense(evidence: string[], light: string | null, energy: string | null, mood: string | null) {
  const words = evidence.length ? evidence.join(' and ') : 'the words I chose';
  const feeling = light && energy ? `${light} and ${energy}` : 'a clear feeling';
  return `The passage feels ${mood ?? 'this way'} because ${words} make it feel ${feeling}.`;
}

function highlightPassage(
  text: string,
  cues: EvidenceCue[],
  selected: string[],
  onToggle: (word: string) => void,
) {
  const words = cues.map((cue) => cue.word).sort((a, b) => b.length - a.length);
  if (!words.length) return text;

  const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`\\b(${pattern})\\b`, 'gi');
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const word = match[0];
    const active = selected.some((item) => item.toLowerCase() === word.toLowerCase());
    nodes.push(
      <button
        className={`passageWord ${active ? 'selected' : ''}`}
        key={`${word}-${match.index}`}
        onClick={() => onToggle(word)}
        type="button"
      >
        {word}
      </button>,
    );
    cursor = match.index + word.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export function MoodInterventionRun({
  diagnosticPassage,
  transferPassage,
  keywordFlags = [],
  loading = false,
  saving = false,
  saveError,
  onComplete,
}: MoodInterventionRunProps) {
  const [lessonIndex, setLessonIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [light, setLight] = useState<'dark' | 'bright' | null>(null);
  const [energy, setEnergy] = useState<'tense' | 'calm' | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [history, setHistory] = useState<MoodStageRecord[]>([]);

  const lessonDone = lessonIndex >= LESSONS.length;
  const lesson = LESSONS[Math.min(lessonIndex, LESSONS.length - 1)];
  const round = ROUNDS[roundIndex];
  const step = STEPS[stepIndex];
  const passage = useMemo(
    () => getPassageForRound(round.key, diagnosticPassage, transferPassage),
    [diagnosticPassage, round.key, transferPassage],
  );
  const cues = useMemo(
    () => evidenceFromPassage(passage.text, round.key === 'learn' ? keywordFlags : [], round.key),
    [keywordFlags, passage.text, round.key],
  );

  const neededEvidence = round.key === 'learn' ? 1 : 2;
  const targetMood = (passage.canonicalMood ?? FALLBACK_PASSAGE.canonicalMood ?? '').toLowerCase();
  const moodAligned = !!mood && (!targetMood || mood === targetMood);
  const canContinue =
    step.key === 'read' ||
    (step.key === 'evidence' && selectedEvidence.length >= neededEvidence) ||
    (step.key === 'feeling' && light && energy) ||
    (step.key === 'mood' && mood) ||
    step.key === 'prove';

  function resetForNextRound(nextRoundIndex: number) {
    setRoundIndex(nextRoundIndex);
    setStepIndex(0);
    setSelectedEvidence([]);
    setLight(null);
    setEnergy(null);
    setMood(null);
    setFeedback('');
  }

  function toggleEvidence(word: string) {
    setSelectedEvidence((current) => {
      const match = current.find((item) => item.toLowerCase() === word.toLowerCase());
      if (match) return current.filter((item) => item !== match);
      return [...current, word].slice(0, 3);
    });
    setFeedback('');
  }

  function continueStep() {
    if (!canContinue || saving) return;

    if (step.key === 'mood' && mood && targetMood && !moodAligned) {
      setFeedback('That mood names an answer, but it does not fit the evidence yet. Go back to the feeling: dark or bright, tense or calm.');
      return;
    }

    if (step.key !== 'prove') {
      setStepIndex((index) => index + 1);
      setFeedback('');
      return;
    }

    const record: MoodStageRecord = {
      round: round.key,
      passageTitle: passage.title,
      evidence: selectedEvidence,
      feeling: { light, energy },
      mood,
      defended: selectedEvidence.length >= neededEvidence,
      aligned: moodAligned,
    };
    const nextHistory = [...history, record];
    setHistory(nextHistory);

    if (roundIndex < ROUNDS.length - 1) {
      resetForNextRound(roundIndex + 1);
      return;
    }

    const masteryAchieved = nextHistory
      .filter((item) => item.round === 'solo' || item.round === 'transfer')
      .every((item) => item.aligned && item.defended);
    onComplete?.({
      stageHistory: nextHistory,
      masteryAchieved,
      completedAt: new Date().toISOString(),
    });
  }

  function stepPrompt() {
    if (step.key === 'read') return 'Read once. Do not answer yet. Just notice how the passage feels.';
    if (step.key === 'evidence') return `Tap ${neededEvidence} word${neededEvidence > 1 ? 's' : ''} or details in the passage that create the feeling.`;
    if (step.key === 'feeling') return 'Use your evidence. Does it make the passage feel dark or bright? Tense or calm?';
    if (step.key === 'mood') return 'Now name the mood. Pick the word that best matches your evidence and feeling.';
    return 'Prove it. The formula should make sense: words build a feeling, and the feeling points to the mood.';
  }

  return (
    <main className="moodCoach">
      <header className="topBar">
        <div>
          <div className="eyebrow">GOGI Mood Move</div>
          <h1>Use words to name the feeling</h1>
        </div>
        <div className="formula" aria-label="Mood formula">
          <span className={!lessonDone || step.key === 'evidence' ? 'active' : ''}>Signal words</span>
          <span className={lessonDone && step.key === 'feeling' ? 'active' : ''}>Feeling</span>
          <span className={lessonDone && step.key === 'mood' ? 'active' : ''}>Mood</span>
          <span className={lessonDone && step.key === 'prove' ? 'active' : ''}>Proof</span>
        </div>
      </header>

      {!lessonDone ? (
        <section className="workspace">
          <section className="lessonPanel">
            <div className="panelKicker">Before the passage</div>
            <h2>{lesson.label}</h2>
            {lesson.key === 'mood' ? (
              <>
                <p className="lessonLead">Mood is the feeling a passage creates in the reader.</p>
                <div className="formulaMap">
                  <div>
                    <strong>Signal words</strong>
                    <span>cold light, silence, ruined room</span>
                  </div>
                  <ArrowRight size={18} />
                  <div>
                    <strong>Feeling</strong>
                    <span>dark + tense</span>
                  </div>
                  <ArrowRight size={18} />
                  <div>
                    <strong>Mood</strong>
                    <span>ominous</span>
                  </div>
                </div>
                <div className="compareGrid">
                  <div>
                    <strong>Not mood</strong>
                    <p>What happened: the door opened.</p>
                  </div>
                  <div>
                    <strong>Mood</strong>
                    <p>How it feels: ominous, lonely, peaceful, tense.</p>
                  </div>
                </div>
              </>
            ) : lesson.key === 'moodWords' ? (
              <>
                <p className="lessonLead">Mood words name the feeling. They are usually one-word answers.</p>
                <div className="moodWordGrid">
                  <div className="darkMood"><strong>tense</strong><span>nervous, tight, waiting for something</span></div>
                  <div className="darkMood"><strong>ominous</strong><span>dark, threatening, something bad may happen</span></div>
                  <div><strong>lonely</strong><span>empty, isolated, missing something</span></div>
                  <div><strong>peaceful</strong><span>calm, safe, settled</span></div>
                  <div><strong>joyful</strong><span>bright, happy, full of energy</span></div>
                  <div><strong>gloomy</strong><span>sad, heavy, low</span></div>
                </div>
                <div className="noteBox">
                  Mood words are the answer. Signal words are the proof.
                </div>
              </>
            ) : (
              <>
                <p className="lessonLead">Signal words are clues. They are not the final mood answer. They are the words that create the feeling.</p>
                <div className="signalGrid">
                  <div><strong>Light / color</strong><span>cold shadow, bright, sparkling</span></div>
                  <div><strong>Sound / silence</strong><span>scratching, low moan, loud knocks</span></div>
                  <div><strong>Place / image</strong><span>old house, charred sticks, blue water</span></div>
                  <div><strong>Action / pace</strong><span>suddenly, leaped, thinning, gone</span></div>
                </div>
              </>
            )}
          </section>

          <aside className="stepPanel">
            <div className="stepTop">
              <div className="stepCount">Learn {lessonIndex + 1} of {LESSONS.length}</div>
              <h2>
                {lesson.key === 'mood'
                  ? 'Mood is the destination'
                  : lesson.key === 'moodWords'
                    ? 'Mood words name it'
                    : 'Signals are the clues'}
              </h2>
              <p>
                {lesson.key === 'mood'
                  ? 'Do not start by guessing a mood word. Start by looking for clues that create a feeling.'
                  : lesson.key === 'moodWords'
                    ? 'A mood word is the label you choose after you understand the feeling.'
                    : 'When you read, hunt for words that change the air of the passage. Then use those clues to name the mood.'}
              </p>
            </div>

            <div className="gogiBox">
              <div className="gogiMark">G</div>
              <p>
                {lesson.key === 'mood'
                  ? 'The formula is simple: signal words create a feeling, and that feeling points to a mood.'
                  : lesson.key === 'moodWords'
                    ? 'Do not hunt for the answer first. The answer gets easier after you collect proof.'
                    : 'In the passage, you will tap signal words first. After that, naming the mood gets way easier.'}
              </p>
            </div>

            <div className="proofBox">
              <div className="miniLabel">The sentence we are building toward</div>
              <p>The mood is ___ because the words ___ and ___ make the passage feel ___.</p>
            </div>

            <button
              className="continueButton"
              onClick={() => setLessonIndex((index) => index + 1)}
              type="button"
            >
              {lessonIndex === LESSONS.length - 1 ? 'Start passage practice' : 'Next'}
              <ArrowRight size={18} />
            </button>
          </aside>
        </section>
      ) : (
      <section className="workspace">
        <section className="passagePanel">
          <div className="panelKicker">{step.key === 'evidence' ? 'Passage · tap mood signals' : 'Passage'}</div>
          <div className="passageHeader">
            <div>
              <h2>{loading ? 'Getting your passage' : passage.title}</h2>
              <p>{loading ? 'This should only take a moment.' : passage.author}</p>
            </div>
            <div className="roundBadge">
              <strong>{round.label}</strong>
              <span>{round.support}</span>
            </div>
          </div>
          <div className={`passageText ${step.key === 'evidence' ? 'selecting' : ''}`}>
            {loading
              ? 'GOGI is getting the passage. Stay here.'
              : highlightPassage(passage.text, cues, selectedEvidence, toggleEvidence)}
          </div>
          {step.key === 'evidence' && (
            <div className="tapHint">
              <MousePointer2 size={16} />
              Tap the highlighted words that change how the passage feels.
            </div>
          )}
        </section>

        <aside className="stepPanel">
          <div className="stepTop">
            <div className="stepCount">Step {stepIndex + 1} of {STEPS.length}</div>
            <h2>{step.label}</h2>
            <p>{stepPrompt()}</p>
          </div>

          <div className="gogiBox">
            <div className="gogiMark">G</div>
            <p>
              {step.key === 'read'
                ? 'Good readers slow down before they name mood. First, let the passage create a feeling.'
                : step.key === 'evidence'
                  ? 'Mood has to come from words on the page. Choose the words that change the air.'
                  : step.key === 'feeling'
                    ? 'This is the pattern: evidence first, feeling second, mood third.'
                    : step.key === 'mood'
                      ? 'Do not pick the coolest word. Pick the word your evidence can prove.'
                      : 'That is the move. You can use it on any passage.'}
            </p>
          </div>

          {step.key !== 'read' && (
            <div className="evidenceBox">
              <div className="miniLabel">Your evidence</div>
              <div className="evidenceList">
                {selectedEvidence.length ? selectedEvidence.map((word) => (
                  <button key={word} onClick={() => toggleEvidence(word)} type="button">
                    {word}
                  </button>
                )) : (
                  <span>Tap words in the passage.</span>
                )}
              </div>
            </div>
          )}

          {step.key === 'feeling' && (
            <div className="choiceStack">
              <div>
                <div className="miniLabel">Do the words feel...</div>
                <div className="choiceRow">
                  <button className={light === 'dark' ? 'selected' : ''} onClick={() => setLight('dark')} type="button">Dark</button>
                  <button className={light === 'bright' ? 'selected' : ''} onClick={() => setLight('bright')} type="button">Bright</button>
                </div>
              </div>
              <div>
                <div className="miniLabel">And are they...</div>
                <div className="choiceRow">
                  <button className={energy === 'tense' ? 'selected' : ''} onClick={() => setEnergy('tense')} type="button">Tense</button>
                  <button className={energy === 'calm' ? 'selected' : ''} onClick={() => setEnergy('calm')} type="button">Calm</button>
                </div>
              </div>
            </div>
          )}

          {step.key === 'mood' && (
            <div className="choiceStack">
              <div className="feelingSummary">
                Your evidence feels <strong>{light ?? '...'}</strong> + <strong>{energy ?? '...'}</strong>.
              </div>
              <div className="moodChoices">
                {MOOD_OPTIONS.map((option) => (
                  <button
                    className={mood === option ? 'selected' : ''}
                    key={option}
                    onClick={() => {
                      setMood(option);
                      setFeedback('');
                    }}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step.key === 'prove' && (
            <div className="proofBox">
              <div className="miniLabel">Your proof</div>
              <p>{buildDefense(selectedEvidence, light, energy, mood)}</p>
            </div>
          )}

          {feedback && <div className="feedback">{feedback}</div>}
          {saveError && <div className="errorBox">{saveError}</div>}

          <button className="continueButton" disabled={!canContinue || saving} onClick={continueStep} type="button">
            {step.key === 'prove'
              ? roundIndex === ROUNDS.length - 1
                ? saving ? 'Saving...' : 'Finish Mood Move'
                : 'Next passage'
              : step.key === 'read'
                ? 'I read it'
                : 'Continue'}
            <ArrowRight size={18} />
          </button>

          <div className="roundDots">
            {ROUNDS.map((item, index) => (
              <span className={index === roundIndex ? 'active' : index < roundIndex ? 'done' : ''} key={item.key}>
                {index < roundIndex ? <Check size={13} /> : index + 1}
              </span>
            ))}
          </div>
        </aside>
      </section>
      )}

      <style jsx>{`
        .moodCoach {
          background: #eef3f6;
          color: ${C.dark};
          display: flex;
          flex-direction: column;
          font-family: ${FONTS.ui};
          height: 100vh;
          min-width: 1180px;
          overflow: hidden;
        }

        .topBar {
          align-items: center;
          background: #173a5d;
          color: ${C.white};
          display: flex;
          flex: 0 0 64px;
          justify-content: space-between;
          padding: 0 24px;
        }

        .eyebrow,
        .panelKicker,
        .miniLabel,
        .stepCount {
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .eyebrow {
          color: rgba(255,255,255,.62);
        }

        h1,
        h2,
        p {
          margin: 0;
        }

        h1 {
          font-size: 23px;
          font-weight: 850;
          line-height: 1.12;
        }

        .formula {
          display: flex;
          gap: 8px;
        }

        .formula span {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 999px;
          color: rgba(255,255,255,.72);
          font-size: 12px;
          font-weight: 800;
          padding: 8px 12px;
        }

        .formula span.active {
          background: ${C.greenLight};
          border-color: ${C.greenBorder};
          color: #173a5d;
        }

        .workspace {
          display: grid;
          flex: 1;
          gap: 16px;
          grid-template-columns: minmax(0, 58%) minmax(430px, 42%);
          min-height: 0;
          padding: 16px 24px 20px;
        }

        .passagePanel,
        .lessonPanel,
        .stepPanel {
          background: rgba(255,255,255,.96);
          border: 1px solid rgba(31,78,121,.16);
          border-radius: 8px;
          box-shadow: 0 12px 30px rgba(31,78,121,.08);
          min-height: 0;
        }

        .passagePanel,
        .lessonPanel {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 20px 22px;
        }

        .lessonPanel h2 {
          color: ${C.dark};
          font-size: 30px;
          font-weight: 900;
          line-height: 1.12;
          margin-top: 10px;
        }

        .lessonLead {
          color: ${C.dark};
          font-size: 22px;
          font-weight: 750;
          line-height: 1.35;
          margin-top: 18px;
          max-width: 760px;
        }

        .formulaMap {
          align-items: center;
          background: #eef6f0;
          border: 1px solid #c7dfd0;
          border-radius: 8px;
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr auto 1fr auto 1fr;
          margin-top: 24px;
          padding: 16px;
        }

        .formulaMap div,
        .compareGrid div,
        .moodWordGrid div,
        .signalGrid div {
          background: ${C.white};
          border: 1px solid ${C.border};
          border-radius: 8px;
          padding: 14px;
        }

        .formulaMap strong,
        .compareGrid strong,
        .moodWordGrid strong,
        .signalGrid strong {
          color: #173a5d;
          display: block;
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .formulaMap span,
        .moodWordGrid span,
        .signalGrid span {
          color: ${C.dark};
          display: block;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.35;
        }

        .compareGrid,
        .moodWordGrid,
        .signalGrid {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .compareGrid {
          grid-template-columns: 1fr 1fr;
        }

        .signalGrid {
          grid-template-columns: 1fr 1fr;
        }

        .moodWordGrid {
          grid-template-columns: repeat(3, 1fr);
        }

        .moodWordGrid strong {
          font-size: 18px;
          text-transform: capitalize;
        }

        .moodWordGrid .darkMood {
          background: #eef6f0;
          border-color: #c7dfd0;
        }

        .noteBox {
          background: #fffaf0;
          border: 1px solid #ead49a;
          border-radius: 8px;
          color: #6d5a32;
          font-size: 17px;
          font-weight: 850;
          line-height: 1.4;
          margin-top: 18px;
          padding: 14px;
        }

        .compareGrid p {
          color: ${C.dark};
          font-size: 17px;
          font-weight: 700;
          line-height: 1.42;
        }

        .panelKicker,
        .miniLabel,
        .stepCount {
          color: ${C.gray};
        }

        .passageHeader {
          align-items: flex-start;
          display: flex;
          gap: 18px;
          justify-content: space-between;
          margin-top: 8px;
        }

        .passageHeader h2,
        .stepPanel h2 {
          color: ${C.dark};
          font-size: 22px;
          font-weight: 850;
          line-height: 1.18;
        }

        .passageHeader p {
          color: ${C.gray};
          font-size: 13px;
          font-style: italic;
          line-height: 1.4;
          margin-top: 4px;
        }

        .roundBadge {
          background: #e6f1fb;
          border: 1px solid #b5d4f4;
          border-radius: 8px;
          color: #173a5d;
          min-width: 150px;
          padding: 10px 12px;
        }

        .roundBadge strong,
        .roundBadge span {
          display: block;
        }

        .roundBadge strong {
          font-size: 12px;
          font-weight: 850;
        }

        .roundBadge span {
          color: ${C.gray};
          font-size: 11px;
          font-weight: 750;
          margin-top: 2px;
        }

        .passageText {
          color: #26231f;
          flex: 1;
          font-family: ${FONTS.passage};
          font-size: 20px;
          line-height: 1.78;
          margin-top: 22px;
          overflow-y: auto;
          padding-right: 8px;
          white-space: pre-wrap;
        }

        .passageText.selecting {
          background:
            linear-gradient(90deg, rgba(255,240,168,.22), transparent 34%),
            linear-gradient(180deg, rgba(230,241,251,.45), transparent 22%);
          border: 1px solid rgba(181,212,244,.8);
          border-radius: 8px;
          margin-top: 18px;
          padding: 16px 18px;
        }

        .passageWord {
          background: transparent;
          border: 1px solid transparent;
          border-radius: 5px;
          color: #26231f;
          cursor: pointer;
          display: inline;
          font-family: ${FONTS.passage};
          font-size: 20px;
          line-height: 1.65;
          padding: 1px 5px;
        }

        .selecting .passageWord {
          background: #ffe88a;
          border-color: #d99b20;
          box-shadow: 0 0 0 2px rgba(217,155,32,.12);
        }

        .selecting .passageWord:hover,
        .selecting .passageWord:focus-visible {
          background: #ffd967;
          outline: 3px solid rgba(46,117,182,.24);
          outline-offset: 1px;
        }

        .passageWord.selected {
          background: #2e6f73;
          border-color: #2e6f73;
          color: ${C.white};
        }

        .tapHint {
          align-items: center;
          background: #e6f1fb;
          border: 1px solid #b5d4f4;
          border-radius: 8px;
          color: #173a5d;
          display: flex;
          flex: 0 0 auto;
          font-size: 13px;
          font-weight: 800;
          gap: 8px;
          line-height: 1.35;
          margin-top: 12px;
          min-height: 42px;
          padding: 0 12px;
        }

        .stepPanel {
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow: hidden;
          padding: 20px;
        }

        .stepTop p {
          color: ${C.gray};
          font-size: 15px;
          font-weight: 650;
          line-height: 1.45;
          margin-top: 8px;
        }

        .gogiBox {
          align-items: flex-start;
          background: #eef6f0;
          border: 1px solid #c7dfd0;
          border-radius: 8px;
          display: flex;
          gap: 12px;
          padding: 13px;
        }

        .gogiMark {
          align-items: center;
          background: ${C.blue};
          border-radius: 50%;
          color: ${C.white};
          display: flex;
          flex: 0 0 36px;
          font-weight: 900;
          height: 36px;
          justify-content: center;
          width: 36px;
        }

        .gogiBox p {
          color: ${C.dark};
          font-size: 14px;
          font-weight: 700;
          line-height: 1.5;
        }

        .evidenceBox,
        .proofBox,
        .feelingSummary {
          background: #fffaf0;
          border: 1px solid #ead49a;
          border-radius: 8px;
          padding: 12px;
        }

        .evidenceList {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 9px;
          min-height: 44px;
        }

        .evidenceList button {
          background: #173a5d;
          border: 1px solid #173a5d;
          border-radius: 999px;
          color: ${C.white};
          cursor: pointer;
          font-family: ${FONTS.ui};
          font-size: 14px;
          font-weight: 850;
          min-height: 44px;
          padding: 0 15px;
        }

        .evidenceList span {
          color: #6d5a32;
          font-size: 14px;
          font-weight: 750;
        }

        .choiceStack {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .choiceRow,
        .moodChoices {
          display: grid;
          gap: 10px;
        }

        .choiceRow {
          grid-template-columns: 1fr 1fr;
          margin-top: 8px;
        }

        .moodChoices {
          grid-template-columns: 1fr 1fr;
        }

        .choiceRow button,
        .moodChoices button {
          background: ${C.white};
          border: 1.5px solid ${C.border};
          border-radius: 8px;
          color: ${C.dark};
          cursor: pointer;
          font-family: ${FONTS.ui};
          font-size: 15px;
          font-weight: 850;
          min-height: 54px;
          text-transform: capitalize;
        }

        .choiceRow button.selected,
        .moodChoices button.selected {
          background: #173a5d;
          border-color: #173a5d;
          color: ${C.white};
        }

        .feelingSummary {
          color: ${C.dark};
          font-size: 15px;
          font-weight: 750;
          line-height: 1.4;
        }

        .proofBox p {
          color: ${C.dark};
          font-size: 16px;
          font-weight: 750;
          line-height: 1.5;
          margin-top: 8px;
        }

        .feedback,
        .errorBox {
          border-radius: 8px;
          font-size: 13px;
          font-weight: 750;
          line-height: 1.45;
          padding: 10px 12px;
        }

        .feedback {
          background: ${C.amberLight};
          border: 1px solid ${C.amber};
          color: ${C.amber};
        }

        .errorBox {
          background: ${C.redLight};
          border: 1px solid ${C.red};
          color: ${C.red};
        }

        .continueButton {
          align-items: center;
          background: #173a5d;
          border: 1px solid #173a5d;
          border-radius: 8px;
          color: ${C.white};
          cursor: pointer;
          display: inline-flex;
          font-family: ${FONTS.ui};
          font-size: 15px;
          font-weight: 850;
          gap: 9px;
          justify-content: center;
          margin-top: auto;
          min-height: 50px;
          width: 100%;
        }

        .continueButton:disabled {
          cursor: not-allowed;
          opacity: .45;
        }

        .roundDots {
          display: flex;
          gap: 8px;
          justify-content: center;
        }

        .roundDots span {
          align-items: center;
          background: ${C.light};
          border-radius: 50%;
          color: ${C.gray};
          display: flex;
          font-size: 12px;
          font-weight: 850;
          height: 28px;
          justify-content: center;
          width: 28px;
        }

        .roundDots span.active {
          background: ${C.blueLight};
          color: #173a5d;
        }

        .roundDots span.done {
          background: ${C.greenLight};
          color: ${C.green};
        }
      `}</style>
    </main>
  );
}
