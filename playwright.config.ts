import { defineConfig } from '@playwright/test';
import { loadEnvFile } from 'node:process';
loadEnvFile('.env');
export default defineConfig({ testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 60000, use: { baseURL: 'http://localhost:3000', channel: 'chrome', screenshot: 'only-on-failure', trace: 'off' }, reporter: 'list' });
