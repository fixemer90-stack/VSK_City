import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: process.env.PITCH_TEST_OUTPUT || '../../test-results/pitch',
  use: {
    baseURL: process.env.PITCH_BASE_URL || 'http://127.0.0.1:5188',
    viewport: { width: 1440, height: 960 },
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
});
