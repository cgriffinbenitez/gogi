'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { UserRole } from './LoginPage';

interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  school: string;
  grade: string;
  teacherCode: string;
  terms: boolean;
}

interface SignUpFormProps {
  onSwitch: () => void;
}

const FLORIDA_SCHOOLS = [
  'Jefferson Middle School, Miami-Dade',
  'Lincoln Park Elementary, Broward County',
  'Westside High School, Orange County',
  'Palmetto Ridge Middle, Collier County',
  'Riverside Charter, Duval County',
  'Suncoast STEM Academy, Hillsborough',
  'Liberty City K-8, Miami-Dade',
  'Other / Not Listed',
];

const GRADES = ['6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];

export default function SignUpForm({ onSwitch }: SignUpFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({ defaultValues: { role: 'student' } });

  const passwordValue = watch('password');

  // Backend integration point: POST /api/auth/register with full registration payload
  const onSubmit = async (_data: SignUpFormData) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    setIsLoading(false);
    toast.success('Account created! Check your school email to verify.');
    setTimeout(onSwitch, 1500);
  };

  return (
    <div className="flex flex-col gap-5 fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
        <p className="text-slate-500 text-sm mt-1">Join your classroom on GOGI today.</p>
      </div>

      {/* Role selector */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">I am a…</label>
        <div className="flex gap-2">
          {(['student', 'teacher', 'admin'] as UserRole[]).map((role) => (
            <button
              key={`signup-role-${role}`}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-semibold capitalize transition-all duration-150 ${
                selectedRole === role
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-slate-200 text-slate-500 hover:border-violet-200'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">First name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Marcus"
              {...register('firstName', { required: 'Required' })}
            />
            {errors.firstName && <p className="text-rose-500 text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Johnson"
              {...register('lastName', { required: 'Required' })}
            />
            {errors.lastName && <p className="text-rose-500 text-xs mt-1">{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">School email</label>
          <input
            type="email"
            className="input-field"
            placeholder="your.name@school.edu"
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
            })}
          />
          {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        {/* School */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">School</label>
          <select className="input-field" {...register('school', { required: 'School is required' })}>
            <option value="">Select your school…</option>
            {FLORIDA_SCHOOLS.map((s) => (
              <option key={`school-${s}`} value={s}>{s}</option>
            ))}
          </select>
          {errors.school && <p className="text-rose-500 text-xs mt-1">{errors.school.message}</p>}
        </div>

        {/* Grade (student only) */}
        {selectedRole === 'student' && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grade</label>
            <select className="input-field" {...register('grade', { required: 'Grade is required' })}>
              <option value="">Select your grade…</option>
              {GRADES.map((g) => (
                <option key={`grade-${g}`} value={g}>{g}</option>
              ))}
            </select>
            {errors.grade && <p className="text-rose-500 text-xs mt-1">{errors.grade.message}</p>}
          </div>
        )}

        {/* Teacher class code (student only) */}
        {selectedRole === 'student' && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Class code
              <span className="text-slate-400 font-normal ml-1">(from your teacher)</span>
            </label>
            <input
              type="text"
              className="input-field font-mono tracking-widest"
              placeholder="e.g. REYES-7A"
              {...register('teacherCode', { required: 'Class code is required' })}
            />
            {errors.teacherCode && <p className="text-rose-500 text-xs mt-1">{errors.teacherCode.message}</p>}
          </div>
        )}

        {/* Password */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
          <p className="text-slate-400 text-xs mb-1.5">At least 8 characters with one number and one symbol.</p>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-field pr-11"
              placeholder="Create a strong password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="text-rose-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm password</label>
          <input
            type="password"
            className="input-field"
            placeholder="Re-enter your password"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (v) => v === passwordValue || 'Passwords do not match',
            })}
          />
          {errors.confirmPassword && (
            <p className="text-rose-500 text-xs mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Terms */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-400 flex-shrink-0"
            {...register('terms', { required: 'You must accept the terms' })}
          />
          <span className="text-sm text-slate-600 leading-relaxed">
            I agree to GOGI&apos;s{' '}
            <span className="text-violet-600 hover:underline cursor-pointer">Terms of Service</span>
            {' '}and{' '}
            <span className="text-violet-600 hover:underline cursor-pointer">Privacy Policy</span>.
            {' '}Student data is protected under FERPA.
          </span>
        </label>
        {errors.terms && <p className="text-rose-500 text-xs -mt-2">{errors.terms.message}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ minHeight: '44px' }}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Creating account…
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <button onClick={onSwitch} className="text-violet-600 font-semibold hover:underline">
          Sign in
        </button>
      </p>
    </div>
  );
}