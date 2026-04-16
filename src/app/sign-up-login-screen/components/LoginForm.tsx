'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase, getUserRole } from '@/lib/supabase';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleForgotPassword = async () => {
    const email = forgotEmail.trim();
    if (!email) return;
    setForgotSending(true);
    await supabase.auth.resetPasswordForEmail(email);
    setForgotSending(false);
    setForgotSent(true);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    console.log('[Login] Calling signInWithPassword...');
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    console.log('[Login] signInWithPassword result:', { user: authData?.user?.id, error });

    if (error) {
      setIsLoading(false);
      toast.error(error.message);
      return;
    }

    console.log('[Login] Calling getUserRole for user:', authData.user.id);
    const role = await getUserRole(authData.user.id);
    console.log('[Login] getUserRole result:', role);

    if (!role) {
      setIsLoading(false);
      toast.error('Account not found. Contact your administrator.');
      await supabase.auth.signOut();
      return;
    }

    console.log('[Login] Routing to dashboard for role:', role);
    toast.success('Signed in successfully');

    if (role === 'teacher' || role === 'admin') {
      router.push('/teacher-dashboard');
    } else {
      router.push('/student-home');
    }
    console.log('[Login] router.push called');
  };

  return (
    <div className="flex flex-col gap-6 fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">Good to see you.</h2>
        <p className="text-[#94A3B8] text-sm mt-1 leading-relaxed">
          Sign in to continue your learning session.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-white mb-1.5">
            Email address
          </label>
          <input
            type="email"
            className="input-field"
            placeholder="your.name@school.edu"
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
            })}
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1.5 font-medium">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-white mb-1.5">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#94A3B8] transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1.5 font-medium">{errors.password.message}</p>
          )}

          {/* Forgot password */}
          {!showForgot ? (
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-[#94A3B8] text-xs mt-1.5 hover:text-white transition-colors"
            >
              Forgot your password?
            </button>
          ) : forgotSent ? (
            <p className="text-[#1D9E75] text-xs mt-2">
              Check your email for a reset link.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Enter your email"
                className="input-field text-sm"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotSending}
                  className="text-[#1D9E75] text-xs font-semibold hover:underline disabled:opacity-50"
                >
                  {forgotSending ? 'Sending…' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setForgotEmail(''); }}
                  className="text-[#4B5563] text-xs hover:text-[#94A3B8] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
            'Sign In'
          )}
        </button>
      </form>

      <p className="text-center text-xs text-[#4B5563]">
        By signing in, you agree to GOGI&apos;s{' '}
        <span className="text-[#1D9E75] cursor-pointer hover:underline">Terms of Service</span>
        {' '}and{' '}
        <span className="text-[#1D9E75] cursor-pointer hover:underline">Privacy Policy</span>.
      </p>
    </div>
  );
}
