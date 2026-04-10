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
        <h2 className="text-2xl font-bold text-slate-900">Good to see you.</h2>
        <p className="text-slate-500 text-sm mt-1 leading-relaxed">
          Check in on your class — see who&apos;s struggling and what standards need attention.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
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

      <p className="text-center text-xs text-slate-400">
        By signing in, you agree to GOGI&apos;s{' '}
        <span className="text-violet-600 cursor-pointer hover:underline">Terms of Service</span>
        {' '}and{' '}
        <span className="text-violet-600 cursor-pointer hover:underline">Privacy Policy</span>.
      </p>
    </div>
  );
}
