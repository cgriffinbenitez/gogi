'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserRole } from '@/lib/auth/getRole';
import { FONTS } from '@/lib/constants/design';

// ─── Auth helpers (unchanged) ─────────────────────────────────────────────────

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

// ─── Particle config ──────────────────────────────────────────────────────────

const P_COLORS: { solid: string; glow: string }[] = [
  { solid: '#00d4ff', glow: 'rgba(0,212,255,0.3)'   },
  { solid: '#ff9500', glow: 'rgba(255,149,0,0.3)'   },
  { solid: '#a855f7', glow: 'rgba(168,85,247,0.3)'  },
  { solid: '#00ff88', glow: 'rgba(0,255,136,0.3)'   },
  { solid: '#ff5000', glow: 'rgba(255,80,0,0.3)'    },
  { solid: '#64c8ff', glow: 'rgba(100,200,255,0.3)' },
  { solid: '#ffc800', glow: 'rgba(255,200,0,0.3)'   },
  { solid: '#c864ff', glow: 'rgba(200,100,255,0.3)' },
];
const P_ANIMS = ['rise1', 'rise2', 'rise3'] as const;

interface Particle {
  id:    number;
  left:  string;
  size:  number;
  color: string;
  glow:  string;
  dur:   number;
  delay: number;
  anim:  typeof P_ANIMS[number];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  // ── Auth state (unchanged) ──────────────────────────────────────────────────
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // ── Visual state ────────────────────────────────────────────────────────────
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 35 }, (_, i) => {
        const big  = Math.random() < 0.3;
        const size = big ? 10 + Math.random() * 10 : 3 + Math.random() * 7;
        const c    = P_COLORS[Math.floor(Math.random() * P_COLORS.length)];
        const anim = P_ANIMS[Math.floor(Math.random() * 3)];
        const glow = size > 8
          ? `0 0 ${size * 2}px ${c.solid}, 0 0 ${size * 4}px ${c.glow}`
          : 'none';
        return {
          id:    i,
          left:  `${Math.random() * 100}%`,
          size:  Math.round(size),
          color: c.solid,
          glow,
          dur:   10 + Math.random() * 16,
          delay: Math.random() * 18,
          anim,
        };
      })
    );
  }, []);

  // ── Auth handler (unchanged) ────────────────────────────────────────────────

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

      setLoading(false);
    } catch {
      setError('Connection issue — please try again.');
      setLoading(false);
    }
  }

  // ── Shared input style ──────────────────────────────────────────────────────

  const fieldInput: React.CSSProperties = {
    width:        '100%',
    background:   'rgba(255,255,255,0.04)',
    border:       '1px solid rgba(0,212,255,0.15)',
    borderRadius: 8,
    padding:      '11px 14px',
    fontSize:     14,
    color:        '#fff',
    outline:      'none',
    boxSizing:    'border-box',
    fontFamily:   FONTS.ui,
  };

  const quickBtn: React.CSSProperties = {
    flex:         1,
    padding:      '8px 10px',
    borderRadius: 8,
    fontSize:     11,
    fontWeight:   700,
    cursor:       'pointer',
    border:       '1px solid rgba(0,212,255,0.12)',
    background:   'rgba(255,255,255,0.02)',
    color:        '#2a8faa',
    transition:   'all .2s',
    fontFamily:   FONTS.ui,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background:     '#040810',
      minHeight:      '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        20,
      position:       'relative',
      overflow:       'hidden',
      fontFamily:     FONTS.ui,
    }}>

      {/* ── Aurora layer ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
        top: -200, left: -100, zIndex: 0, pointerEvents: 'none',
        animation: 'auroraFloat1 12s ease-in-out infinite',
      }} />
      <div style={{
        position: 'fixed', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,100,0,0.07) 0%, transparent 70%)',
        bottom: -150, right: -100, zIndex: 0, pointerEvents: 'none',
        animation: 'auroraFloat2 15s ease-in-out infinite',
      }} />
      <div style={{
        position: 'fixed', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)',
        top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 0, pointerEvents: 'none',
        animation: 'auroraFloat3 18s ease-in-out infinite',
      }} />

      {/* ── Grid layer ───────────────────────────────────────────────────────── */}
      <div style={{
        position:        'fixed',
        inset:           0,
        zIndex:          0,
        pointerEvents:   'none',
        opacity:         0.04,
        backgroundImage: 'linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)',
        backgroundSize:  '60px 60px',
      }} />

      {/* ── Particles ────────────────────────────────────────────────────────── */}
      {particles.map(p => (
        <div key={p.id} style={{
          position:     'fixed',
          top:          0,
          left:         p.left,
          width:        p.size,
          height:       p.size,
          borderRadius: '50%',
          background:   p.color,
          boxShadow:    p.glow === 'none' ? undefined : p.glow,
          zIndex:       1,
          pointerEvents:'none',
          animation:    `${p.anim} ${p.dur}s ${p.delay}s linear infinite`,
        }} />
      ))}

      {/* ── Main wrapper ─────────────────────────────────────────────────────── */}
      <div style={{
        position:      'relative',
        zIndex:        2,
        width:         '100%',
        maxWidth:      420,
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
      }}>

        {/* ── Logo area ────────────────────────────────────────────────────── */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          marginBottom:  24,
          position:      'relative',
        }}>

          {/* Pulse rings */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position:     'absolute',
              width:        80,
              height:       80,
              borderRadius: '50%',
              border:       `1px solid rgba(0,212,255,${0.4 - i * 0.1})`,
              top:          '50%',
              left:         '50%',
              pointerEvents:'none',
              zIndex:       0,
              animation:    `ringPulse 3s ease-out ${i}s infinite`,
            }} />
          ))}

          {/* Book icon */}
          <div style={{
            position:  'relative',
            zIndex:    1,
            animation: 'bookPulse 3s ease-in-out infinite',
            marginBottom: 2,
          }}>
            <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="lgBookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#40e8ff" />
                  <stop offset="100%" stopColor="#0066aa" />
                </linearGradient>
                <linearGradient id="lgNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#ffcc44" />
                  <stop offset="100%" stopColor="#ff5500" />
                </linearGradient>
                <filter id="lgGlow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Pages */}
              <path d="M32 52 L8 43 L8 14 L32 21 Z"  fill="rgba(0,212,255,0.1)" stroke="url(#lgBookGrad)" strokeWidth="2" />
              <path d="M32 52 L56 43 L56 14 L32 21 Z" fill="rgba(0,212,255,0.1)" stroke="url(#lgBookGrad)" strokeWidth="2" />
              {/* Spine */}
              <line x1="32" y1="21" x2="32" y2="52" stroke="url(#lgBookGrad)" strokeWidth="2.5" />
              {/* Left nodes */}
              <circle cx="21" cy="27" r="2.8" fill="url(#lgNodeGrad)" filter="url(#lgGlow)" />
              <circle cx="15" cy="34" r="2"   fill="url(#lgNodeGrad)" filter="url(#lgGlow)" />
              <circle cx="25" cy="38" r="2"   fill="url(#lgNodeGrad)" filter="url(#lgGlow)" />
              {/* Right nodes */}
              <circle cx="43" cy="27" r="2.8" fill="url(#lgNodeGrad)" filter="url(#lgGlow)" />
              <circle cx="49" cy="34" r="2"   fill="url(#lgNodeGrad)" filter="url(#lgGlow)" />
              <circle cx="39" cy="38" r="2"   fill="url(#lgNodeGrad)" filter="url(#lgGlow)" />
              {/* Center node */}
              <circle cx="32" cy="34" r="3.5" fill="url(#lgNodeGrad)" filter="url(#lgGlow)" />
              {/* Connections from center */}
              <line x1="32" y1="34" x2="21" y2="27" stroke="#ffcc44" strokeWidth="1.2" opacity="0.8" filter="url(#lgGlow)" />
              <line x1="32" y1="34" x2="15" y2="34" stroke="#ffcc44" strokeWidth="1"   opacity="0.6" filter="url(#lgGlow)" />
              <line x1="32" y1="34" x2="25" y2="38" stroke="#ffcc44" strokeWidth="1"   opacity="0.6" filter="url(#lgGlow)" />
              <line x1="32" y1="34" x2="43" y2="27" stroke="#ffcc44" strokeWidth="1.2" opacity="0.8" filter="url(#lgGlow)" />
              <line x1="32" y1="34" x2="49" y2="34" stroke="#ffcc44" strokeWidth="1"   opacity="0.6" filter="url(#lgGlow)" />
              <line x1="32" y1="34" x2="39" y2="38" stroke="#ffcc44" strokeWidth="1"   opacity="0.6" filter="url(#lgGlow)" />
            </svg>
          </div>

          {/* Wordmark + scanline */}
          <div style={{ position: 'relative', overflow: 'visible' }}>
            {/* Scanline sweep */}
            <div style={{
              position:     'absolute',
              left:         -10,
              right:        -10,
              height:       3,
              background:   'linear-gradient(90deg, transparent, rgba(0,212,255,0.8), rgba(255,255,255,0.4), rgba(0,212,255,0.8), transparent)',
              borderRadius: 2,
              boxShadow:    '0 0 8px rgba(0,212,255,0.6)',
              pointerEvents:'none',
              animation:    'scan 3.5s ease-in-out 0.5s infinite',
            }} />

            {/* Wordmark */}
            <div style={{ display: 'flex', alignItems: 'baseline', animation: 'flicker 8s ease-in-out infinite' }}>
              <span style={{
                fontSize:             58,
                fontWeight:           900,
                letterSpacing:        5,
                background:           'linear-gradient(135deg, #40e8ff 0%, #00d4ff 40%, #ffffff 50%, #00d4ff 60%, #0099cc 100%)',
                backgroundSize:       '300%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
                lineHeight:           1,
                animation:            'goGlow 2.5s ease-in-out infinite',
              }}>GO</span>
              <span style={{
                fontSize:             58,
                fontWeight:           900,
                letterSpacing:        5,
                background:           'linear-gradient(135deg, #ffcc44 0%, #ff9500 40%, #ffffff 50%, #ff9500 60%, #ff6600 100%)',
                backgroundSize:       '300%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
                lineHeight:           1,
                animation:            'giGlow 2.5s ease-in-out 0.2s infinite',
              }}>GI</span>
            </div>
          </div>

          {/* Tagline */}
          <div style={{
            fontSize:      10,
            fontWeight:    700,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color:         '#2a6880',
            marginTop:     6,
            textShadow:    '0 0 20px rgba(0,212,255,0.3)',
          }}>
            Adaptive Literacy Intelligence
          </div>
        </div>

        {/* ── Login card ───────────────────────────────────────────────────── */}
        <div style={{
          width:        '100%',
          background:   'linear-gradient(145deg, rgba(20,50,90,0.7), rgba(5,12,22,0.9))',
          border:       '1px solid rgba(0,212,255,0.2)',
          borderRadius: 20,
          padding:      '28px 30px',
          boxShadow:    '0 0 60px rgba(0,212,255,0.1), 0 0 120px rgba(0,212,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,212,255,0.05)',
          boxSizing:    'border-box',
          position:     'relative',
          overflow:     'hidden',
        }}>

          {/* Card shine sweep */}
          <div style={{
            position:     'absolute',
            top:          0,
            left:         '-100%',
            width:        '60%',
            height:       '100%',
            background:   'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
            pointerEvents:'none',
            zIndex:       0,
            animation:    'cardShine 6s ease-in-out infinite',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize:      13,
              fontWeight:    700,
              color:         'rgba(255,255,255,0.55)',
              textAlign:     'center',
              marginBottom:  18,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              Sign in to your account
            </div>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize:      10,
                  fontWeight:    700,
                  color:         '#2a8faa',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  marginBottom:  5,
                }}>Email</div>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  style={fieldInput}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.7)';
                    e.currentTarget.style.background  = 'rgba(0,212,255,0.06)';
                    e.currentTarget.style.boxShadow   = '0 0 20px rgba(0,212,255,0.15), inset 0 0 20px rgba(0,212,255,0.03)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)';
                    e.currentTarget.style.background  = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.boxShadow   = 'none';
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{
                  fontSize:      10,
                  fontWeight:    700,
                  color:         '#2a8faa',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  marginBottom:  5,
                }}>Password</div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  style={fieldInput}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.7)';
                    e.currentTarget.style.background  = 'rgba(0,212,255,0.06)';
                    e.currentTarget.style.boxShadow   = '0 0 20px rgba(0,212,255,0.15), inset 0 0 20px rgba(0,212,255,0.03)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)';
                    e.currentTarget.style.background  = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.boxShadow   = 'none';
                  }}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background:   'rgba(163,45,45,0.15)',
                  border:       '1px solid #A32D2D',
                  borderRadius: 6,
                  padding:      '8px 12px',
                  fontSize:     12,
                  color:        '#FCEBEB',
                  marginTop:    10,
                }}>
                  {error}
                </div>
              )}

              {/* Sign in button */}
              <button
                type="submit"
                disabled={loading}
                className="gogi-signin-btn"
                style={{
                  width:          '100%',
                  background:     loading
                    ? '#163960'
                    : 'linear-gradient(135deg, #00aadd, #0077bb, #2E75B6)',
                  color:          '#fff',
                  border:         'none',
                  borderRadius:   10,
                  padding:        14,
                  fontSize:       14,
                  fontWeight:     800,
                  letterSpacing:  '1px',
                  textTransform:  'uppercase',
                  cursor:         loading ? 'not-allowed' : 'pointer',
                  marginTop:      6,
                  fontFamily:     FONTS.ui,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            8,
                  boxShadow:      '0 0 30px rgba(0,153,204,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                  transition:     'all 0.2s ease',
                  boxSizing:      'border-box',
                  position:       'relative',
                  overflow:       'hidden',
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 0 50px rgba(0,153,204,0.8), 0 0 80px rgba(0,153,204,0.3), inset 0 1px 0 rgba(255,255,255,0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(0,153,204,0.4), inset 0 1px 0 rgba(255,255,255,0.15)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                      style={{ animation: 'spin 0.75s linear infinite' }}>
                      <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                      <path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Signing in...
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div style={{
              height:     1,
              background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)',
              margin:     '18px 0',
            }} />

            {/* Quick access */}
            <div>
              <div style={{
                fontSize:      9,
                fontWeight:    700,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                color:         'rgba(42,104,128,0.7)',
                textAlign:     'center',
                marginBottom:  8,
              }}>
                Quick access · pilot testing
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setEmail('student1@gogi.pilot'); setPassword('student2026!'); }}
                  style={quickBtn}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)';
                    e.currentTarget.style.background  = 'rgba(0,212,255,0.08)';
                    e.currentTarget.style.color       = '#00d4ff';
                    e.currentTarget.style.boxShadow   = '0 0 16px rgba(0,212,255,0.15)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.12)';
                    e.currentTarget.style.background  = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.color       = '#2a8faa';
                    e.currentTarget.style.boxShadow   = 'none';
                  }}
                >
                  Student Login
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail('griffin@gogi.com'); setPassword('gogi2026!'); }}
                  style={quickBtn}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)';
                    e.currentTarget.style.background  = 'rgba(0,212,255,0.08)';
                    e.currentTarget.style.color       = '#00d4ff';
                    e.currentTarget.style.boxShadow   = '0 0 16px rgba(0,212,255,0.15)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.12)';
                    e.currentTarget.style.background  = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.color       = '#2a8faa';
                    e.currentTarget.style.boxShadow   = 'none';
                  }}
                >
                  Teacher Login
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <div style={{ fontSize: 10, color: '#162535', textAlign: 'center', marginTop: 16 }}>
          South Dade Senior High School · Pilot Cohort 2026–27
        </div>
      </div>

      {/* ── Keyframes ────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes auroraFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(60px, 40px) scale(1.2); }
        }
        @keyframes auroraFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-40px, -60px) scale(1.15); }
        }
        @keyframes auroraFloat3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50%      { transform: translate(-50%, -50%) scale(1.3); }
        }
        @keyframes rise1 {
          0%   { transform: translateY(110vh) scale(0.2) rotate(0deg);    opacity: 0;   }
          15%  { opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(-150px) scale(1.4) rotate(180deg); opacity: 0;   }
        }
        @keyframes rise2 {
          0%   { transform: translateY(110vh) translateX(0) scale(0.3);         opacity: 0;   }
          20%  { opacity: 0.9; }
          50%  { transform: translateY(50vh) translateX(25px) scale(1); }
          100% { transform: translateY(-150px) translateX(-15px) scale(1.2);    opacity: 0;   }
        }
        @keyframes rise3 {
          0%   { transform: translateY(110vh) scale(0.4); opacity: 0;   }
          25%  { opacity: 0.8; }
          75%  { opacity: 0.4; }
          100% { transform: translateY(-150px) scale(0.8); opacity: 0; }
        }
        @keyframes ringPulse {
          0%   { transform: translate(-50%, -60%) scale(0.8); opacity: 0.8; }
          100% { transform: translate(-50%, -60%) scale(2.5); opacity: 0;   }
        }
        @keyframes bookPulse {
          0%, 100% {
            filter: drop-shadow(0 0 12px rgba(0,212,255,0.8))
                    drop-shadow(0 0 30px rgba(0,212,255,0.4));
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 28px rgba(0,212,255,1))
                    drop-shadow(0 0 60px rgba(0,212,255,0.6))
                    drop-shadow(0 0 100px rgba(0,212,255,0.2));
            transform: scale(1.05);
          }
        }
        @keyframes goGlow {
          0%, 100% {
            filter: drop-shadow(0 0 6px rgba(0,212,255,0.5))
                    drop-shadow(0 0 15px rgba(0,212,255,0.25));
          }
          50% {
            filter: drop-shadow(0 0 25px rgba(0,212,255,1))
                    drop-shadow(0 0 50px rgba(0,212,255,0.7))
                    drop-shadow(0 0 90px rgba(0,212,255,0.3))
                    drop-shadow(0 0 120px rgba(0,212,255,0.1));
          }
        }
        @keyframes giGlow {
          0%, 100% {
            filter: drop-shadow(0 0 6px rgba(255,149,0,0.5))
                    drop-shadow(0 0 15px rgba(255,149,0,0.25));
          }
          50% {
            filter: drop-shadow(0 0 25px rgba(255,149,0,1))
                    drop-shadow(0 0 50px rgba(255,149,0,0.7))
                    drop-shadow(0 0 90px rgba(255,149,0,0.3))
                    drop-shadow(0 0 120px rgba(255,149,0,0.1));
          }
        }
        @keyframes scan {
          0%   { transform: translateY(-100%); opacity: 0;   }
          5%   { opacity: 0.6; }
          95%  { opacity: 0.1; }
          100% { transform: translateY(200%);  opacity: 0;   }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1;   }
          2%       { opacity: 0.8; }
          4%       { opacity: 1;   }
          50%      { opacity: 1;   }
          52%      { opacity: 0.9; }
          54%      { opacity: 1;   }
        }
        @keyframes cardShine {
          0%        { left: -100%; }
          50%, 100% { left:  200%; }
        }
        @keyframes btnShimmer {
          0%   { left: -100%; }
          100% { left:  200%; }
        }
        .gogi-signin-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          transition: none;
        }
        .gogi-signin-btn:hover::after {
          animation: btnShimmer 0.6s ease forwards;
        }
        input::placeholder { color: rgba(181,212,244,0.25) !important; }
      `}</style>
    </div>
  );
}
