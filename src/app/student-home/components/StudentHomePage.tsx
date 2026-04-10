'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function StudentHomePage() {
  const router = useRouter();

  const loopSteps = [
    { step: 1, label: 'Diagnose', icon: '🔍', desc: 'Assess your current skill level', route: '/student-diagnostic', color: 'violet' },
    { step: 2, label: 'Teach', icon: '📚', desc: 'Guided lesson re-teaching the skill', route: '/student-teach', color: 'blue' },
    { step: 3, label: 'Practice', icon: '✏️', desc: 'Targeted practice questions', route: '/student-practice', color: 'amber' },
    { step: 4, label: 'Reassess', icon: '🎯', desc: 'Confirm mastery to move on', route: '/student-reassess', color: 'emerald' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-extrabold text-white tracking-tight">GOGI</span>
          <span className="text-violet-400 text-sm font-medium hidden sm:block">AI-Powered Literacy Platform</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-violet-600/40 border border-violet-500/40 flex items-center justify-center text-sm">🎓</div>
          <span className="text-white font-semibold text-sm">Student</span>
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-10">
        {/* Welcome */}
        <div className="text-center mb-10 w-full max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Welcome to GOGI 👋</h2>
          <p className="text-violet-300 text-sm sm:text-base max-w-md mx-auto">
            Your Diagnostic Assessment
          </p>
        </div>

        {/* Primary CTA */}
        <div className="w-full max-w-xl mb-10">
          <div className="bg-white/5 border border-violet-500/30 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0 text-2xl">🔍</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Step 1 · Diagnostic</span>
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full">Start Here</span>
                </div>
                <h3 className="text-white text-xl font-bold leading-snug">ELA Reading Diagnostic</h3>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-5">
              This assessment will help GOGI understand your current reading skills so we can build a personalized learning plan just for you.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Texts', value: '5' },
                { label: 'Questions', value: '15' },
                { label: 'Est. Time', value: '40-45 min' },
              ]?.map(item => (
                <div key={item?.label} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-white font-bold text-lg">{item?.value}</div>
                  <div className="text-violet-400 text-xs mt-0.5">{item?.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router?.push('/student-diagnostic')}
              className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold py-4 rounded-xl text-base transition-all duration-200 shadow-lg hover:shadow-violet-500/30 flex items-center justify-center gap-2"
            >
              <span>Begin Diagnostic</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Learning Loop Overview */}
        <div className="w-full max-w-xl">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest text-center mb-4">Your Learning Loop</p>
          <div className="grid grid-cols-4 gap-2">
            {loopSteps?.map((s, idx) => (
              <div key={s?.step} className="relative flex flex-col items-center">
                {idx < loopSteps?.length - 1 && (
                  <div className="absolute top-5 left-[calc(50%+20px)] w-[calc(100%-8px)] h-px bg-white/10 z-0" />
                )}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg z-10 mb-2 ${
                  s?.step === 1 ? 'bg-violet-600/40 border border-violet-500/40' : 'bg-white/5 border border-white/10'
                }`}>
                  {s?.icon}
                </div>
                <div className="text-center">
                  <div className={`text-xs font-bold ${s?.step === 1 ? 'text-violet-400' : 'text-slate-500'}`}>{s?.label}</div>
                  <div className="text-slate-600 text-xs mt-0.5 hidden sm:block leading-tight">{s?.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs mt-8 text-center max-w-sm">
          Score 80% or above on the diagnostic to achieve mastery. If not, you'll be guided through Teach → Practice → Reassess.
        </p>
      </main>
    </div>
  );
}
