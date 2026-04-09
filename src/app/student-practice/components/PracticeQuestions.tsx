'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { practiceQuestions } from '../data/practiceData';

type Phase = 'intro' | 'practice' | 'results';

export default function PracticeQuestions() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const current = practiceQuestions[currentIndex];
  const isLast = currentIndex === practiceQuestions.length - 1;
  const totalQuestions = practiceQuestions.length;

  const handleConfirm = () => {
    if (selectedOption === null) return;
    setAnswers(prev => ({ ...prev, [current.id]: selectedOption }));
    setShowFeedback(true);
  };

  const handleNext = () => {
    setShowFeedback(false);
    setSelectedOption(null);
    if (!isLast) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setPhase('results');
    }
  };

  const calculateScore = () => {
    let correct = 0;
    practiceQuestions.forEach(q => {
      if (answers[q.id] === q.correctIndex) correct++;
    });
    return correct;
  };

  // ─── INTRO ───────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="bg-white/5 border border-violet-500/30 rounded-2xl p-8 backdrop-blur-sm text-center">
            <div className="text-5xl mb-4">✏️</div>
            <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">Step 3 · Practice</div>
            <h1 className="text-white text-2xl font-extrabold mb-3">Targeted Practice</h1>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Apply what you just learned. These 10 questions use new passages to test your ability to identify and analyze universal themes in literary texts.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: 'Questions', value: '10' },
                { label: 'Passages', value: '5' },
                { label: 'Est. Time', value: '~15 min' },
              ].map(item => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3">
                  <div className="text-white font-bold text-lg">{item.value}</div>
                  <div className="text-violet-400 text-xs mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-violet-900/30 border border-violet-500/20 rounded-xl p-4 mb-6 text-left">
              <p className="text-violet-300 text-xs font-semibold mb-2">💡 Tip: Use what you learned</p>
              <ul className="text-slate-300 text-xs space-y-1">
                <li>• Identify the topic first, then look for the author's message</li>
                <li>• Look for character change, conflict, and symbols</li>
                <li>• State themes as complete sentences, not single words</li>
              </ul>
            </div>
            <button
              onClick={() => setPhase('practice')}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl text-base transition-all duration-200"
            >
              Start Practice →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS ─────────────────────────────────────────────────────────────────
  if (phase === 'results') {
    const score = calculateScore();
    const pct = Math.round((score / totalQuestions) * 100);
    const passed = pct >= 80;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 px-4 py-12">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">{passed ? '🎯' : '📝'}</div>
            <h1 className="text-white text-3xl font-extrabold mb-2">Practice Complete!</h1>
            <p className="text-violet-300 text-sm">ELA.9.R.1.2 · Universal Themes</p>
          </div>

          <div className={`border rounded-2xl p-6 mb-6 text-center ${passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <div className={`text-5xl font-extrabold mb-1 ${passed ? 'text-emerald-400' : 'text-amber-400'}`}>{pct}%</div>
            <div className="text-white font-bold text-lg">{score} / {totalQuestions} Correct</div>
            <div className={`text-sm font-semibold mt-2 ${passed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {passed ? 'Strong Performance' : 'Keep Practicing'}
            </div>
          </div>

          <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 mb-6">
            <h2 className="text-white font-bold text-sm mb-2">What's Next?</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {passed
                ? "Great work! You're ready to move on to the reassessment to confirm your mastery of ELA.9.R.1.2." :"Good effort! Review the explanations for any questions you missed, then move on to the reassessment."}
            </p>
          </div>

          <button
            onClick={() => router.push('/student-reassess')}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl text-base transition-all duration-200"
          >
            Continue to Reassessment →
          </button>
        </div>
      </div>
    );
  }

  // ─── PRACTICE SCREEN ─────────────────────────────────────────────────────────
  const isCorrect = showFeedback && selectedOption === current.correctIndex;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-white/10 px-4 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-sm">Practice</span>
              <span className="text-violet-400 text-xs font-mono">ELA.9.R.1.2</span>
            </div>
            <span className="text-slate-400 text-xs">Q {currentIndex + 1} of {totalQuestions}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + (showFeedback ? 1 : 0)) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Passage */}
            <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
              <div className="mb-3">
                <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Passage</span>
                <h2 className="text-white font-bold text-base mt-1">{current.passageTitle}</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{current.passageText}</p>
            </div>

            {/* Question */}
            <div className="flex flex-col gap-4">
              <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">Q{currentIndex + 1}</span>
                  <span className="text-slate-500 text-xs">Multiple Choice</span>
                </div>
                <p className="text-white text-base font-medium leading-snug">{current.question}</p>
              </div>

              <div className="space-y-3">
                {current.options.map((option, idx) => {
                  let style = 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-violet-500/40 cursor-pointer';
                  if (showFeedback) {
                    if (idx === current.correctIndex) style = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 cursor-default';
                    else if (idx === selectedOption) style = 'bg-red-500/20 border-red-500/50 text-red-300 cursor-default';
                    else style = 'bg-white/5 border-white/10 text-slate-500 cursor-default opacity-60';
                  } else if (selectedOption === idx) {
                    style = 'bg-violet-600/30 border-violet-500 text-white cursor-pointer';
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => !showFeedback && setSelectedOption(idx)}
                      disabled={showFeedback}
                      className={`w-full text-left border rounded-xl px-4 py-3.5 text-sm transition-all duration-150 flex items-start gap-3 ${style}`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold mt-0.5 ${
                        showFeedback && idx === current.correctIndex ? 'border-emerald-400 text-emerald-400' :
                        showFeedback && idx === selectedOption ? 'border-red-400 text-red-400' :
                        selectedOption === idx ? 'border-violet-400 text-violet-400' : 'border-slate-600 text-slate-500'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="leading-snug">{option}</span>
                    </button>
                  );
                })}
              </div>

              {showFeedback && (
                <div className={`rounded-xl p-4 border text-sm ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <div className={`font-semibold mb-1 ${isCorrect ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">{current.explanation}</p>
                </div>
              )}

              <div>
                {!showFeedback ? (
                  <button
                    onClick={handleConfirm}
                    disabled={selectedOption === null}
                    className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all"
                  >
                    Confirm Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all"
                  >
                    {isLast ? 'View Results →' : 'Next Question →'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
