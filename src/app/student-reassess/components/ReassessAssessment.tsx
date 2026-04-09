'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reassessQuestions } from '../data/reassessData';

type Phase = 'intro' | 'assessment' | 'results';

export default function ReassessAssessment() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const current = reassessQuestions[currentIndex];
  const isLast = currentIndex === reassessQuestions.length - 1;
  const totalQuestions = reassessQuestions.length;

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
    reassessQuestions.forEach(q => {
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
            <div className="text-5xl mb-4">🎯</div>
            <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">Step 4 · Reassessment</div>
            <h1 className="text-white text-2xl font-extrabold mb-3">Mastery Check</h1>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              This is your final check. Answer 10 questions on new passages to confirm your mastery of ELA.9.R.1.2. Score 80% or above to achieve mastery and move on.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: 'Questions', value: '10' },
                { label: 'Mastery', value: '80%' },
                { label: 'Est. Time', value: '~15 min' },
              ].map(item => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3">
                  <div className="text-white font-bold text-lg">{item.value}</div>
                  <div className="text-violet-400 text-xs mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4 mb-6 text-left">
              <p className="text-emerald-400 text-xs font-semibold mb-1">✓ You've completed the lesson and practice</p>
              <p className="text-slate-300 text-xs">Apply everything you've learned. Read each passage carefully and identify the universal theme and how it develops.</p>
            </div>
            <button
              onClick={() => setPhase('assessment')}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl text-base transition-all duration-200"
            >
              Begin Reassessment →
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
    const mastered = pct >= 80;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 px-4 py-12">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{mastered ? '🏆' : '📚'}</div>
            <h1 className="text-white text-3xl font-extrabold mb-2">
              {mastered ? 'Mastery Achieved!' : 'Not Yet — Keep Going'}
            </h1>
            <p className="text-violet-300 text-sm">ELA.9.R.1.2 · Universal Themes in Literary Texts</p>
          </div>

          {/* Score */}
          <div className={`border rounded-2xl p-8 mb-6 text-center ${mastered ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <div className={`text-6xl font-extrabold mb-2 ${mastered ? 'text-emerald-400' : 'text-amber-400'}`}>{pct}%</div>
            <div className="text-white font-bold text-xl mb-1">{score} / {totalQuestions} Correct</div>
            <div className={`text-sm font-semibold ${mastered ? 'text-emerald-400' : 'text-amber-400'}`}>
              {mastered ? '✓ Mastery Threshold Met (80%)' : `${80 - pct}% below mastery threshold`}
            </div>
          </div>

          {mastered ? (
            <>
              {/* Mastery Badge */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-xl">🎖️</div>
                  <div>
                    <div className="text-emerald-400 font-bold text-sm">Skill Mastered</div>
                    <div className="text-slate-300 text-xs font-mono">ELA.9.R.1.2</div>
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  You've demonstrated mastery of analyzing universal themes and their development throughout literary texts. Your teacher has been notified of your progress.
                </p>
              </div>

              <button
                onClick={() => router.push('/student-home')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl text-base transition-all duration-200 shadow-lg hover:shadow-emerald-500/30"
              >
                Return to Home →
              </button>
            </>
          ) : (
            <>
              {/* Not mastered — loop back */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6">
                <h2 className="text-amber-400 font-bold text-sm mb-2">Almost there!</h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  You haven't quite reached the 80% mastery threshold yet. Review the lesson again and try the reassessment once more. You've got this.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push('/student-teach')}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl text-base transition-all duration-200"
                >
                  Review Lesson Again →
                </button>
                <button
                  onClick={() => {
                    setPhase('intro');
                    setCurrentIndex(0);
                    setAnswers({});
                    setSelectedOption(null);
                    setShowFeedback(false);
                  }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold py-3.5 rounded-xl text-sm transition-all"
                >
                  Retry Reassessment
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── ASSESSMENT SCREEN ───────────────────────────────────────────────────────
  const isCorrect = showFeedback && selectedOption === current.correctIndex;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-white/10 px-4 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-sm">Reassessment</span>
              <span className="text-violet-400 text-xs font-mono">ELA.9.R.1.2</span>
              <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">Mastery Check</span>
            </div>
            <span className="text-slate-400 text-xs">Q {currentIndex + 1} of {totalQuestions}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
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
                  <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">Q{currentIndex + 1}</span>
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
                <div className={`rounded-xl p-4 border text-sm ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                  <div className="font-semibold">
                    {isCorrect ? '✓ Correct!' : '✗ Incorrect — the correct answer was ' + String.fromCharCode(65 + current.correctIndex)}
                  </div>
                </div>
              )}

              <div>
                {!showFeedback ? (
                  <button
                    onClick={handleConfirm}
                    disabled={selectedOption === null}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all"
                  >
                    Confirm Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all"
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
