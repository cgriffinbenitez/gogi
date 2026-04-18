import { redirect } from 'next/navigation';

// Retired 2026-04-18 — pre-UX-pivot legacy route.
// Original implementation preserved in git history.
// Component folder (src/app/student-home/components/) left in place pending post-pilot cleanup.
export default function LegacyStudentHomeRedirect() {
  redirect('/dashboard/student');
}
