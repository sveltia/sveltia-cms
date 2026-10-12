import { defineConfig } from '@playwright/test';

/**
 * Port of the server the benchmarks run against, away from the end-to-end tests’ 4180, so both can
 * run in the same checkout. Set `BENCH_PORT` to use another one.
 */
const PORT = Number(process.env.BENCH_PORT ?? 4190);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.bench.js',
  outputDir: `../test-results/bench-${PORT}`,
  // One scenario at a time, so they don’t compete for the CPU and skew each other’s timings
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A scenario runs several times over a large site
  timeout: 15 * 60_000,
  reporter: 'list',
  // A web-first assertion waits as long as an action, so a step that can’t happen fails rather than
  // waiting until the whole scenario times out
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    actionTimeout: 30_000,
    // Like the end-to-end tests, so a date or number is formatted the same wherever they run
    timezoneId: 'UTC',
    locale: 'en-US',
    // A typical laptop screen
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // The production bundle in `package/dist`, served by the end-to-end tests’ server
    command: `node e2e/server.js ${PORT}`,
    cwd: '..',
    url: `${baseURL}/admin/`,
    reuseExistingServer: false,
  },
});
