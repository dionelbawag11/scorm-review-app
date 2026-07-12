import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    // Allow blob: and data: URLs created by the SCORM bundler
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the Python static server before tests
  webServer: {
    command:
      'python3 -m http.server 8080 --directory sample2/w/scorm-package',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
