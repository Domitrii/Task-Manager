import { defineConfig } from '@playwright/test'

/**
 * Every screen at the widths staff actually use: a small phone at the pass, a
 * tablet on the wall, a small laptop in the office and a desktop.
 *
 * Two copies of the app run: one device-only (no Supabase keys, so it opens on
 * demo data with no sign-in), and one with keys pointing at nothing, for the
 * sign-in and team screens. Those tests answer Supabase's requests themselves.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'laptop', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: 'npx vite --port 5199 --strictPort',
      url: 'http://localhost:5199',
      // Set but empty: beats whatever `.env` has, so this copy never syncs.
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite --port 5198 --strictPort',
      url: 'http://localhost:5198',
      // Nothing listens here; the tests answer the requests they need.
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54399', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
      reuseExistingServer: !process.env.CI,
    },
  ],
})
