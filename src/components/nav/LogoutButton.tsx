'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: 12,
        color: '#B5D4F4',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
    >
      Sign out
    </button>
  );
}
