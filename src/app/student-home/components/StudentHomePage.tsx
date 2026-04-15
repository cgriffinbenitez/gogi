'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const loopSteps = [
  { step: 1, label: 'Diagnose', desc: 'Assess your current skill level' },
  { step: 2, label: 'Teach', desc: 'Guided lesson re-teaching the skill' },
  { step: 3, label: 'Practice', desc: 'Targeted practice questions' },
  { step: 4, label: 'Reassess', desc: 'Confirm mastery to move on' },
];

export default function StudentHomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0d0f12] flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
        <span className="text-xl font-extrabold text-white tracking-tight">GOGI</span>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
            <span className="text-[#94A3B8] text-xs font-bold">S</span>
          </div>
          <span className="text-white font-semibold text-sm">Student</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-10">
        {/* Welcome */}
        <div className="text-center mb-10 w-full max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Welcome to GOGI</h2>
          <p className="text-[#94A3B8] text-sm sm:text-base max-w-md mx-auto">
            Your personalized ELA literacy program
          </p>
        </div>

        {/* Primary CTA */}
        <div className="w-full max-w-xl mb-10">
          <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#1D9E75]/20 border border-[#1D9E75]/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[#1D9E75] font-bold text-lg">1</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#1D9E75] uppercase tracking-widest">Step 1 · Diagnostic</span>
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full">Start Here</span>
                </div>
                <h3 className="text-white text-xl font-bold leading-snug">ELA Reading Diagnostic</h3>
              </div>
            </div>

            <p className="text-[#94A3B8] text-sm leading-relaxed mb-5">
              This assessment will help GOGI understand your current reading skills so we can build a personalized learning plan just for you.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Texts', value: '5' },
                { label: 'Questions', value: '15' },
                { label: 'Est. Time', value: '40-45 min' },
              ].map(item => (
                <div key={item.label} className="bg-white/[0.06] rounded-xl p-3 text-center">
                  <div className="text-white font-bold text-lg">{item.value}</div>
                  <div className="text-[#94A3B8] text-xs mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push('/student-diagnostic')}
              className="btn-primary w-full py-4 text-base"
            >
              Begin Diagnostic
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Learning Loop Overview */}
        <div className="w-full max-w-xl">
          <p className="text-[#4B5563] text-xs font-semibold uppercase tracking-widest text-center mb-4">Your Learning Loop</p>
          <div className="grid grid-cols-4 gap-2">
            {loopSteps.map((s, idx) => (
              <div key={s.step} className="relative flex flex-col items-center">
                {idx < loopSteps.length - 1 && (
                  <div className="absolute top-5 left-[calc(50%+20px)] w-[calc(100%-8px)] h-px bg-white/[0.08] z-0" />
                )}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 mb-2 text-sm font-bold ${
                  s.step === 1
                    ? 'bg-[#1D9E75]/20 border border-[#1D9E75]/40 text-[#1D9E75]'
                    : 'bg-white/[0.06] border border-white/[0.08] text-[#4B5563]'
                }`}>
                  {s.step}
                </div>
                <div className="text-center">
                  <div className={`text-xs font-bold ${s.step === 1 ? 'text-[#1D9E75]' : 'text-[#4B5563]'}`}>{s.label}</div>
                  <div className="text-[#4B5563] text-xs mt-0.5 hidden sm:block leading-tight">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[#4B5563] text-xs mt-8 text-center max-w-sm">
          Score 80% or above on the diagnostic to achieve mastery. If not, you&apos;ll be guided through Teach → Practice → Reassess.
        </p>
      </main>
    </div>
  );
}
