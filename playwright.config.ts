import { defineConfig } from '@playwright/test';

// Use port 3099 so E2E never collides with a dev server on the default 3000.
const E2E_PORT = 3099;
const BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: BASE_URL,
  },
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
