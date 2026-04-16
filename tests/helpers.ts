/**
 * GOGI Playwright Test Helpers
 *
 * Shared utilities for the Marcus simulation test suite.
 */
import { Page, expect } from '@playwright/test';

// ─── Credentials ──────────────────────────────────────────────────────────────
// Set these in .env.test.local or export before running:
//   export PLAYWRIGHT_STUDENT_EMAIL="marcus@test.gogi"
//   export PLAYWRIGHT_STUDENT_PASSWORD="GogiTest2026!"

export const STUDENT_EMAIL = process.env.PLAYWRIGHT_STUDENT_EMAIL ?? 'marcus@test.gogi';
export const STUDENT_PASSWORD = process.env.PLAYWRIGHT_STUDENT_PASSWORD ?? 'GogiTest2026!';

// Timeout constants (ms) — Claude API can be slow
export const AI_TIMEOUT = 90_000;   // waiting for streamed AI content to appear
export const NAV_TIMEOUT = 30_000;  // page navigation
export const UI_TIMEOUT  = 10_000;  // non-AI UI interactions

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginAsStudent(page: Page): Promise<void> {
  await page.goto('/sign-up-login-screen', { waitUntil: 'networkidle' });

  await page.fill('input[type="email"]', STUDENT_EMAIL);
  await page.fill('input[type="password"]', STUDENT_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to student-home
  await page.waitForURL('**/student-home', { timeout: NAV_TIMEOUT });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(page: Page): Promise<void> {
  // Navigate directly — no logout button required
  await page.goto('/sign-up-login-screen');
  await page.evaluate(async () => {
    const { createClient } = await import('@supabase/supabase-js');
    // We can't easily call supabase.auth.signOut from test context, so just clear storage
    localStorage.clear();
    sessionStorage.clear();
  });
}

// ─── Wait for text to appear anywhere ─────────────────────────────────────────

export async function waitForContentContaining(
  page: Page,
  substring: string,
  timeout = AI_TIMEOUT,
): Promise<void> {
  await page.waitForFunction(
    (text) => document.body.innerText.includes(text),
    substring,
    { timeout },
  );
}

// ─── Click first available option in a multiple-choice grid ───────────────────

export async function pickFirstChoice(page: Page): Promise<void> {
  // Multiple choice options are rendered as buttons or clickable divs
  // DiagnosticAssessment renders options as divs with data-option or button elements
  const optionSelectors = [
    '[data-testid="choice-option"]',
    'button:has-text("A.")',
    'button:has-text("A)")',
    '[role="radio"]',
  ];

  let clicked = false;
  for (const sel of optionSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await el.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    // Fallback: click the first choice-like element (choice buttons in DiagnosticAssessment)
    // The diagnostic renders: div with onClick={handleSelectOption(index)}
    // Looks for elements containing the option letters
    await page.locator('text=A.').first().click({ timeout: UI_TIMEOUT });
  }
}

// ─── Confirm answer in diagnostic ─────────────────────────────────────────────

export async function confirmAnswer(page: Page): Promise<void> {
  await page.click('button:has-text("Confirm Answer")', { timeout: UI_TIMEOUT });
}

// ─── Submit text response in protocol engine ──────────────────────────────────

export async function submitTextResponse(page: Page, text: string): Promise<void> {
  const textarea = page.locator('textarea').first();
  await textarea.fill(text, { timeout: UI_TIMEOUT });
  await page.click('button:has-text("Submit")', { timeout: UI_TIMEOUT });
}

// ─── Wait for feedback to clear and next question to appear ───────────────────

export async function waitForNextQuestion(page: Page): Promise<void> {
  // After confirming, feedback appears briefly then auto-advances
  await page.waitForTimeout(1_500); // let the 1-second setTimeout clear
}
