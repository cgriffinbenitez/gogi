'use client';

import { useRouter } from 'next/navigation';

export default function SimplifiedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-6">🔧</div>
          <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">
            Additional Support
          </div>
          <h1 className="text-white text-2xl font-extrabold mb-4 leading-tight">
            Simplified Intervention
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-3">
            Coming soon. Your teacher will be notified that you need additional support on this
            standard.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            This is not a dead end — it is a signal. Your teacher now has the exact data needed to
            give you the right kind of help.
          </p>
          <button
            onClick={() => router.push('/student-home')}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-lg hover:shadow-violet-500/30"
          >
            Return to Home →
          </button>
        </div>
      </div>
    </div>
  );
}
