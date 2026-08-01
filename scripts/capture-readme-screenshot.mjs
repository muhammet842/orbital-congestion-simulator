/**
 * Captures docs/screenshot.png via Playwright against vite preview.
 * Requires a prior `npm run build`.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs/screenshot.png');
mkdirSync(dirname(out), { recursive: true });

const preview = spawn(
  'npx vite preview --host 127.0.0.1 --port 4179 --strictPort',
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: true },
);

let ready = false;
const onData = (buf) => {
  const text = String(buf);
  process.stdout.write(text);
  if (/Local:|http:\/\/127\.0\.0\.1:4179/.test(text)) ready = true;
};
preview.stdout.on('data', onData);
preview.stderr.on('data', onData);

for (let i = 0; i < 90 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const res = await fetch('http://127.0.0.1:4179/');
    if (res.ok) { ready = true; break; }
  } catch {
    // keep waiting
  }
}

if (!ready) {
  preview.kill();
  throw new Error('Preview server did not start on :4179');
}

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4179/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out, type: 'png' });
  await browser.close();
  console.log('Wrote', out);
} finally {
  preview.kill('SIGTERM');
}
