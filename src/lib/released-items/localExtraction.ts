import type {
  ReleasedBookletExtraction,
  ReleasedItemExtraction,
  ReleasedItemOption,
  ReleasedPassageExtraction,
} from './extraction';
import { assertReleasedBookletExtraction, normalizeReleasedExtraction } from './extraction';

type LocalBookletMetadata = {
  booklet_name: string;
  grade: number;
  subject: string;
  release_year: number;
  total_items_expected?: number | null;
};

type AnswerKeyRow = {
  correct_answer?: string;
  benchmark_code?: string;
  reporting_category?: 'RP' | 'RI' | 'RGV';
};

function compactLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function findAnswerKeyStart(lines: string[]) {
  const index = lines.findIndex((line, lineIndex) => {
    if (/^(answer key|scoring guide)$/i.test(line)) return true;
    if (/answer key$/i.test(line) && /FAST|ELA|Reading|Sample|Released/i.test(line)) return true;

    const nearby = lines.slice(lineIndex, lineIndex + 6).join(' ');
    return (
      /correct answer/i.test(nearby) &&
      /benchmark/i.test(nearby) &&
      /reporting categor/i.test(nearby)
    );
  });
  return index === -1 ? lines.length : index;
}

function normalizeAnswerKey(value: string) {
  return value
    .replace(/\band\b/gi, ',')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function normalizeReportingCategory(value: string): AnswerKeyRow['reporting_category'] {
  if (/prose|poetry/i.test(value)) return 'RP';
  if (/informational/i.test(value)) return 'RI';
  if (/genres|vocabulary/i.test(value)) return 'RGV';

  const category = value.match(/\b(RP|RI|RGV)\b/i)?.[1]?.toUpperCase();
  return category === 'RP' || category === 'RI' || category === 'RGV' ? category : undefined;
}

function parseAnswerKey(lines: string[]) {
  const answers = new Map<number, AnswerKeyRow>();
  let currentItemNumber: number | null = null;

  for (const line of lines) {
    const itemStart = line.match(/^(\d{1,2})[.)]\s+/)?.[1];
    if (itemStart) {
      currentItemNumber = Number(itemStart);
    }

    const explicitItemNumber = line.match(/(?:^|\s)(\d{1,2})(?:\s|$)/)?.[1];
    const parsedNumber = explicitItemNumber ? Number(explicitItemNumber) : currentItemNumber;
    if (!parsedNumber || !Number.isInteger(parsedNumber)) continue;

    const answer = line.match(/^Answer Key:\s*(.+)$/i)?.[1]?.trim();
    const benchmark = line.match(/(?:Benchmark:\s*)?(ELA\.\d+\.[A-Z]\.\d+\.\d+)/i)?.[1];
    const category = line.match(/^Reporting Category:\s*(.+)$/i)?.[1]?.trim();
    const categoryCode = line.match(/(?:^|\s)(RP|RI|RGV)(?:\s|$)/i)?.[1]?.toUpperCase();
    const compactAnswer =
      explicitItemNumber && line.length < 80
        ? line.match(/(?:^|\s)([A-I](?:\s*,\s*[A-I])*)(?:\s|$)/)?.[1]
        : undefined;

    const existing = answers.get(parsedNumber) ?? {};
    answers.set(parsedNumber, {
      correct_answer: answer
        ? normalizeAnswerKey(answer)
        : (existing.correct_answer ??
          (compactAnswer ? normalizeAnswerKey(compactAnswer) : existing.correct_answer)),
      benchmark_code: benchmark?.toUpperCase() ?? existing.benchmark_code,
      reporting_category: category
        ? normalizeReportingCategory(category)
        : (normalizeReportingCategory(categoryCode ?? '') ?? existing.reporting_category),
    });
  }
  return answers;
}

function isItemStart(line: string) {
  return /^(\d{1,2})[.)]\s+/.test(line);
}

function optionLetter(line: string) {
  return line.match(/^([A-I])(?:[.)])?\s+(.+)/)?.[1] ?? null;
}

function optionText(line: string) {
  return line.match(/^([A-I])(?:[.)])?\s+(.+)/)?.[2]?.trim() ?? '';
}

function cleanChoiceText(text: string) {
  return text
    .replace(/\s+\d{4,6}\s+\[Page\s+\d+\][\s\S]*$/i, '')
    .replace(/\s+\d{4,6}$/i, '')
    .replace(/\s+\[Page\s+\d+\][\s\S]*$/i, '')
    .trim();
}

function isPdfNoiseLine(line: string) {
  return (
    /^\d{1,6}$/.test(line) ||
    /^\[Page\s+\d+\]$/i.test(line) ||
    /^Answer Key:/i.test(line) ||
    /^Percentage of Students Answering Correctly:/i.test(line) ||
    /^Reporting Category:/i.test(line) ||
    /^Benchmark:/i.test(line) ||
    /^Benchmark Description:/i.test(line) ||
    /Released Test Items$/i.test(line) ||
    /Test Release Support Document$/i.test(line) ||
    /^Grade \d+ FAST ELA Reading$/i.test(line) ||
    /^Grade \d+ FAST ELA Reading Test Release Support Document$/i.test(line) ||
    /^SECURITY STATEMENT$/i.test(line)
  );
}

function tableChoiceLetters(line: string) {
  const trailingChoices = line.match(/(?:^|\s)([A-I](?:\s+[A-I]){1,8})$/)?.[1];
  if (!trailingChoices) return [];
  return trailingChoices.split(/\s+/);
}

function parseEmbeddedOptions(lines: string[]) {
  const joined = lines.join(' ');
  const matches = Array.from(joined.matchAll(/(?:^|\s)([A-H])\s+(.+?)(?=\s+[A-H]\s+|$)/g));

  return matches
    .map((match) => ({
      letter: match[1],
      text: cleanChoiceText(match[2]),
    }))
    .filter((option) => option.text.length > 2);
}

function parseOptions(lines: string[]) {
  const options: ReleasedItemOption[] = [];
  let current: ReleasedItemOption | null = null;
  let firstOptionIndex = -1;

  lines.forEach((line, index) => {
    if (isPdfNoiseLine(line)) {
      current = null;
      return;
    }

    const tableLetters = tableChoiceLetters(line);
    if (tableLetters.length) {
      if (firstOptionIndex === -1) firstOptionIndex = index;
      for (const letter of tableLetters) {
        if (options.some((option) => option.letter === letter)) continue;
        options.push({ letter, text: `Table choice ${letter}` });
      }
      current = null;
      return;
    }

    const letter = optionLetter(line);
    if (letter) {
      if (firstOptionIndex === -1) firstOptionIndex = index;
      current = { letter, text: cleanChoiceText(optionText(line)) };
      options.push(current);
      return;
    }

    if (current) {
      current.text = cleanChoiceText(`${current.text} ${line}`);
    }
  });

  if (options.length < 2) {
    const embeddedOptions = parseEmbeddedOptions(lines);
    if (embeddedOptions.length >= 2) {
      return {
        options: embeddedOptions,
        firstOptionIndex: lines.findIndex((line) =>
          embeddedOptions.some((option) => line.includes(`${option.letter} ${option.text[0]}`))
        ),
      };
    }
  }

  return { options, firstOptionIndex };
}

function inferItemType(correctAnswer: string, promptText: string) {
  if (/two parts|part a|part b/i.test(promptText)) return 'evidence_based_2_part';
  if (/complete the table|show how/i.test(promptText) && /table/i.test(promptText)) {
    return 'table_completion';
  }
  if (/select two/i.test(promptText)) return 'multi_select';
  return correctAnswer.includes(',') ? 'multi_select' : 'multiple_choice';
}

function cleanPassageLines(lines: string[]) {
  return lines
    .filter((line) => !isPdfNoiseLine(line))
    .filter((line) => !/^Excerpt from/i.test(line))
    .filter((line) => !/^Copyright/i.test(line))
    .filter((line) => !/^Office of Assessment/i.test(line))
    .join('\n')
    .trim();
}

function passageTitleFromText(text: string, fallback: string) {
  const title = text
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => {
      if (!line) return false;
      if (/^\d+\s/.test(line)) return false;
      if (
        /^(by|in this|this excerpt|students read|introduction|section|test release)/i.test(line)
      ) {
        return false;
      }
      if (
        /FAST|released|assessment|Florida|statute|statewide|copyright|clearance|public domain|trademark|publication|property|publisher/i.test(
          line
        )
      ) {
        return false;
      }
      if (/[.!?]$/.test(line)) return false;
      return line.length <= 90;
    });

  return title ?? fallback;
}

function passageCandidateBetween(lines: string[], startIndex: number, endIndex: number) {
  const segment = lines.slice(startIndex, endIndex);
  const lastAnswerKeyIndex = segment.reduce(
    (lastIndex, line, index) => (/^Answer Key:/i.test(line) ? index : lastIndex),
    -1
  );
  const firstPageAfterAnswer =
    lastAnswerKeyIndex >= 0
      ? segment.findIndex(
          (line, index) => index > lastAnswerKeyIndex && /^\[Page\s+\d+\]$/i.test(line)
        )
      : -1;
  const candidateStart =
    firstPageAfterAnswer >= 0
      ? firstPageAfterAnswer
      : lastAnswerKeyIndex >= 0
        ? lastAnswerKeyIndex + 1
        : 0;

  return cleanPassageLines(segment.slice(candidateStart));
}

function passageStartBeforeFirstItem(lines: string[], firstItemIndex: number) {
  const pageIndexes = lines
    .slice(0, firstItemIndex)
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\[Page\s+\d+\]$/i.test(line))
    .map(({ index }) => index);

  const bylineIndex = lines.slice(0, firstItemIndex).findIndex((line) => /^by\s+/i.test(line));
  if (bylineIndex >= 0) {
    const pageBeforeByline = pageIndexes.filter((index) => index < bylineIndex).at(-1);
    if (pageBeforeByline !== undefined) return pageBeforeByline;
  }

  for (let i = pageIndexes.length - 1; i >= 0; i -= 1) {
    const candidate = cleanPassageLines(lines.slice(pageIndexes[i], firstItemIndex));
    if (countWords(candidate) >= 80) return pageIndexes[i];
  }

  return pageIndexes.at(-1) ?? 0;
}

export function extractReleasedBookletFromText(
  rawText: string,
  metadata: LocalBookletMetadata
): ReleasedBookletExtraction {
  const lines = compactLines(rawText);
  const answerRows = parseAnswerKey(lines);
  const answerKeyStart = findAnswerKeyStart(lines);
  const contentLines = answerKeyStart === lines.length ? lines : lines;

  const starts = contentLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isItemStart(line));

  const items: ReleasedItemExtraction[] = [];
  const passages: ReleasedPassageExtraction[] = [];
  let currentPassageIndex = 1;

  const firstItemIndex = starts[0]?.index ?? Math.min(contentLines.length, 120);
  const firstPassageStart = passageStartBeforeFirstItem(contentLines, firstItemIndex);
  const firstPassageText =
    cleanPassageLines(contentLines.slice(firstPassageStart, firstItemIndex)) ||
    metadata.booklet_name;
  passages.push({
    passage_index: currentPassageIndex,
    passage_title: passageTitleFromText(firstPassageText, metadata.booklet_name),
    passage_type: 'informational_article',
    passage_text: firstPassageText,
    passage_word_count: Math.max(1, countWords(firstPassageText)),
    paired_with_passage_index: null,
    inferred_lexile: null,
  });

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    if (i > 0) {
      const candidate = passageCandidateBetween(contentLines, starts[i - 1].index, start.index);
      if (countWords(candidate) >= 80) {
        currentPassageIndex += 1;
        passages.push({
          passage_index: currentPassageIndex,
          passage_title: passageTitleFromText(candidate, `Passage ${currentPassageIndex}`),
          passage_type: 'informational_article',
          passage_text: candidate,
          passage_word_count: countWords(candidate),
          paired_with_passage_index: null,
          inferred_lexile: null,
        });
      }
    }

    const end = starts[i + 1]?.index ?? contentLines.length;
    const block = contentLines.slice(start.index, end);
    const itemNumber = Number(start.line.match(/^(\d{1,2})/)?.[1]);
    if (!Number.isInteger(itemNumber)) continue;

    const answer = answerRows.get(itemNumber);

    const { options, firstOptionIndex } = parseOptions(block);
    if (options.length < 2 || firstOptionIndex < 0) continue;

    const promptLines = block.slice(0, firstOptionIndex);
    promptLines[0] = promptLines[0].replace(/^(\d{1,2})[.)]\s+/, '').trim();
    const promptText = promptLines.join(' ').trim();
    if (!promptText) continue;

    items.push({
      item_number: itemNumber,
      passage_index: currentPassageIndex,
      benchmark_code: answer?.benchmark_code ?? 'UNMAPPED',
      reporting_category: answer?.reporting_category ?? 'RI',
      item_type: inferItemType(answer?.correct_answer ?? 'UNKEYED', promptText),
      prompt_text: promptText,
      options,
      correct_answer: answer?.correct_answer ?? 'UNKEYED',
      cognitive_complexity: null,
      extraction_confidence:
        answer?.correct_answer && answer.benchmark_code && answer.reporting_category ? 0.62 : 0.36,
    });
  }

  const extraction: ReleasedBookletExtraction = {
    metadata: {
      booklet_name: metadata.booklet_name,
      grade: metadata.grade,
      subject: metadata.subject,
      release_year: metadata.release_year,
      total_items_expected: metadata.total_items_expected ?? items.length,
    },
    passages,
    items,
  };

  assertReleasedBookletExtraction(extraction);
  return normalizeReleasedExtraction(extraction);
}
