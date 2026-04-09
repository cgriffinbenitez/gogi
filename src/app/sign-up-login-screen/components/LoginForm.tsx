'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Copy, Check } from 'lucide-react';
import type { UserRole } from './LoginPage';

interface LoginFormData {
  email: string;
  password: string;
  remember: boolean;
}

const DEMO_CREDENTIALS: { role: UserRole; label: string; email: string; password: string; destination: string }[] = [
  {
    role: 'student',
    label: 'Student',
    email: 'marcus.johnson@gogi.edu',
    password: 'Student#2026',
    destination: '/student-reading-task-screen',
  },
  {
    role: 'teacher',
    label: 'Teacher',
    email: 'mrs.reyes@gogi.edu',
    password: 'Teacher#2026',
    destination: '/teacher-dashboard',
  },
  {
    role: 'admin',
    label: 'Admin',
    email: 'principal.wade@gogi.edu',
    password: 'Admin#2026',
    destination: '/teacher-dashboard',
  },
];

const ROLE_TABS: { id: UserRole; label: string; emoji: string; welcome: string; sub: string }[] = [
  {
    id: 'student',
    label: 'Student',
    emoji: '🎒',
    welcome: 'Welcome back!',
    sub: 'Sign in to continue your reading tasks and see how your thinking has grown.',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    emoji: '👩‍🏫',
    welcome: 'Good to see you.',
    sub: "Check in on your class — see who's struggling and what standards need attention.",
  },
  {
    id: 'admin',
    label: 'Admin',
    emoji: '🏫',
    welcome: 'District Overview',
    sub: 'Review school-wide literacy performance and B.E.S.T. standards coverage.',
  },
];

export default function LoginForm() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({ defaultValues: { remember: false } });

  const activeRole = ROLE_TABS.find((r) => r.id === selectedRole)!;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleAutofill = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setValue('email', cred.email);
    setValue('password', cred.password);
    setSelectedRole(cred.role);
    toast.success(`Autofilled ${cred.label} credentials`);
  };

  // Backend integration point: POST /api/auth/login with { email, password, role }
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1200));

    const match = DEMO_CREDENTIALS.find(
      (c) => c.email === data.email && c.password === data.password
    );

    if (!match) {
      setIsLoading(false);
      toast.error('Invalid credentials — use the demo accounts below to sign in');
      return;
    }

    toast.success(`Signed in as ${match.label}`);
    setTimeout(() => router.push(match.destination), 500);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 fade-in">
      {/* Role tabs */}
      <div className="flex gap-2">
        {ROLE_TABS.map((role) => (
          <button
            key={`role-tab-${role.id}`}
            onClick={() => setSelectedRole(role.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-semibold transition-all duration-150 ${
              selectedRole === role.id
                ? 'border-violet-500 bg-violet-50 text-violet-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:bg-violet-50/50'
            }`}
          >
            <span className="text-lg">{role.emoji}</span>
            {role.label}
          </button>
        ))}
      </div>

      {/* Welcome copy */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{activeRole.welcome}</h2>
        <p className="text-slate-500 text-sm mt-1 leading-relaxed">{activeRole.sub}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Email address
          </label>
          <input
            type="email"
            className="input-field"
            placeholder={`your.name@school.edu`}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
            })}
          />
          {errors.email && (
            <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-field pr-11"
              placeholder="••••••••"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
              {...register('remember')}
            />
            <span className="text-sm text-slate-600">Remember me</span>
          </label>
          <button type="button" className="text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors">
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ minHeight: '44px' }}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Signing in…
            </>
          ) : (
            `Sign In as ${activeRole.label}`
          )}
        </button>
      </form>

      {/* Demo credentials */}
      <div className="border border-violet-100 rounded-2xl bg-violet-50/60 p-4">
        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-3">
          Demo Accounts — click to autofill
        </p>
        <div className="flex flex-col gap-2">
          {DEMO_CREDENTIALS.map((cred) => (
            <div
              key={`cred-${cred.role}`}
              className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-violet-100 hover:border-violet-300 hover:shadow-sm transition-all duration-150 cursor-pointer group"
              onClick={() => handleAutofill(cred)}
            >
              <div className="flex items-center gap-3">
                <span className={`badge text-xs ${
                  cred.role === 'student' ? 'bg-sky-100 text-sky-700' :
                  cred.role === 'teacher'? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {cred.label}
                </span>
                <span className="text-xs text-slate-600 font-mono">{cred.email}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleCopy(cred.email, `email-${cred.role}`); }}
                  className="p-1 rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
                  title="Copy email"
                >
                  {copiedField === `email-${cred.role}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
                <span className="text-violet-600 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Use →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        By signing in, you agree to GOGI&apos;s{' '}
        <span className="text-violet-600 cursor-pointer hover:underline">Terms of Service</span>
        {' '}and{' '}
        <span className="text-violet-600 cursor-pointer hover:underline">Privacy Policy</span>.
      </p>
    </div>
  );
}