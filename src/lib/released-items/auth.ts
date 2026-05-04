import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserRole } from '@/lib/fast/auth';

type UserLike = {
  id: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export async function assertReleasedItemsAccess(
  supabase: Pick<SupabaseClient, 'from'>,
  user: UserLike | null
) {
  if (!user) throw new Error('Unauthorized');

  const metadataRole = getUserRole(user);
  if (['teacher', 'admin'].includes(metadataRole)) return;

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!['teacher', 'admin'].includes(String(data?.role))) {
    throw new Error('Teacher or admin access required.');
  }
}
