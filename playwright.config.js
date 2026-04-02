const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:4173/index.html?backend=browser-test',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
