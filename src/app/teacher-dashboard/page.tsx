import { redirect } from 'next/navigation';

// Retired 2026-04-18 — pre-UX-pivot legacy route.
// Original implementation preserved in git history.
// Component folder (src/app/teacher-dashboard/components/) left in place pending post-pilot cleanup.
export default function LegacyTeacherDashboardRedirect() {
  redirect('/dashboard/teacher');
}
