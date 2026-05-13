import { describe, expect, it } from 'vitest';
import {
  buildGutenbergReadingWinStatus,
  extractGutenbergPassageIdFromQuestion,
} from '../../src/lib/reading-wins/gutenbergStatus';

describe('Gutenberg Reading Win status', () => {
  it('summarizes approved, pending, and promoted public-domain passage flow by FAST standard', () => {
    const rows = buildGutenbergReadingWinStatus({
      passages: [
        {
          id: '7ed6f8cc-aaaa-bbbb-cccc-9e61bbf00001',
          classification: 'mood_misreading',
          approval_status: 'approved',
          approved: true,
          source_title: 'A Public Domain Story',
          source_author: 'Known Author',
        },
        {
          id: 'passage-pending-1',
          classification: 'figurative_language_failure',
          standard_code: 'ELA.9.R.3.1',
          approval_status: 'pending_review',
          approved: false,
          source_title: 'Another Story',
          source_author: 'Known Author',
        },
        {
          id: 'passage-approved-2',
          classification: 'topic_vs_theme_confusion',
          approval_status: null,
          approved: true,
          source_title: 'Theme Story',
          source_author: null,
        },
      ],
      promotedQuestions: [
        {
          content:
            'QUESTION:\nHow does the comparison in “a bright sword of light” help develop the meaning of the passage?\n\nTARGET_SKILL:\nMetaphor and simile\n\nFAST_ITEM_QUALITY:\nstrong signal (8/8)\n\nTEACHER_TRUST_NOTE:\nReady for teacher skim.\n\nGOGI_SKILL_MOVE:\nExplain the effect of a comparison.\n\nSOURCE:\nProject Gutenberg passage 7ed6f8cc-aaaa-bbbb-cccc-9e61bbf00001\nReading Win rep 1',
          cognitive_skill_targeted: 'ELA.9.R.3.1',
          source_classification: 'ELA.9.R.3.1',
        },
        {
          content:
            'QUESTION:\nRead this comparison from the passage: “a bright sword of light.” What does it suggest in context?\n\nTARGET_SKILL:\nMetaphor and simile\n\nFAST_ITEM_QUALITY:\nstrong signal (8/8)\n\nTEACHER_TRUST_NOTE:\nReady for teacher skim.\n\nGOGI_SKILL_MOVE:\nExplain the effect of a comparison.\n\nSOURCE:\nProject Gutenberg passage 7ed6f8cc-aaaa-bbbb-cccc-9e61bbf00001\nReading Win rep 2',
          cognitive_skill_targeted: 'ELA.9.R.3.1',
          source_classification: 'ELA.9.R.3.1',
        },
      ],
    });

    const r31 = rows.find((row) => row.standard_code === 'ELA.9.R.3.1');
    const r12 = rows.find((row) => row.standard_code === 'ELA.9.R.1.2');

    expect(r31).toMatchObject({
      approved_passages: 1,
      pending_review_passages: 1,
      unpromoted_approved_passages: 0,
      promoted_question_rows: 2,
      trusted_promoted_question_rows: 1,
      audit_promoted_question_rows: 1,
    });
    expect(r31?.sample_titles[0]).toContain('A Public Domain Story');
    expect(r12).toMatchObject({
      approved_passages: 1,
      unpromoted_approved_passages: 1,
    });
  });

  it('extracts promoted passage ids from Reading Win question content', () => {
    expect(
      extractGutenbergPassageIdFromQuestion(
        'SOURCE:\nProject Gutenberg passage 7ed6f8cc-aaaa-bbbb-cccc-9e61bbf00001'
      )
    ).toBe('7ed6f8cc-aaaa-bbbb-cccc-9e61bbf00001');
  });
});
