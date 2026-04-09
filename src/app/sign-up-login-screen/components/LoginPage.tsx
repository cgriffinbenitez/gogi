'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 px-6">
      {/* Logo / Branding */}
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold text-white tracking-tight mb-3">GOGI</h1>
        <p className="text-violet-300 text-lg font-medium">AI-Powered Literacy & Thinking Platform</p>
      </div>
      {/* Role Selection */}
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
        {/* Student Button */}
        <button
          onClick={() => router?.push('/student-home')}
          className="flex-1 flex flex-col items-center justify-center gap-3 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white rounded-2xl py-10 px-6 shadow-lg hover:shadow-violet-500/30 transition-all duration-200 group"
        >
          <span className="text-4xl">🎓</span>
          <span className="text-xl font-bold tracking-wide">Student</span>
        </button>

        {/* Teacher Button */}
        <button
          onClick={() => router?.push('/teacher-dashboard')}
          className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white rounded-2xl py-10 px-6 shadow-lg hover:shadow-slate-500/20 transition-all duration-200 group"
        >
          <span className="text-4xl">📋</span>
          <span className="text-xl font-bold tracking-wide">Teacher</span>
        </button>
      </div>
    </div>
  );
}
const UserRole: React.FC = () => {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn('Placeholder: UserRole is not implemented yet.');
  }, []);
  return (
    <div>
      {/* UserRole placeholder */}
    </div>
  );
};

export { UserRole };