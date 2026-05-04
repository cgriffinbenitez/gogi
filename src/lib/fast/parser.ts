import Anthropic from '@anthropic-ai/sdk';
import type { ParsedFastReport } from './constants';

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('FAST parser did not return JSON.');
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

export function assertParsedFastReport(value: unknown): asserts value is ParsedFastReport {
  const report = value as Partial<ParsedFastReport>;
  if (!report || typeof report !== 'object')
    throw new Error('FAST parser returned an empty report.');
  if (!report.fl_student_id) throw new Error('FAST parser missed the Florida student ID.');
  if (!['PM1', 'PM2', 'PM3'].includes(String(report.test_reason))) {
    throw new Error('FAST parser missed the progress monitoring window.');
  }
  if (
    !Number.isInteger(report.assessment_grade) ||
    Number(report.assessment_grade) < 3 ||
    Number(report.assessment_grade) > 12
  ) {
    throw new Error('FAST parser missed the assessment grade.');
  }
  if (!Number.isInteger(report.test_year)) throw new Error('FAST parser missed the test year.');
  if (!report.date_taken) throw new Error('FAST parser missed the test date.');
  if (!Number.isInteger(report.scale_score)) throw new Error('FAST parser missed the scale score.');
  if (!Number.isInteger(report.achievement_level)) {
    throw new Error('FAST parser missed the achievement level.');
  }
  if (!Array.isArray(report.category_performance)) {
    throw new Error('FAST parser missed category performance.');
  }
  if (report.category_performance.length !== 3) {
    throw new Error('FAST parser must return the three ELA reporting categories.');
  }
  if (!Array.isArray(report.item_responses) || report.item_responses.length === 0) {
    throw new Error('FAST parser missed item responses.');
  }
  if (report.item_responses.length < 30) {
    throw new Error('FAST parser returned too few item rows for a complete ISR.');
  }
}

export function getFastParseErrorStatus(message: string) {
  if (/Anthropic API key is invalid/i.test(message)) return 502;
  if (
    /FAST parser (returned|missed|must return)|too few item rows|progress monitoring window/i.test(
      message
    )
  ) {
    return 400;
  }
  return 500;
}

export async function parseFastPdfWithClaude(pdfBytes: ArrayBuffer): Promise<ParsedFastReport> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const base64 = Buffer.from(pdfBytes).toString('base64');

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_FAST_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 6000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract this Florida FAST ELA Reading Individual Student Report as strict JSON only.

Return this exact shape:
{
  "fl_student_id": "string",
  "test_reason": "PM1|PM2|PM3",
  "test_label": "string or null",
  "assessment_grade": 8,
  "test_year": 2026,
  "date_taken": "YYYY-MM-DD or null",
  "scale_score": 219,
  "achievement_level": 1,
  "percentile_rank": 12,
  "category_performance": [
    {"category_code":"RP|RI|RGV","category_name":"string","achievement_level":"Below the Standard|At/Near the Standard|Above the Standard"}
  ],
  "item_responses": [
    {
      "question_number": 1,
      "benchmark_code": "ELA.9.R.1.1",
      "reporting_category": "string or null",
      "benchmark_description": "string or null",
      "points_earned": 0,
      "points_possible": 1,
      "is_correct": false
    }
  ]
}

Use the benchmark/item table from the report. Preserve every item response you can read. assessment_grade is the grade level printed on the FAST report itself, not the student's current enrolled grade. If a scalar field is not visible, use null except test_year and assessment_grade, which should be inferred from the test administration label when possible.`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');

    const parsed = JSON.parse(extractJson(text)) as unknown;
    assertParsedFastReport(parsed);

    return parsed;
  } catch (err) {
    const status = typeof err === 'object' && err !== null && 'status' in err ? err.status : null;
    const message = err instanceof Error ? err.message : String(err);

    if (status === 401 || /invalid x-api-key|authentication_error/i.test(message)) {
      throw new Error(
        'Claude could not parse this FAST report because the Anthropic API key is invalid. Update ANTHROPIC_API_KEY in .env.local, then restart the dev server.'
      );
    }

    if (status === 404 || /model:|not_found_error/i.test(message)) {
      throw new Error(
        'Claude could not parse this FAST report because the configured model is unavailable. Set ANTHROPIC_FAST_MODEL to a valid Anthropic document-capable model, or remove it to use the app default.'
      );
    }

    throw err;
  }
}
