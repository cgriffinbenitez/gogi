'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  role: 'teacher' | 'student' | null;
  loading: boolean;
}

// Role is stored in user_metadata (set manually in Supabase dashboard)
// or app_metadata (set via service role). No DB query needed.
function extractRole(user: User): 'teacher' | 'student' {
  return (
    (user.user_metadata?.role as 'teacher' | 'student' | undefined) ??
    (user.app_metadata?.role as 'teacher' | 'student' | undefined) ??
    'student'
  );
}

const AuthContext = createContext<AuthState>({ user: null, role: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true });

  useEffect(() => {
    const supabase = createClient();

    // Hard failsafe: if nothing resolves in 3s, clear the loading gate.
    // Prevents infinite spinner when getUser() or onAuthStateChange hangs.
    const failsafe = setTimeout(() => {
      setState((prev) => {
        if (prev.loading) {
          console.warn('[AuthContext] failsafe fired — forcing loading:false');
          return { ...prev, loading: false };
        }
        return prev;
      });
    }, 3000);

    // Primary path: check existing session immediately on mount.
    // extractRole reads directly from the user object — no DB query.
    supabase.auth.getUser().then(({ data: { user } }) => {
      console.log('[AuthContext] getUser resolved — user:', user?.id ?? 'null');
      if (user) {
        setState({ user, role: extractRole(user), loading: false });
      } else {
        setState({ user: null, role: null, loading: false });
      }
    }).catch((err) => {
      console.error('[AuthContext] getUser threw:', err);
      // Don't set loading:false here — failsafe will handle it
    });

    // Secondary path: keep state in sync when auth changes (sign in/out).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] onAuthStateChange —', event, session?.user?.id ?? 'null');
      if (session?.user) {
        setState({ user: session.user, role: extractRole(session.user), loading: false });
      } else {
        setState({ user: null, role: null, loading: false });
      }
    });

    return () => {
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
