import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const BUNDLED_PYTHON_ROOT = join(
  homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/python'
);

const PYTHON_EXTRACTOR = `
import json
import sys
from pypdf import PdfReader

path = sys.argv[1]
reader = PdfReader(path)
pages = []
for index, page in enumerate(reader.pages):
    try:
        text = page.extract_text() or ""
    except Exception:
        text = ""
    pages.append({"page": index + 1, "text": text})
print(json.dumps({"pages": pages}))
`;

export type ExtractedPdfPage = {
  page: number;
  text: string;
};

function pythonPath() {
  const bundledPython = join(BUNDLED_PYTHON_ROOT, 'bin/python3');
  return (
    process.env.PYTHON_PDF_EXTRACTOR ?? (existsSync(bundledPython) ? bundledPython : 'python3')
  );
}

function pythonEnv() {
  return {
    ...process.env,
    PYTHONPATH: process.env.PYTHON_PDF_EXTRACTOR_PATH ?? BUNDLED_PYTHON_ROOT,
  };
}

export async function extractPdfPagesLocally(pdfBytes: ArrayBuffer): Promise<ExtractedPdfPage[]> {
  const dir = await mkdtemp(join(tmpdir(), 'gogi-released-pdf-'));
  const pdfPath = join(dir, `${randomUUID()}.pdf`);
  const scriptPath = join(dir, 'extract.py');

  try {
    await writeFile(pdfPath, Buffer.from(pdfBytes));
    await writeFile(scriptPath, PYTHON_EXTRACTOR);

    const { stdout } = await execFileAsync(pythonPath(), [scriptPath, pdfPath], {
      maxBuffer: 1024 * 1024 * 20,
      env: pythonEnv(),
    });

    const parsed = JSON.parse(stdout) as { pages?: ExtractedPdfPage[] };
    return parsed.pages ?? [];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function readPdfTextLocally(pdfBytes: ArrayBuffer) {
  const pages = await extractPdfPagesLocally(pdfBytes);
  return pages
    .map((page) => `\n\n[Page ${page.page}]\n${page.text}`)
    .join('\n')
    .trim();
}
