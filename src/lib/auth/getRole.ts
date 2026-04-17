import { createClient } from '@/lib/supabase/client';

export async function getUserRole(userId: string): Promise<'teacher' | 'student'> {
  const supabase = createClient();

  // Fast path: read role from session metadata (no DB query needed)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.user_metadata?.role) {
    console.log('[getUserRole] role from user_metadata:', user.user_metadata.role);
    return user.user_metadata.role as 'teacher' | 'student';
  }
  if (user?.app_metadata?.role) {
    console.log('[getUserRole] role from app_metadata:', user.app_metadata.role);
    return user.app_metadata.role as 'teacher' | 'student';
  }

  // Slow path: DB query with 2s timeout as last resort
  try {
    const { data } = (await Promise.race([
      supabase.from('users').select('role').eq('id', userId).single(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getUserRole timeout after 2s')), 2000),
      ),
    ])) as { data: { role: string } | null; error: unknown };

    if (data?.role) {
      console.log('[getUserRole] role from DB:', data.role);
      return data.role as 'teacher' | 'student';
    }
  } catch (err) {
    console.error('[getUserRole] DB query failed or timed out:', err);
  }

  console.warn('[getUserRole] no role found — defaulting to student');
  return 'student';
}
