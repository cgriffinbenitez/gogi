import { redirect } from 'next/navigation';

// Retired 2026-04-18 — pre-UX-pivot legacy login.
// Original implementation preserved in git history.
// Component folder (src/app/sign-up-login-screen/components/) left in place pending post-pilot cleanup.
export default function LegacyLoginRedirect() {
  redirect('/login');
}
