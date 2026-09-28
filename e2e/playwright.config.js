import { defineConfig } from '@playwright/test';

/**
 * Whether the tests run against the Vite dev server rather than the production bundle. The dev
 * server needs no build, which makes it quicker to iterate on a change, but only the bundle is what
 * gets published, so it’s the default and what CI runs.
 */
const isDev = process.env.E2E_TARGET === 'dev';
const isCI = !!process.env.CI;
/**
 * Port of the server the tests run against, away from the ports of the dev servers other worktrees
 * may be running. Set `E2E_PORT` to use another one.
 */
const PORT = Number(process.env.E2E_PORT ?? 4180);
// Use the IPv4 loopback address throughout: Vite would otherwise listen on `::1` only, where
// Playwright doesn’t look for the server when it waits for it to start
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.e2e.js',
  // A folder for each port, as a run clears its folder first: runs on other ports in the same
  // checkout would otherwise delete each other’s traces
  outputDir: `../test-results/${PORT}`,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Each test opens a fresh browser context with the whole app in it, so cap the number of them
  // running at once, like the component tests do, to keep the memory in check
  workers: isCI ? 2 : 4,
  reporter: isCI
    ? [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]]
    : 'list',
  // A Sveltia UI dialog only reports its result once its closing transition has finished, which a
  // loaded CI runner takes a while over
  expect: { timeout: 5000 },
  use: {
    baseURL,
    // The admin page: the one in `e2e/site` for the bundle, or the root `index.html` in dev, which
    // loads the config from `VITE_SITE_URL` — the dev server itself
    adminPath: isDev ? '/' : '/admin/',
    // Pin the time zone and language like the component tests do, so a date or number is
    // formatted the same wherever the tests run
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Run Vite’s script directly: `pnpm exec` would start it outside the process group Playwright
    // stops at the end, leaving it running
    command: isDev
      ? `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${PORT} --strictPort`
      : `node e2e/server.js ${PORT}`,
    env: { VITE_SITE_URL: baseURL },
    cwd: '..',
    url: isDev ? baseURL : `${baseURL}/admin/`,
    // Never reuse a server already on the port: it could be another worktree’s, serving its own
    // bundle, and stopping when that worktree’s run ends. A busy port fails the run instead
    reuseExistingServer: false,
  },
});
