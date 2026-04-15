'use client';

import React from 'react';
import LoginForm from './LoginForm';

export type UserRole = 'student' | 'teacher' | 'admin';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d0f12] px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold text-white tracking-tight mb-3">GOGI</h1>
        <p className="text-[#94A3B8] text-lg font-medium">AI-Powered Literacy &amp; Thinking Platform</p>
      </div>

      <div className="w-full max-w-md bg-white/[0.06] border border-white/[0.08] rounded-2xl p-8">
        <LoginForm />
      </div>
    </div>
  );
}
