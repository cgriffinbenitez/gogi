'use client';

import { useParams, useRouter } from 'next/navigation';

const STANDARD_LABELS: Record<string, string> = {
  'ELA.9.R.1.1': 'Inferencing & Textual Evidence',
  'ELA.9.R.1.2': 'Universal Themes in Literary Texts',
  'ELA.9.R.2.1': 'Text Structure & Purpose',
};

export default function SimplifiedPage() {
  const router = useRouter();
  const params = useParams<{ standardId: string }>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-4">

        {/* Primary message */}
        <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center mx-auto mb-5">
            <span className="text-white text-xl font-extrabold leading-none select-none">G</span>
          </div>

          <h1 className="text-white text-xl font-extrabold mb-3 leading-tight">
            You gave this everything.
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            This skill takes time to click — that&apos;s not a failure, that&apos;s just where you
            are right now. Your teacher has been notified and has the exact data from your session to
            give you the right kind of help.
          </p>

          <p className="text-slate-400 text-sm leading-relaxed">
            Talk to your teacher directly — they know exactly what to work on with you next.
          </p>
        </div>

        {/* What your teacher can see */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">
            What your teacher can see
          </p>
          <ul className="space-y-2">
            {[
              'Which specific skill broke down',
              'Every response you gave during the session',
              'Which steps you passed and which ones you struggled with',
              'The exact feedback Gogi gave you',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-slate-300 text-sm">
                <span className="text-violet-400 mt-0.5 flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => router.push('/student-home')}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-lg hover:shadow-violet-500/30"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
