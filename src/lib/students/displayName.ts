const DEMO_STUDENT_ONE_NAMES = new Set(['student 1', 'student1', 'test student one']);

export function normalizeStudentDisplayName(fullName: string | null | undefined) {
  const trimmed = fullName?.trim() || 'Student';
  return DEMO_STUDENT_ONE_NAMES.has(trimmed.toLowerCase()) ? 'Noah Rivera' : trimmed;
}

export function getStudentFirstName(fullName: string | null | undefined) {
  return normalizeStudentDisplayName(fullName).split(/\s+/)[0] || 'Student';
}
