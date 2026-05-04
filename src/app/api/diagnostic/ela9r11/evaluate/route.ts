import { NextRequest, NextResponse } from 'next/server';
import { ELA9R11_SEED_ITEMS, scoreEla9R11Diagnostic } from '@/lib/diagnostic/ela9r11';
import type { Ela9R11DiagnosticItem, Ela9R11StudentAnswer } from '@/lib/diagnostic/ela9r11';

type RequestBody = {
  answers?: Ela9R11StudentAnswer[];
  items?: Ela9R11DiagnosticItem[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const items = Array.isArray(body.items) && body.items.length ? body.items : ELA9R11_SEED_ITEMS;

    return NextResponse.json(scoreEla9R11Diagnostic(items, answers));
  } catch (err) {
    console.error('[api/diagnostic/ela9r11/evaluate] error:', err);
    return NextResponse.json({ error: 'Could not evaluate ELA.9.R.1.1 diagnostic.' }, { status: 500 });
  }
}
