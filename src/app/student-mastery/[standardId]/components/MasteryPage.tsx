'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ─── Standard-specific mastery content ────────────────────────────────────────

const MASTERY_CONTENT: Record<
  string,
  { skillName: string; what: string; life: string; icon: string }
> = {
  'ELA.9.R.1.1': {
    skillName: 'Inferencing & Textual Evidence',
    icon: '🔍',
    what: 'You can now read between the lines. You take what is written on the page and use it to figure out what the author is not saying directly — and that is a different kind of intelligence. You proved today that you can hold evidence in your mind, connect it to context, and arrive at a conclusion the text implies but does not state.',
    life: 'This is power in the real world. When you are reading a contract and need to understand what the fine print actually implies — that is inference. When someone tells you something and you need to figure out what they left out — that is inference. In every negotiation, every job interview, every relationship where you need to read what is actually happening: this is the skill that gets you there.',
  },
  'ELA.9.R.1.2': {
    skillName: 'Universal Themes in Literary Texts',
    icon: '🌍',
    what: 'You can now identify the universal patterns in human experience that authors encode in stories — the ideas about life that repeat across cultures, time periods, and circumstances because they are true. You proved today that you can move from what happens in a story to what it means about being human.',
    life: 'This is pattern recognition for human behavior. When you can identify theme, you can see what a situation is really about beneath the surface — what is actually driving the people around you, what dynamic is actually playing out, whether history is repeating itself in a new form. That is not a school skill. That is how you see the world clearly.',
  },
  'ELA.9.R.2.1': {
    skillName: 'Text Structure & Purpose',
    icon: '🏗️',
    what: 'You can now see the skeleton of an argument — how a writer builds their case, what they put first and why, how structure shapes meaning. You proved today that you can look past the words at the architecture underneath: why this piece is ordered the way it is, and what that order is doing to the reader.',
    life: 'You will use this every time you write a message that needs to persuade someone. Every time you read a news article and need to figure out what angle the writer is pushing. Every time you are in a meeting and need to follow the logic of what is being argued, or spot where the logic breaks down. This is how you stop being talked at and start seeing how arguments are constructed — and how to build your own.',
  },
};

const DEFAULT_CONTENT = {
  skillName: 'Literary Analysis',
  icon: '📚',
  what: 'You demonstrated genuine mastery of this reading skill today. You proved that you can apply close reading and analytical thinking to real literary texts — not just recognize the skill, but execute it.',
  life: 'Every standard in this class is a real cognitive tool. The fact that you can use it now means you carry it with you — into every text, every conversation, every situation where clear thinking matters.',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MasteryPage() {
  const router = useRouter();
  const params = useParams<{ standardId: string }>();
  const standardId = params.standardId;

  const [loading, setLoading] = useState(true);
  const [standardCode, setStandardCode] = useState('');
  const [standardTitle, setStandardTitle] = useState('');

  useEffect(() => {
    if (!standardId) return;

    async function loadStandard() {
      const { data: standard } = await supabase
        .from('standards')
        .select('code, title')
        .eq('id', standardId)
        .single();

      if (standard) {
        setStandardCode(standard.code);
        setStandardTitle(standard.title);
      }
      setLoading(false);
    }

    loadStandard();
  }, [standardId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const content = MASTERY_CONTENT[standardCode] || DEFAULT_CONTENT;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-white tracking-tight">GOGI</span>
          <span className="text-emerald-400 text-xs font-medium hidden sm:block">
            AI-Powered Literacy Platform
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-emerald-400 font-mono">{standardCode}</span>
          <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30">
            Mastery
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-10">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="text-7xl mb-5">🏆</div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">
              Standard Mastered
            </div>
            <h1 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight mb-3">
              You did it.
            </h1>
            <p className="text-emerald-300 font-mono text-sm">
              {standardCode} — {standardTitle || content.skillName}
            </p>
          </div>

          {/* Mastery Badge */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 mb-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl flex-shrink-0">
              {content.icon}
            </div>
            <div>
              <div className="text-emerald-400 font-bold text-sm mb-1">{content.skillName}</div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  ✓ Mastery Achieved
                </span>
                <span className="text-slate-400 text-xs font-mono">{standardCode}</span>
              </div>
            </div>
          </div>

          {/* What You Proved */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5">
            <div className="text-xs font-bold text-white uppercase tracking-widest mb-3">
              What your brain just did
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{content.what}</p>
          </div>

          {/* Real Life Power */}
          <div className="bg-violet-900/20 border border-violet-500/20 rounded-2xl p-6 mb-8">
            <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">
              What this means for your life
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{content.life}</p>
          </div>

          {/* Continue Button */}
          <button
            onClick={() => router.push('/student-diagnostic')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl text-base transition-all duration-200 shadow-lg hover:shadow-emerald-500/30 flex items-center justify-center gap-2"
          >
            <span>Continue</span>
            <span>→</span>
          </button>

          <p className="text-slate-600 text-xs text-center mt-4">
            Returns to your diagnostic results — see what&apos;s next.
          </p>
        </div>
      </div>
    </div>
  );
}
