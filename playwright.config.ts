import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chrome = process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined;

export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 30000, reporter: 'list',
  use: { baseURL: 'http://localhost:8082', launchOptions: { executablePath: chrome }, trace: 'retain-on-failure' },
  webServer: { command: 'node server.js', url: 'http://localhost:8082', reuseExistingServer: false,
    env: { PORT: '8082', DATA_DIR: `.local/browser-${Date.now()}` } },
});
