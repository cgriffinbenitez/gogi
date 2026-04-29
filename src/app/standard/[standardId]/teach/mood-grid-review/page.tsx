'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MoodGridReviewShell } from '@/components/mood-run/MoodGridReviewShell';

export default function MoodGridReviewPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardCode = useMemo(
    () => params.standardId.replace(/-/g, '.'),
    [params.standardId],
  );

  return (
    <MoodGridReviewShell
      standardCode={standardCode}
      onBack={() => router.push(`/standard/${params.standardId}/teach/mood`)}
    />
  );
}
