import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      session_id,
      question_id,
      student_id,
      standard_id,
      cognitive_skill_targeted,
      diagnostic_classification,
      intervention_type,
      intervention_content,
      student_response,
      mastery_achieved = false,
      attempt_number = 1,
    } = body;

    if (!session_id || !student_id || !standard_id) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, student_id, standard_id' },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();

    // Verify the requesting user owns this student record
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('responses')
      .insert({
        session_id,
        question_id: question_id ?? null,
        student_id,
        standard_id,
        cognitive_skill_targeted: cognitive_skill_targeted ?? null,
        diagnostic_classification: diagnostic_classification ?? null,
        intervention_type: intervention_type ?? null,
        intervention_content: intervention_content ?? null,
        student_response,
        mastery_achieved,
        attempt_number,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[api/responses/create] insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('[api/responses/create] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
