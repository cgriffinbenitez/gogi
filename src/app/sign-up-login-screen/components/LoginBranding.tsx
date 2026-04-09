import React from 'react';
import AppLogo from '@/components/ui/AppLogo';

export default function LoginBranding() {
  return (
    <div className="hidden lg:flex lg:w-[520px] xl:w-[580px] flex-col justify-between bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-700 px-12 py-12 relative overflow-hidden flex-shrink-0">
      {/* Background decorative circles */}
      <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full bg-white/5" />
      <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full bg-amber-400/15" />
      <div className="absolute top-1/2 right-[-40px] w-48 h-48 rounded-full bg-indigo-400/20" />
      {/* Logo */}
      <div className="relative z-10 flex items-center gap-3">
        <AppLogo size={44} />
        <span className="text-white text-2xl font-bold tracking-tight">GOGI</span>
      </div>
      {/* Center content */}
      <div className="relative z-10 flex flex-col gap-8">
        {/* Decorative book icon area */}
        <div className="w-24 h-24 rounded-3xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="8" width="16" height="32" rx="3" fill="white" fillOpacity="0.9" />
            <rect x="26" y="8" width="16" height="32" rx="3" fill="#FCD34D" />
            <rect x="20" y="6" width="8" height="36" rx="2" fill="#F59E0B" />
            <circle cx="14" cy="20" r="2" fill="white" fillOpacity="0.4" />
            <circle cx="14" cy="26" r="2" fill="white" fillOpacity="0.4" />
            <circle cx="34" cy="20" r="2" fill="white" fillOpacity="0.4" />
            <circle cx="34" cy="26" r="2" fill="white" fillOpacity="0.4" />
          </svg>
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Read. Think.<br />
            <span className="text-amber-300">Understand.</span>
          </h1>
          <p className="text-violet-200 text-lg leading-relaxed">
            AI-powered literacy that forces deeper thinking — not shortcuts. Built for real classrooms.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-col gap-3">
          {[
            { icon: '🧠', text: 'Structured cognitive tasks' },
            { icon: '📊', text: 'Florida B.E.S.T. aligned' },
            { icon: '🤖', text: 'AI tutor that guides, never replaces' },
            { icon: '📈', text: 'Real-time growth tracking' },
          ]?.map((item) => (
            <div
              key={`feature-${item?.text}`}
              className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/15"
            >
              <span className="text-xl">{item?.icon}</span>
              <span className="text-white text-sm font-medium">{item?.text}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Footer */}
      <div className="relative z-10 flex items-center gap-2">
        <span className="text-violet-300 text-xs">Aligned to</span>
        <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
          Florida B.E.S.T. Standards
        </span>
      </div>
    </div>
  );
}