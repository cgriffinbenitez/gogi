import { NextResponse } from 'next/server';
import { buildR11CoverageBoard } from '@/lib/teacher/pullOutSheet';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const board = await buildR11CoverageBoard();
    return NextResponse.json({ ok: true, board });
  } catch (error) {
    console.error('[api/teacher/r11-coverage] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build R.1.1 coverage board.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
