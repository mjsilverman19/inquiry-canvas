import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/ui', use: { launchOptions: { executablePath: globalThis.process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }, baseURL: 'http://127.0.0.1:4173/inquiry-canvas/' }, webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173/inquiry-canvas/', reuseExistingServer: true } });
