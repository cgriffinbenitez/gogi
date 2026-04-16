/**
 * GOGI Marcus Simulation — End-to-End Clinical Validation Suite
 *
 * ─── Who is Marcus ────────────────────────────────────────────────────────────
 * 6th-grade reading level, low effort, rushes every step. Picks the first
 * available option without reading the passage. Types "idk" when free text is
 * required. Does not re-read after hint. These behaviors stress-test clinical
 * routing, feedback quality, and data integrity across the full loop.
 *
 * ─── Prerequisites ────────────────────────────────────────────────────────────
 * 1. Dev server running: npm run dev  (port 4028)
 * 2. Supabase has a student user whose credentials match:
 *      PLAYWRIGHT_STUDENT_EMAIL   (default: marcus@test.gogi)
 *      PLAYWRIGHT_STUDENT_PASSWORD (default: GogiTest2026!)
 *    The user must have a corresponding row in the `students` table.
 * 3. Run: npx playwright test --project=chromium
 *
 * ─── Test Coverage ────────────────────────────────────────────────────────────
 * T01  Auth & Home            Login redirects to /student-home; 3 standard cards visible
 * T02  Diagnostic             Full 9-question flow; results screen; session saved
 * T03  Teach Phase            Protocol engine loads; Orientation content streams; step advances
 * T04  Practice Phase         3 questions generate; Marcus can submit "idk"; session completes
 * T05  Reassess Phase         Passage + questions render; Marcus can submit answers
 * T06  Home Status Update     After diagnostic, standard card no longer shows "Not Started"
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsStudent,
  AI_TIMEOUT,
  NAV_TIMEOUT,
  UI_TIMEOUT,
} from './helpers';

// ─── Shared browser state ─────────────────────────────────────────────────────
// All tests in this file share one browser context so auth session persists.

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
});

test.afterAll(async () => {
  await context.close();
});

// ─── T01: Auth & Home ─────────────────────────────────────────────────────────

test('T01 — Auth: Marcus logs in and lands on Student Home', async () => {
  await loginAsStudent(page);

  // URL is /student-home
  expect(page.url()).toContain('/student-home');

  // GOGI logo visible in header
  await expect(page.locator('text=GOGI').first()).toBeVisible({ timeout: UI_TIMEOUT });

  // "Welcome back" heading present (before name loads or after)
  await expect(
    page.locator('h1').filter({ hasText: /Welcome back/ }).first(),
  ).toBeVisible({ timeout: UI_TIMEOUT });

  // All 3 pilot standard codes appear on the page
  for (const code of ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1']) {
    await expect(page.locator(`text=${code}`).first()).toBeVisible({ timeout: UI_TIMEOUT });
  }

  // Each card shows either a CTA button or a status badge (not a loading skeleton)
  const cards = page.locator('[class*="rounded-2xl"]').filter({ hasText: /ELA\.9\.R/ });
  await expect(cards).toHaveCount(3, { timeout: UI_TIMEOUT });
});

// ─── T02: Diagnostic ─────────────────────────────────────────────────────────

test('T02 — Diagnostic: Marcus rushes through all 9 questions picking option A each time', async () => {
  // Navigate to diagnostic from home
  await page.goto('/student-diagnostic', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });

  // ── Wait for intro screen ──────────────────────────────────────────────────
  await expect(page.locator('text=ELA Reading Diagnostic')).toBeVisible({ timeout: AI_TIMEOUT });
  await expect(page.locator('text=ELA.9.R.1.1')).toBeVisible({ timeout: UI_TIMEOUT });
  await expect(page.locator('text=ELA.9.R.1.2')).toBeVisible({ timeout: UI_TIMEOUT });
  await expect(page.locator('text=ELA.9.R.2.1')).toBeVisible({ timeout: UI_TIMEOUT });

  // The stat boxes show Standards: 3 and Format: Multiple Choice
  await expect(page.locator('text=3').first()).toBeVisible({ timeout: UI_TIMEOUT });
  await expect(page.locator('text=Multiple Choice')).toBeVisible({ timeout: UI_TIMEOUT });

  // Click Start Diagnostic
  await page.click('button:has-text("Start Diagnostic")', { timeout: UI_TIMEOUT });

  // ── Assessment phase ───────────────────────────────────────────────────────
  // The diagnostic generates 9 questions (3 per standard) via Claude API.
  // Wait for the first question to appear — this involves a Claude call.
  await page.waitForSelector('button:has-text("Confirm Answer")', { timeout: AI_TIMEOUT });

  // Marcus rushes: picks option A (first button in choices) for every question
  // without reading the passage. 9 questions total.
  for (let q = 0; q < 9; q++) {
    // Wait for question panel to be interactive (Confirm Answer is enabled)
    await page.waitForSelector('button:has-text("Confirm Answer"):not([disabled])', {
      timeout: AI_TIMEOUT,
    });

    // Pick the first choice button (letter A)
    const choiceButtons = page.locator('button').filter({ has: page.locator('span').filter({ hasText: 'A' }) });
    const firstChoice = choiceButtons.first();
    await firstChoice.waitFor({ state: 'visible', timeout: UI_TIMEOUT });
    await firstChoice.click();

    // Confirm the answer
    await page.click('button:has-text("Confirm Answer")');

    // Wait for feedback state ("Moving on…" button appears) then auto-advance
    await page.waitForSelector('button:has-text("Moving on…")', { timeout: UI_TIMEOUT });
    await page.waitForTimeout(1_500); // 1s setTimeout + buffer

    // If we're on the last question, the results screen will appear
    // Stop loop on results
    const isResults = await page.locator('text=Diagnostic Complete').isVisible().catch(() => false);
    if (isResults) break;
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  await expect(page.locator('text=Diagnostic Complete')).toBeVisible({ timeout: AI_TIMEOUT });
  await expect(page.locator('text=Results by Standard')).toBeVisible({ timeout: UI_TIMEOUT });

  // All 3 standard codes appear in results
  for (const code of ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1']) {
    await expect(page.locator(`text=${code}`).first()).toBeVisible({ timeout: UI_TIMEOUT });
  }

  // Marcus picked all A answers and likely scored below 80% — "Start Lesson" buttons appear
  // (at least one standard should show the Start Lesson CTA given random A answers)
  const startLessonBtns = page.locator('button:has-text("Start Lesson")');
  const lessonCount = await startLessonBtns.count();
  // We expect at least 1 failed standard (very likely all 3)
  expect(lessonCount).toBeGreaterThanOrEqual(1);
});

// ─── T03: Teach Phase ─────────────────────────────────────────────────────────

test('T03 — Teach: Protocol engine loads and Orientation content streams', async () => {
  // Navigate to teach for the first pilot standard
  // We get the standardId from the URL if we click Start Lesson,
  // but since we don't know the UUID, we navigate via the home page card.
  await page.goto('/student-home', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });

  // Wait for cards to load and find the first "Start Lesson" or "Continue Lesson" button
  await page.waitForSelector('button:has-text("Lesson")', { timeout: AI_TIMEOUT });

  // Click the first lesson button — this navigates to /student-teach/[standardId]
  await page.click('button:has-text("Lesson")', { timeout: UI_TIMEOUT });
  await page.waitForURL('**/student-teach/**', { timeout: NAV_TIMEOUT });

  const teachUrl = page.url();
  expect(teachUrl).toContain('/student-teach/');

  // ── Protocol selection ─────────────────────────────────────────────────────
  // TeachSession loads the diagnostic classification and routes to a protocol.
  // The classification is determined by the wrong answers Marcus gave.
  // We wait for ProtocolEngine to appear — it renders "Gogi is thinking…" then streams.

  // Wait for the GOGI header to appear (ProtocolEngine inherits the GOGI layout)
  await expect(page.locator('text=GOGI').first()).toBeVisible({ timeout: AI_TIMEOUT });

  // ── Orientation step ───────────────────────────────────────────────────────
  // The orientation step is read_only — content streams from Claude.
  // Wait for something other than a spinner to appear.
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        !body.includes('Gogi is thinking') &&
        !body.includes('preparing') &&
        body.length > 200 &&
        // Not just a loading spinner
        document.querySelector('[class*="animate-spin"]') === null
      );
    },
    { timeout: AI_TIMEOUT },
  );

  // The orientation content area should have substantive text (not empty)
  const mainContent = await page.evaluate(() => document.body.innerText);
  expect(mainContent.length).toBeGreaterThan(100);

  // A "Continue" or "Next" button (or similar advance control) should be visible
  // ProtocolEngine renders a continue button after read_only steps finish streaming.
  const continueBtn = page.locator('button').filter({ hasText: /Continue|Next|Got it/i }).first();
  await continueBtn.waitFor({ state: 'visible', timeout: AI_TIMEOUT });
  expect(await continueBtn.isEnabled()).toBe(true);

  // ── Advance to step 2 (MicroModel) ────────────────────────────────────────
  await continueBtn.click();

  // Step 2 is also read_only — wait for content to stream again
  await page.waitForFunction(
    () => {
      const spinners = document.querySelectorAll('[class*="animate-spin"]');
      return spinners.length === 0 && document.body.innerText.length > 200;
    },
    { timeout: AI_TIMEOUT },
  );

  // MicroModel should still show a Continue button
  const step2Btn = page.locator('button').filter({ hasText: /Continue|Next|Got it/i }).first();
  await step2Btn.waitFor({ state: 'visible', timeout: AI_TIMEOUT });
  expect(await step2Btn.isEnabled()).toBe(true);
});

// ─── T04: Practice Phase ──────────────────────────────────────────────────────

test('T04 — Practice: Marcus submits "idk" to all 3 practice questions', async () => {
  // Navigate to practice via the home page — find "Start Practice" card button
  await page.goto('/student-home', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });

  // If practice is not yet unlocked (teach not complete), this test is a no-op.
  const practiceBtn = page.locator('button:has-text("Practice")').first();
  const isPracticeVisible = await practiceBtn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (!isPracticeVisible) {
    test.skip();
    return;
  }

  await practiceBtn.click();
  await page.waitForURL('**/student-practice/**', { timeout: NAV_TIMEOUT });

  // Wait for the first question to generate (Claude API call)
  // PracticeSession shows 'generating' view while calling Claude, then 'question'
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        !body.includes('Gogi is building') &&
        !body.includes('generating') &&
        document.querySelector('textarea') !== null
      );
    },
    { timeout: AI_TIMEOUT },
  );

  // Marcus types "idk" into each question's textarea and submits
  for (let q = 0; q < 3; q++) {
    // Wait for textarea to be available
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: AI_TIMEOUT });
    await textarea.fill('idk');

    // Submit — button text varies by interaction type but always contains Submit
    await page.click('button:has-text("Submit")', { timeout: UI_TIMEOUT });

    // Wait for evaluation (Claude call)
    await page.waitForFunction(
      () => {
        const body = document.body.innerText;
        return body.includes('feedback') || body.includes('Feedback') || body.includes('Next') || body.includes('Complete');
      },
      { timeout: AI_TIMEOUT },
    );

    // If it's the last question, a "complete" state will appear
    const isComplete = await page.locator('text=Practice Complete').isVisible().catch(() => false);
    if (isComplete) break;

    // Advance to next question
    const nextBtn = page.locator('button').filter({ hasText: /Next|Continue/i }).first();
    const nextVisible = await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (nextVisible) await nextBtn.click();

    await page.waitForTimeout(1_000);
  }

  // After 3 questions, practice complete screen or routing to reassess
  const completeOrReassess = await Promise.race([
    page.waitForURL('**/student-reassess/**', { timeout: AI_TIMEOUT }).then(() => 'reassess'),
    page.waitForSelector('text=Practice Complete', { timeout: AI_TIMEOUT }).then(() => 'complete'),
  ]);
  expect(['complete', 'reassess']).toContain(completeOrReassess);
});

// ─── T05: Reassess Phase ──────────────────────────────────────────────────────

test('T05 — Reassess: Passage and questions render; Marcus answers', async () => {
  // Navigate to reassess — need a standardId.
  // Get it from home page if "Start Reassessment" is available.
  await page.goto('/student-home', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });

  const reassessBtn = page.locator('button:has-text("Reassessment")').first();
  const isReassessVisible = await reassessBtn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (!isReassessVisible) {
    test.skip();
    return;
  }

  await reassessBtn.click();
  await page.waitForURL('**/student-reassess/**', { timeout: NAV_TIMEOUT });

  // Wait for passage to appear (may require a Claude call to generate)
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      const hasPassage =
        body.includes('Passage') ||
        body.includes('passage') ||
        document.querySelectorAll('button').length > 2;
      return hasPassage && !body.includes('Loading');
    },
    { timeout: AI_TIMEOUT },
  );

  // The reassess page should show a passage panel
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText.length).toBeGreaterThan(200);

  // If there are choice buttons (multiple choice reassess), Marcus picks A each time
  const choiceButtons = page.locator('button').filter({
    has: page.locator('span').filter({ hasText: /^A$/ }),
  });
  const hasChoices = (await choiceButtons.count()) > 0;

  if (hasChoices) {
    await choiceButtons.first().click();
    const confirmBtn = page.locator('button:has-text("Confirm Answer")');
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(1_500);
    }
  }

  // If there's a textarea (short response), Marcus types "idk"
  const textarea = page.locator('textarea').first();
  const hasTextarea = await textarea.isVisible({ timeout: 3_000 }).catch(() => false);
  if (hasTextarea) {
    await textarea.fill('idk');
    await page.click('button:has-text("Submit")');
    await page.waitForTimeout(2_000);
  }
});

// ─── T06: Home Status Update ──────────────────────────────────────────────────

test('T06 — Home Status: After diagnostic, standard cards no longer show "Not Started"', async () => {
  await page.goto('/student-home', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });

  // Wait for cards to load
  await page.waitForFunction(
    () => {
      // Loading skeletons have animate-pulse class; real cards don't
      const loading = document.querySelectorAll('[class*="animate-pulse"]');
      const cards = document.querySelectorAll('[class*="rounded-2xl"]');
      return loading.length === 0 && cards.length >= 3;
    },
    { timeout: AI_TIMEOUT },
  );

  // "Not Started" should not appear on any card (we completed diagnostic above)
  const notStartedCount = await page.locator('text=Not Started').count();
  // Marcus completed the diagnostic — at worst cards show "Ready to Learn"
  // (unless somehow the session wasn't saved, but we verify the diagnostic ran)
  expect(notStartedCount).toBe(0);

  // At least one card should show a state beyond Not Started
  const activeStatuses = page.locator('text=/Ready to Learn|In Progress|Ready to Practice|Ready to Reassess|Mastered|Needs Support/');
  const activeCount = await activeStatuses.count();
  expect(activeCount).toBeGreaterThanOrEqual(1);

  // All 3 CTA buttons are present and not "Begin Diagnostic"
  const beginDiagBtns = page.locator('button:has-text("Begin Diagnostic")');
  const beginDiagCount = await beginDiagBtns.count();
  expect(beginDiagCount).toBe(0);
});

// ─── Bonus: Data Integrity Spot-Check ─────────────────────────────────────────

test('T07 — Data Integrity: No undefined/null appears in visible UI text', async () => {
  // Navigate through key pages and check for leaked undefined/null/[object Object]
  const pagesToCheck = [
    '/student-home',
    '/student-diagnostic',
  ];

  for (const path of pagesToCheck) {
    await page.goto(path, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });

    // Wait for loading to settle
    await page.waitForFunction(
      () => document.querySelectorAll('[class*="animate-pulse"]').length === 0,
      { timeout: UI_TIMEOUT },
    );

    const bodyText = await page.evaluate(() => document.body.innerText);

    // None of these should appear in the rendered UI
    expect(bodyText).not.toContain('[object Object]');
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('null\n');
    expect(bodyText).not.toContain('NaN');
  }
});

// ─── Bonus: Mobile Viewport Smoke Test ────────────────────────────────────────

test('T08 — Mobile: Student home renders correctly on mobile viewport', async ({ browser }) => {
  // Fresh mobile context — separate from shared context
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileCtx.newPage();

  try {
    // Import login helper inline (can't use shared page here)
    const { STUDENT_EMAIL, STUDENT_PASSWORD } = await import('./helpers');
    await mobilePage.goto('/sign-up-login-screen', { waitUntil: 'networkidle' });
    await mobilePage.fill('input[type="email"]', STUDENT_EMAIL);
    await mobilePage.fill('input[type="password"]', STUDENT_PASSWORD);
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForURL('**/student-home', { timeout: NAV_TIMEOUT });

    // Cards should stack vertically on mobile (no horizontal overflow)
    const bodyWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await mobilePage.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance

    // GOGI header is visible
    await expect(mobilePage.locator('text=GOGI').first()).toBeVisible({ timeout: UI_TIMEOUT });

    // All 3 standard codes are visible (stacked, not hidden)
    for (const code of ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1']) {
      await expect(mobilePage.locator(`text=${code}`).first()).toBeVisible({ timeout: UI_TIMEOUT });
    }
  } finally {
    await mobileCtx.close();
  }
});
