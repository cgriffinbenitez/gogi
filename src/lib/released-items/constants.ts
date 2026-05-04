export const RELEASED_FAST_BOOKLET_BUCKET = 'released-fast-booklets';

export const RELEASED_BOOKLET_GRADES = [8, 9, 10] as const;

export type ReleasedBookletGrade = (typeof RELEASED_BOOKLET_GRADES)[number];

export const RELEASED_BOOKLET_SUBJECT = 'ELA Reading';

export type ReleasedBookletUploadResult = {
  id: string;
  booklet_name: string;
  grade: number;
  subject: string;
  release_year: number;
  raw_pdf_path: string;
  extraction_status: string;
  uploaded_at: string;
};
