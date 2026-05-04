import type { SupabaseClient } from '@supabase/supabase-js';

type UserLike = {
  id: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export function getUserRole(user: UserLike | null | undefined) {
  return String(user?.app_metadata?.role ?? user?.user_metadata?.role ?? 'student');
}

export async function assertTeacherCanAccessStudent(
  supabase: Pick<SupabaseClient, 'from'>,
  user: UserLike,
  studentId: string
) {
  const role = getUserRole(user);
  if (!['teacher', 'admin'].includes(role)) {
    throw new Error('Teacher or admin access required.');
  }

  let query = supabase.from('students').select('id, teacher_id').eq('id', studentId);
  if (role !== 'admin') query = query.eq('teacher_id', user.id);

  const { data, error } = await query.single();
  if (error || !data) {
    throw new Error('Student not found for this teacher.');
  }

  return data;
}
