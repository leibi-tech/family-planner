// Lädt Playwright – egal, ob in der Claude-Cowork-Umgebung (/opt/npm-tools)
// oder in Claude Code im Web / auf GitHub (normales npm-Paket "playwright").
import { existsSync } from 'node:fs';

const fixed = '/opt/npm-tools/node_modules/playwright/index.mjs';
let pw;
if (existsSync(fixed)) {
  pw = await import(fixed);
} else {
  try {
    pw = await import('playwright');
  } catch {
    console.error('FAIL Playwright fehlt. Einmalig: npm i --no-save playwright && npx playwright install chromium');
    process.exit(1);
  }
}
export const chromium = pw.chromium;
