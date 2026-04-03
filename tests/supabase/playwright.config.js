const path = require('path');
const { defineConfig } = require('@playwright/test');

const ROOT_SERVER = path.join(__dirname, '../../server.js');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
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
    command: `node ${ROOT_SERVER}`,
    url: 'http://127.0.0.1:4173/index.html?backend=browser-test',
    reuseExistingServer: true,
    timeout: 15_000,
  },
  outputDir: path.join(__dirname, '../../test-results/supabase'),
});
