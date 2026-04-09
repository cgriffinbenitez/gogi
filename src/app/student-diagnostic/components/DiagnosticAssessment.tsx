'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { diagnosticPassages, Passage } from '../data/diagnosticData';

type Answers = Record<number, number>;

type Phase = 'intro' | 'assessment' | 'results';

export default function DiagnosticAssessment() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentPassageIndex, setCurrentPassageIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const totalPassages = diagnosticPassages.length;
  const currentPassage: Passage = diagnosticPassages[currentPassageIndex];
  const currentQuestion = currentPassage?.questions[currentQuestionIndex];
  const totalQuestions = diagnosticPassages.reduce((sum, p) => sum + p.questions.length, 0);
  const answeredCount = Object.keys(answers).length;

  // Calculate global question number for progress
  const globalQuestionNumber = diagnosticPassages
    .slice(0, currentPassageIndex)
    .reduce((sum, p) => sum + p.questions.length, 0) + currentQuestionIndex + 1;

  const handleSelectOption = (index: number) => {
    if (showFeedback) return;
    setSelectedOption(index);
  };

  const handleConfirmAnswer = () => {
    if (selectedOption === null) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: selectedOption }));
    setShowFeedback(true);
  };

  const handleNext = () => {
    setShowFeedback(false);
    setSelectedOption(null);

    const isLastQuestion = currentQuestionIndex === currentPassage.questions.length - 1;
    const isLastPassage = currentPassageIndex === totalPassages - 1;

    if (!isLastQuestion) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (!isLastPassage) {
      setCurrentPassageIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
    } else {
      setPhase('results');
    }
  };

  const calculateScore = useCallback(() => {
    let correct = 0;
    diagnosticPassages.forEach(passage => {
      passage.questions.forEach(q => {
        if (answers[q.id] === q.correctIndex) correct++;
      });
    });
    return correct;
  }, [answers]);

  const getPassageScore = (passage: Passage) => {
    let correct = 0;
    passage.questions.forEach(q => {
      if (answers[q.id] === q.correctIndex) correct++;
    });
    return correct;
  };

  const getScoreLevel = (score: number, total: number) => {
    const pct = (score / total) * 100;
    if (pct >= 80) return { label: 'Approaching Mastery', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' };
    if (pct >= 60) return { label: 'Developing', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' };
    return { label: 'Beginning', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' };
  };

  // ─── INTRO SCREEN ───────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Back */}
          <button
            onClick={() => router.push('/student-home')}
            className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm mb-8 transition-colors"
          >
            ← Back to Home
          </button>

          <div className="bg-white/5 border border-violet-500/30 rounded-2xl p-8 backdrop-blur-sm">
            <div className="mb-6">
              <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Diagnostic Assessment</span>
              <h1 className="text-white text-2xl sm:text-3xl font-extrabold mt-2 leading-tight">
                ELA Reading Diagnostic
              </h1>
              <p className="text-violet-300 font-mono text-sm mt-1">ELA.9.R.1.2</p>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              <span className="font-semibold text-white">Standard:</span> Analyze universal themes and their development throughout literary texts.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: 'Passages', value: '3' },
                { label: 'Questions', value: '15' },
                { label: 'Format', value: 'Multiple Choice' },
                { label: 'Est. Time', value: '~20 min' },
              ].map(item => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-white font-bold text-base">{item.value}</div>
                  <div className="text-violet-400 text-xs mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-violet-900/30 border border-violet-500/20 rounded-xl p-4 mb-8">
              <h3 className="text-white font-semibold text-sm mb-2">Before you begin:</h3>
              <ul className="text-slate-300 text-sm space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> Read each passage carefully before answering questions</li>
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> Each question has one best answer</li>
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> You cannot go back to previous questions</li>
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> Your results will help personalize your learning path</li>
              </ul>
            </div>

            <button
              onClick={() => setPhase('assessment')}
              className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold py-4 rounded-xl text-base transition-all duration-200 shadow-lg hover:shadow-violet-500/30"
            >
              Start Diagnostic →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ─────────────────────────────────────────────────────────
  if (phase === 'results') {
    const score = calculateScore();
    const level = getScoreLevel(score, totalQuestions);
    const pct = Math.round((score / totalQuestions) * 100);
    const mastered = pct >= 80;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">{mastered ? '🏆' : '📊'}</div>
            <h1 className="text-white text-3xl font-extrabold mb-2">Diagnostic Complete!</h1>
            <p className="text-violet-300 text-sm">ELA.9.R.1.2 · Universal Themes in Literary Texts</p>
          </div>

          {/* Overall Score */}
          <div className={`border rounded-2xl p-6 mb-6 text-center ${level.bg}`}>
            <div className={`text-5xl font-extrabold mb-1 ${level.color}`}>{pct}%</div>
            <div className="text-white font-bold text-lg">{score} / {totalQuestions} Correct</div>
            <div className={`text-sm font-semibold mt-2 ${level.color}`}>{level.label}</div>
          </div>

          {/* Per-Passage Breakdown */}
          <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-6 mb-6">
            <h2 className="text-white font-bold text-base mb-4">Passage Breakdown</h2>
            <div className="space-y-3">
              {diagnosticPassages.map((passage, idx) => {
                const pScore = getPassageScore(passage);
                const pPct = Math.round((pScore / passage.questions.length) * 100);
                const pLevel = getScoreLevel(pScore, passage.questions.length);
                return (
                  <div key={passage.id} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-600/40 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-300 text-xs truncate pr-2">{passage.title}</span>
                        <span className={`text-xs font-bold flex-shrink-0 ${pLevel.color}`}>{pScore}/{passage.questions.length}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pPct >= 80 ? 'bg-emerald-500' : pPct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What's Next */}
          <div className={`border rounded-2xl p-5 mb-6 ${mastered ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <h2 className="text-white font-bold text-sm mb-2">
              {mastered ? '🎉 Mastery Achieved!' : '📚 Next Step: Guided Lesson'}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {mastered
                ? `You scored ${pct}% — above the 80% mastery threshold. You've demonstrated strong understanding of ELA.9.R.1.2. Great work!`
                : `You scored ${pct}% — below the 80% mastery threshold. No worries! You'll now go through a guided lesson, targeted practice, and a reassessment to build your skills.`}
            </p>
          </div>

          <button
            onClick={() => mastered ? router.push('/student-home') : router.push('/student-teach')}
            className={`w-full font-bold py-4 rounded-xl text-base transition-all duration-200 shadow-lg ${
              mastered
                ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/30 text-white'
                : 'bg-violet-600 hover:bg-violet-500 hover:shadow-violet-500/30 text-white'
            }`}
          >
            {mastered ? 'Return to Home →' : 'Start Guided Lesson →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── ASSESSMENT SCREEN ──────────────────────────────────────────────────────
  const isAnswered = selectedOption !== null;
  const isCorrect = showFeedback && selectedOption === currentQuestion.correctIndex;
  const isLastQuestion = currentPassageIndex === totalPassages - 1 && currentQuestionIndex === currentPassage.questions.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
      {/* Top Progress Bar */}
      <div className="bg-slate-900/80 border-b border-white/10 px-4 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-sm">ELA Diagnostic</span>
              <span className="text-violet-400 text-xs font-mono">ELA.9.R.1.2</span>
            </div>
            <span className="text-slate-400 text-xs">
              Q {globalQuestionNumber} of {totalQuestions}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>
          {/* Passage indicators */}
          <div className="flex items-center gap-1.5 mt-2">
            {diagnosticPassages.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-1">
                <div className={`h-1 rounded-full transition-all duration-300 ${
                  idx < currentPassageIndex ? 'bg-violet-500 w-8' :
                  idx === currentPassageIndex ? 'bg-violet-400 w-8': 'bg-white/10 w-8'
                }`} />
              </div>
            ))}
            <span className="text-slate-500 text-xs ml-1">Passage {currentPassageIndex + 1}/{totalPassages}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Passage Panel */}
            <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto scrollbar-thin">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Passage {currentPassageIndex + 1}</span>
                  <span className="text-xs text-slate-500">· {currentPassage.genre}</span>
                </div>
                <h2 className="text-white font-bold text-lg leading-snug">{currentPassage.title}</h2>
                <p className="text-slate-500 text-xs mt-0.5">{currentPassage.author}</p>
              </div>
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {currentPassage.text}
              </div>
            </div>

            {/* Question Panel */}
            <div className="flex flex-col gap-4">
              {/* Question */}
              <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    Q{currentQuestionIndex + 1} of {currentPassage.questions.length}
                  </span>
                  <span className="text-slate-500 text-xs">Multiple Choice</span>
                </div>
                <p className="text-white text-base font-medium leading-snug">
                  {currentQuestion.text}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  let optionStyle = 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-violet-500/40 cursor-pointer';

                  if (showFeedback) {
                    if (idx === currentQuestion.correctIndex) {
                      optionStyle = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 cursor-default';
                    } else if (idx === selectedOption && selectedOption !== currentQuestion.correctIndex) {
                      optionStyle = 'bg-red-500/20 border-red-500/50 text-red-300 cursor-default';
                    } else {
                      optionStyle = 'bg-white/5 border-white/10 text-slate-500 cursor-default opacity-60';
                    }
                  } else if (selectedOption === idx) {
                    optionStyle = 'bg-violet-600/30 border-violet-500 text-white cursor-pointer';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={showFeedback}
                      className={`w-full text-left border rounded-xl px-4 py-3.5 text-sm transition-all duration-150 flex items-start gap-3 ${optionStyle}`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold mt-0.5 ${
                        showFeedback && idx === currentQuestion.correctIndex ? 'border-emerald-400 text-emerald-400' :
                        showFeedback && idx === selectedOption ? 'border-red-400 text-red-400' :
                        selectedOption === idx ? 'border-violet-400 text-violet-400': 'border-slate-600 text-slate-500'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="leading-snug">{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback */}
              {showFeedback && (
                <div className={`rounded-xl p-4 border text-sm ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                  <div className="font-semibold mb-1">
                    {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                  </div>
                  {!isCorrect && (
                    <div className="text-slate-300 text-xs">
                      The correct answer was: <span className="font-semibold text-emerald-400">{String.fromCharCode(65 + currentQuestion.correctIndex)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!showFeedback ? (
                  <button
                    onClick={handleConfirmAnswer}
                    disabled={selectedOption === null}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200"
                  >
                    Confirm Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200"
                  >
                    {isLastQuestion ? 'View Results →' : 'Next Question →'}
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
