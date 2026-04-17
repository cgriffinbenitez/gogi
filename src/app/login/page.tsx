'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserRole } from '@/lib/auth/getRole';
import { FONTS, C } from '@/lib/constants/design';

function getErrorMessage(error: { message?: string }): string {
  const msg = error?.message?.toLowerCase() ?? '';
  if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('email') || msg.includes('password')) {
    return 'Email or password is incorrect.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
    return 'Connection issue — please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data.user) {
        setError(getErrorMessage(authError ?? {}));
        setLoading(false);
        return;
      }

      const role = await getUserRole(data.user.id);
      console.log('[Login] getUserRole returned:', role, '— calling router.push');

      if (role === 'teacher') {
        console.log('[Login] routing to /dashboard/teacher');
        router.push('/dashboard/teacher');
      } else {
        console.log('[Login] routing to /dashboard/student');
        router.push('/dashboard/student');
      }

      // Safety: clear spinner if navigation doesn't unmount this component
      setLoading(false);
    } catch {
      setError('Connection issue — please try again.');
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    background: C.light,
    border: `1.5px solid ${C.blueMid}`,
    borderRadius: 8,
    padding: '0 14px',
    fontSize: 14,
    color: C.dark,
    fontFamily: FONTS.ui,
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: 10,
  };

  return (
    <div
      style={{
        background: C.white,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.ui,
      }}
    >
      <div
        style={{
          width: 380,
          background: C.white,
          border: `1px solid #E0E0E0`,
          borderRadius: 14,
          padding: '42px 34px 32px',
          boxSizing: 'border-box',
        }}
      >
        {/* GOGI wordmark */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FONTS.passage,
              fontSize: 50,
              fontWeight: 800,
              color: C.navy,
              letterSpacing: '-2px',
              lineHeight: 1,
            }}
          >
            GOGI
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 8,
              fontWeight: 400,
              color: C.gray,
              textTransform: 'uppercase',
              letterSpacing: 3,
              marginTop: 6,
            }}
          >
            ADAPTIVE LITERACY PLATFORM
          </div>

          {/* Divider */}
          <div
            style={{
              width: 40,
              height: 2,
              background: C.blue,
              margin: '12px auto 24px',
            }}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Label */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.gray,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            STUDENT LOGIN
          </div>

          {/* Email */}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
            required
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = C.blue)}
            onBlur={e => (e.currentTarget.style.borderColor = C.blueMid)}
          />

          {/* Password */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            required
            style={{ ...inputStyle, marginBottom: 0 }}
            onFocus={e => (e.currentTarget.style.borderColor = C.blue)}
            onBlur={e => (e.currentTarget.style.borderColor = C.blueMid)}
          />

          {/* Inline error */}
          {error && (
            <div
              style={{
                fontSize: 13,
                color: C.red,
                marginTop: 8,
              }}
            >
              {error}
            </div>
          )}

          {/* Sign In button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 48,
              background: loading ? '#163960' : C.navy,
              color: C.white,
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 6,
              fontFamily: FONTS.ui,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#163960'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.navy; }}
          >
            {loading ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ animation: 'spin 0.75s linear infinite' }}
                >
                  <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                  <path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Forgot password */}
        <button
          type="button"
          onClick={() => router.push('/reset-password')}
          style={{
            fontSize: 13,
            color: C.blue,
            textAlign: 'center',
            display: 'block',
            marginTop: 14,
            textDecoration: 'none',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            width: '100%',
            fontFamily: FONTS.ui,
          }}
        >
          Forgot password?
        </button>

        {/* Teacher Login box */}
        <div
          style={{
            background: C.blueLight,
            border: `1px solid ${C.blueMid}`,
            borderRadius: 8,
            padding: '12px 14px',
            marginTop: 24,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.navy,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            TEACHER LOGIN
          </div>
          <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
            griffin@gogi.com → /dashboard/teacher
            <br />
            student login → /dashboard/student
          </div>
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
