import { createClient } from '@/lib/supabase/client';

export async function calculateStreak(studentId: string): Promise<number> {
  const supabase = createClient();
  const { data: sessions } = await supabase
    .from('sessions')
    .select('completed_at')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  if (!sessions || sessions.length === 0) return 0;

  // Get unique calendar dates (YYYY-MM-DD), most recent first
  const dates = [
    ...new Set(
      sessions.map((s) => new Date(s.completed_at).toISOString().split('T')[0]),
    ),
  ]
    .sort()
    .reverse();

  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let expected = today;

  for (const date of dates) {
    if (date === expected) {
      streak++;
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().split('T')[0];
    } else if (date < expected) {
      break; // Gap found — streak ends
    }
  }

  return streak;
}
