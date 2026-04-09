'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Home, Clock, ChevronLeft, Zap } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import type { TaskStep } from './StudentTaskPage';

interface StudentTopBarProps {
  currentStep: TaskStep;
  totalSteps: number;
  onAiTutorOpen: () => void;
  passageTitle: string;
}

export default function StudentTopBar({
  currentStep,
  totalSteps,
  onAiTutorOpen,
  passageTitle,
}: StudentTopBarProps) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(0);
  const [effortScore, setEffortScore] = useState(72);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
      // Simulated effort score drift
      if (seconds % 30 === 0) {
        setEffortScore((e) => Math.min(99, e + Math.floor(Math.random() * 3)));
      }
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeDisplay = `${mins}:${secs.toString().padStart(2, '0')}`;

  const stepLabels = ['Theme ID', 'Evidence', 'Reasoning'];

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <AppLogo size={32} />
          <span className="font-bold text-violet-700 text-lg hidden sm:block">GOGI</span>
        </div>
        <div className="w-px h-6 bg-slate-200 hidden sm:block" />
        <button
          onClick={() => router.push('/sign-up-login-screen')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors"
        >
          <ChevronLeft size={16} />
          <span className="hidden md:block">My Assignments</span>
        </button>
        <div className="hidden lg:flex items-center gap-1.5 text-slate-700">
          <span className="text-sm font-semibold truncate max-w-[200px]">{passageTitle}</span>
        </div>
      </div>

      {/* Center — step progress */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-2xl px-3 py-2">
        {stepLabels.map((label, i) => {
          const step = (i + 1) as TaskStep;
          const isDone = step < currentStep;
          const isActive = step === currentStep;
          return (
            <React.Fragment key={`step-${step}`}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-violet-600 text-white shadow-sm'
                  : isDone
                  ? 'bg-emerald-100 text-emerald-700' :'text-slate-400'
              }`}>
                {isDone ? (
                  <span>✓</span>
                ) : (
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                    isActive ? 'bg-white/20' : 'bg-slate-200'
                  }`}>
                    {step}
                  </span>
                )}
                <span className="hidden sm:block">{label}</span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`w-6 h-px ${isDone ? 'bg-emerald-300' : 'bg-slate-300'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Effort score */}
        <div className="hidden md:flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
          <Zap size={14} className="text-amber-500" />
          <span className="text-xs font-semibold text-amber-700">Effort</span>
          <span className="text-xs font-bold text-amber-800 font-mono tabular-nums">{effortScore}%</span>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5">
          <Clock size={14} className="text-slate-500" />
          <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">{timeDisplay}</span>
        </div>

        {/* AI Tutor button */}
        <button
          onClick={onAiTutorOpen}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-150 shadow-sm"
        >
          <Bot size={16} />
          <span className="hidden sm:block">AI Tutor</span>
        </button>

        {/* Home */}
        <button
          onClick={() => router.push('/sign-up-login-screen')}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          title="Go to home"
        >
          <Home size={18} />
        </button>
      </div>
    </header>
  );
}