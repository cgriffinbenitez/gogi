import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  buildOriginalFastAlignedDraftSet,
  buildOriginalFastAlignedDraft,
  evaluateOriginalItemQuality,
  isOriginalBenchmark,
  isOriginalPassageType,
} from '@/lib/original-items/engine';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      benchmark_code?: string;
      passage_type?: string;
      topic?: string;
      grade?: number;
      count?: number;
    };

    if (!body.benchmark_code || !isOriginalBenchmark(body.benchmark_code)) {
      return NextResponse.json({ error: 'Valid benchmark code required.' }, { status: 400 });
    }

    const passageType =
      body.passage_type && isOriginalPassageType(body.passage_type) ? body.passage_type : undefined;

    const count = Math.max(1, Math.min(25, Math.floor(Number(body.count ?? 1))));
    const drafts =
      count === 1
        ? [
            buildOriginalFastAlignedDraft({
              benchmarkCode: body.benchmark_code,
              passageType,
              topic: body.topic,
              grade: body.grade,
            }),
          ]
        : buildOriginalFastAlignedDraftSet({
            benchmarkCode: body.benchmark_code,
            passageType,
            topic: body.topic,
            grade: body.grade,
            count,
          });
    const qualityGates = drafts.map((draft) => evaluateOriginalItemQuality(draft));
    const rejected = qualityGates.find((gate) => gate.decision === 'reject');

    if (rejected) {
      return NextResponse.json(
        {
          error:
            'Generated item did not pass the FAST blueprint quality gate. Try a clearer topic or benchmark.',
          quality_gate: rejected,
        },
        { status: 422 }
      );
    }

    const { data, error } = await supabase
      .from('original_item_drafts')
      .insert(drafts.map((draft) => ({ ...draft, created_by: user.id })))
      .select('*');

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      draft: data?.[0] ?? null,
      drafts: data ?? [],
      quality_gates: qualityGates,
    });
  } catch (err) {
    console.error('[api/original-items/generate] error:', err);
    const message = err instanceof Error ? err.message : 'Could not generate original item draft.';
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
