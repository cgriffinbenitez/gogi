import { defineConfig, devices } from '@playwright/test';

/**
 * GOGI Playwright Configuration
 * Dev server runs on port 4028 (npm run dev)
 *
 * Test credentials — set in .env.test.local or export before running:
 *   PLAYWRIGHT_STUDENT_EMAIL=marcus@test.gogi
 *   PLAYWRIGHT_STUDENT_PASSWORD=GogiTest2026!
 *   PLAYWRIGHT_TEACHER_EMAIL=teacher@test.gogi
 *   PLAYWRIGHT_TEACHER_PASSWORD=GogiTest2026!
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // clinical loop tests are sequential by nature
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4028',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // No webServer block — start `npm run dev` manually before running tests.
  // This prevents accidentally re-starting a server that's already running.
});
