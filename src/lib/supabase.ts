import { createBrowserClient, createServerClient } from '@supabase/ssr';

// ─── Browser client (singleton) ───────────────────────────────────────────────
// Use in 'use client' components only.

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ─── Server client factory ────────────────────────────────────────────────────
// Use in API routes and server components. Caller supplies cookie accessors
// appropriate for their context (NextRequest.cookies or next/headers cookies()).
//
// API route (read-only — no session refresh):
//   createSupabaseServerClient(() => req.cookies.getAll())
//
// Server component (read-write — allows session refresh):
//   const cookieStore = await cookies();
//   createSupabaseServerClient(
//     () => cookieStore.getAll(),
//     (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
//   )

export function createSupabaseServerClient(
  getAll: () => { name: string; value: string }[],
  setAll: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) => void = () => {},
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll, setAll },
    },
  );
}

export type UserRole = 'teacher' | 'student' | 'admin';

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data.role as UserRole;
}
