export type BlockDay = 'A' | 'B';

export type SchoolDayInfo = {
  date: string;
  label: string;
  isInstructional: boolean;
  blockDay: BlockDay | null;
  gradingPeriod: 1 | 2 | 3 | 4 | null;
  note: string | null;
};

type DateRange = {
  start: string;
  end: string;
  note: string;
};

export const MDCPS_2026_2027_CALENDAR = {
  schoolYear: '2026-2027',
  district: 'Miami-Dade County Public Schools',
  firstStudentDay: '2026-08-13',
  lastStudentDay: '2027-06-03',
  blockPattern: {
    firstInstructionalDay: 'A' as BlockDay,
    aDayPeriods: [1, 3, 5, 7],
    bDayPeriods: [2, 4, 6, 8],
  },
  gradingPeriods: [
    { period: 1 as const, start: '2026-08-13', end: '2026-10-16', expectedDays: 45 },
    { period: 2 as const, start: '2026-10-19', end: '2027-01-14', expectedDays: 46 },
    { period: 3 as const, start: '2027-01-19', end: '2027-03-19', expectedDays: 42 },
    { period: 4 as const, start: '2027-03-30', end: '2027-06-03', expectedDays: 47 },
  ],
  nonInstructionalRanges: [
    { start: '2026-09-07', end: '2026-09-07', note: 'Labor Day' },
    { start: '2026-11-11', end: '2026-11-11', note: "Veterans' Day" },
    { start: '2026-11-23', end: '2026-11-27', note: 'Thanksgiving recess' },
    { start: '2026-12-21', end: '2027-01-01', note: 'Winter recess' },
    { start: '2027-01-18', end: '2027-01-18', note: 'Dr. Martin Luther King Jr. Day' },
    { start: '2027-02-15', end: '2027-02-15', note: 'Presidents Day' },
    { start: '2027-03-22', end: '2027-03-26', note: 'Spring recess' },
    { start: '2027-03-29', end: '2027-03-29', note: 'Teacher planning day' },
    { start: '2027-05-31', end: '2027-05-31', note: 'Memorial Day' },
  ] satisfies DateRange[],
};

function dateAtNoon(date: string) {
  return new Date(`${date}T12:00:00`);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateInRange(date: string, range: DateRange) {
  return date >= range.start && date <= range.end;
}

function weekday(date: string) {
  return dateAtNoon(date).getDay();
}

export function formatSchoolDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dateAtNoon(date));
}

export function periodNumberFromLabel(periodLabel: string | null | undefined) {
  const match = String(periodLabel ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function blockForPeriod(period: number | null | undefined): BlockDay | null {
  if (!period) return null;
  if (MDCPS_2026_2027_CALENDAR.blockPattern.aDayPeriods.includes(period)) return 'A';
  if (MDCPS_2026_2027_CALENDAR.blockPattern.bDayPeriods.includes(period)) return 'B';
  return null;
}

export function isInstructionalDate(date: string) {
  const day = weekday(date);
  if (day === 0 || day === 6) return false;
  if (
    date < MDCPS_2026_2027_CALENDAR.firstStudentDay ||
    date > MDCPS_2026_2027_CALENDAR.lastStudentDay
  ) {
    return false;
  }
  return !MDCPS_2026_2027_CALENDAR.nonInstructionalRanges.some((range) =>
    dateInRange(date, range)
  );
}

export function gradingPeriodForDate(date: string): 1 | 2 | 3 | 4 | null {
  return (
    MDCPS_2026_2027_CALENDAR.gradingPeriods.find(
      (period) => date >= period.start && date <= period.end
    )?.period ?? null
  );
}

export function instructionalDates() {
  const dates: string[] = [];
  let cursor = dateAtNoon(MDCPS_2026_2027_CALENDAR.firstStudentDay);
  const last = dateAtNoon(MDCPS_2026_2027_CALENDAR.lastStudentDay);
  while (cursor <= last) {
    const iso = toIsoDate(cursor);
    if (isInstructionalDate(iso)) dates.push(iso);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

const INSTRUCTIONAL_DATES = instructionalDates();

export function blockDayForDate(date: string): BlockDay | null {
  const index = INSTRUCTIONAL_DATES.indexOf(date);
  if (index < 0) return null;
  const first = MDCPS_2026_2027_CALENDAR.blockPattern.firstInstructionalDay;
  const evenBlock = first;
  const oddBlock = first === 'A' ? 'B' : 'A';
  return index % 2 === 0 ? evenBlock : oddBlock;
}

export function schoolDayInfo(date: string): SchoolDayInfo {
  const closure = MDCPS_2026_2027_CALENDAR.nonInstructionalRanges.find((range) =>
    dateInRange(date, range)
  );
  const isInstructional = isInstructionalDate(date);
  return {
    date,
    label: formatSchoolDate(date),
    isInstructional,
    blockDay: isInstructional ? blockDayForDate(date) : null,
    gradingPeriod: gradingPeriodForDate(date),
    note: closure?.note ?? null,
  };
}

export function nextInstructionalDate(from = new Date()) {
  const today = toIsoDate(from);
  return INSTRUCTIONAL_DATES.find((date) => date >= today) ?? INSTRUCTIONAL_DATES.at(-1) ?? null;
}

export function nextMeetingsForPeriod(periodLabel: string | null | undefined, count = 5, from = new Date()) {
  const periodNumber = periodNumberFromLabel(periodLabel);
  const targetBlock = blockForPeriod(periodNumber);
  if (!targetBlock) return [];
  const today = toIsoDate(from);
  return INSTRUCTIONAL_DATES.filter((date) => date >= today && blockDayForDate(date) === targetBlock)
    .slice(0, count)
    .map((date) => schoolDayInfo(date));
}

export function upcomingMeetingsForPeriod(
  periodLabel: string | null | undefined,
  count = 20,
  from = new Date()
) {
  return nextMeetingsForPeriod(periodLabel, count, from);
}

export function monthLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(dateAtNoon(date));
}

export function weekOfLabel(date: string) {
  const current = dateAtNoon(date);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(current, mondayOffset);
  return `Week of ${formatSchoolDate(toIsoDate(monday))}`;
}

export function remainingMeetingsInGradingPeriod(
  periodLabel: string | null | undefined,
  from = new Date()
) {
  const periodNumber = periodNumberFromLabel(periodLabel);
  const targetBlock = blockForPeriod(periodNumber);
  const nextDate = nextInstructionalDate(from);
  if (!targetBlock || !nextDate) return 0;
  const currentGp = gradingPeriodForDate(nextDate);
  if (!currentGp) return 0;
  return INSTRUCTIONAL_DATES.filter(
    (date) =>
      date >= nextDate &&
      gradingPeriodForDate(date) === currentGp &&
      blockDayForDate(date) === targetBlock
  ).length;
}

export function schoolYearProgress(from = new Date()) {
  const today = toIsoDate(from);
  const completed = INSTRUCTIONAL_DATES.filter((date) => date < today).length;
  return {
    completedInstructionalDays: completed,
    totalInstructionalDays: INSTRUCTIONAL_DATES.length,
    remainingInstructionalDays: Math.max(0, INSTRUCTIONAL_DATES.length - completed),
  };
}
